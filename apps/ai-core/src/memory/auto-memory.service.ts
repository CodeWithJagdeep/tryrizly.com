import { Inject, Injectable } from "@nestjs/common";
import { LlmRouterService } from "../llm/llm-router.service";
import { VectorMemoryService } from "./vector-memory.service";
import type { HeyRizEventSource } from "../context/context.types";
import type { ToolExecutionResult } from "../tools/tool.types";
import { logger } from "@heyriz/shared/logger";

// Actions worth a durable memory. Reads (calendar_briefing, memory_recall) and
// drafts are deliberately excluded so memory stays high-signal.
const MEMORABLE_ACTIONS = new Set(["send_email", "create_calendar_event"]);
const USER_FACT =
  /\b(remember|note that|for the record|fyi|i (?:prefer|like|want|always|never)|my [a-z]+ is)\b/i;
const MAX_LEN = 200;

/**
 * Lets long-term memory build itself. After the agent actually does something —
 * or the principal states a durable fact — this distills a single non-sensitive
 * note and stores it (with a timestamp) in vector memory. Nothing durable, no
 * write: read-only turns and chit-chat are skipped.
 */
@Injectable()
export class AutoMemoryService {
  constructor(
    @Inject(VectorMemoryService)
    private readonly memory: VectorMemoryService,
    @Inject(LlmRouterService)
    private readonly llm: LlmRouterService,
  ) {}

  async captureTurn(input: {
    userId: string;
    message: string;
    toolResults: ToolExecutionResult[];
    source?: HeyRizEventSource;
  }): Promise<{ saved: boolean; summary?: string }> {
    const actions = input.toolResults.filter(isMemorableAction);
    const userFact = USER_FACT.test(input.message) ? input.message.trim() : undefined;
    if (actions.length === 0 && !userFact) return { saved: false };

    const summary = await this.compose(input.userId, input.message, actions, userFact);
    if (!summary) return { saved: false };

    await this.memory.remember({
      userId: input.userId,
      source: input.source ?? "telegram",
      summary,
      metadata: {
        kind: "semantic-fact",
        provenance: userFact ? "principal" : "verified-tool-result",
        confidence: userFact ? "high" : "medium",
      },
    });
    return { saved: true, summary };
  }

  async captureEvent(input: {
    userId: string;
    source: HeyRizEventSource;
    result: ToolExecutionResult;
    message?: string;
  }): Promise<{ saved: boolean; summary?: string }> {
    // For gmail triage, store each HIGH/MEDIUM email as its own vector entry so
    // semantic search can answer follow-ups like "what's the due date of X".
    if (input.source === "gmail" && input.result.tool === "gmail_triage") {
      const data = input.result.data as {
        items?: Array<{ from: string; subject: string; priority: string; reason: string }>;
      } | undefined;

      if (data?.items?.length) {
        const notable = data.items.filter(
          (i) => i.priority === "HIGH" || i.priority === "MEDIUM",
        );
        if (notable.length === 0) return { saved: false };

        await Promise.all(
          notable.map((item) =>
            this.memory.remember({
              userId: input.userId,
              source: input.source,
              summary: `Email from ${item.from}: "${item.subject}" — ${item.reason} (priority: ${item.priority})`,
              metadata: {
                kind: "email-summary",
                priority: item.priority,
                provenance: "gmail-metadata",
                confidence: "high",
              },
            }),
          ),
        );
        return { saved: true, summary: `Stored ${notable.length} email memories` };
      }
    }

    // Fallback: single-item or non-gmail events — only remember HIGH.
    if (input.result.priority !== "HIGH") return { saved: false };

    const summary = await this.compose(input.userId, input.message ?? "", [input.result], undefined);
    if (!summary) return { saved: false };

    await this.memory.remember({
      userId: input.userId,
      source: input.source,
      summary,
      metadata: {
        kind: "auto-event",
        provenance: "verified-tool-result",
        confidence: "high",
      },
    });
    return { saved: true, summary };
  }

  private async compose(
    userId: string,
    message: string,
    actions: ToolExecutionResult[],
    userFact?: string,
  ): Promise<string | undefined> {
    if (this.llm.hasProvider()) {
      try {
        const basis = [
          actions.map((a) => `- ${a.tool}: ${a.message}`).join("\n"),
          userFact ? `- the principal said: ${userFact}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        const raw = await this.llm.complete({
          task: "memory",
          userId,
          messages: [
            {
              role: "system",
              content:
                "Write ONE concise third-person note (<=15 words) for long-term memory. Factual; no sensitive data (no email bodies, phone numbers, payment amounts, street addresses). If nothing durable is worth keeping, reply exactly NONE.",
            },
            { role: "user", content: `Context:\n${basis || message}` },
          ],
          temperature: 0.2,
        });

        const text = raw?.trim();
        if (!text || /^none\.?$/i.test(text)) return undefined;
        return clip(text);
      } catch (error) {
        logger.warn("auto-memory llm summarize failed; using template", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return template(actions, userFact);
  }
}

function isMemorableAction(result: ToolExecutionResult): boolean {
  if (result.status !== "ok") return false;
  if (MEMORABLE_ACTIONS.has(result.tool)) return true;
  if (result.tool === "gmail_triage" && result.priority === "HIGH") return true;
  return false;
}

function template(
  actions: ToolExecutionResult[],
  userFact?: string,
): string | undefined {
  if (userFact) {
    const cleaned = userFact.replace(
      /^(please\s+)?(remember(\s+that)?|note that|for the record|fyi[:,]?)\s*/i,
      "",
    );
    return clip(cleaned || userFact);
  }

  const action = actions[0];
  if (!action) return undefined;

  if (action.tool === "create_calendar_event") {
    const data = action.data as { event?: { title?: string } } | undefined;
    const title = data?.event?.title;
    return clip(title ? `Scheduled "${title}".` : "Scheduled a calendar event.");
  }
  if (action.tool === "send_email") return "Sent an email reply.";
  return clip(action.message);
}

function clip(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_LEN ? `${trimmed.slice(0, MAX_LEN - 3)}...` : trimmed;
}
