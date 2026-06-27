import { Inject, Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { BudgetGateService } from "../billing/budget-gate.service";
import type { HeyRizRuntimeContext, LiveContext, LiveScheduleEntry } from "../context/context.types";
import { describeNow, formatEventRange } from "../lib/timezone";
import { LlmRouterService, extractJson } from "../llm/llm-router.service";
import type { AgentMessage } from "../llm/llm.types";
import {
  agentContractInstructions,
  buildOperatorPrompt,
} from "../prompt/operator.prompt";
import { ToolRegistryService } from "../tools/tool-registry.service";
import type { ToolExecutionResult } from "../tools/tool.types";

/**
 * Tiered model selection for the agent loop (the single biggest LLM cost
 * line): start cheap, escalate to the strong tier once a turn proves itself
 * genuinely multi-tool, or once the cheap model's output looks unreliable.
 * Forced to CHEAP regardless of tier logic once the user's AI budget is
 * exceeded for the cycle.
 */
const CHEAP_TIER = "openai" as const;
const STRONG_TIER = "grok" as const;
/** Once this many tools have already run in the turn, treat it as multi-tool. */
const MULTI_TOOL_THRESHOLD = 2;

type AgentStep = {
  thought?: string;
  action?: "tool" | "final";
  tool_name?: string | null;
  tool_input?: Record<string, unknown> | null;
  say?: string | null;
};

export type PendingApproval = {
  tool: string;
  payload: unknown;
  preview: string;
};

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type AgentRunInput = {
  userId: string;
  message: string;
  context: HeyRizRuntimeContext;
  /** A previously-proposed action the principal has now explicitly approved. */
  approval?: { tool: string; payload: unknown };
  /** Recent turns from the same Telegram chat, oldest first. */
  history?: ConversationTurn[];
};

export type AgentRunResult = {
  reply: string;
  provider: string;
  steps: Array<{ tool: string; status: string; message: string }>;
  toolResults: ToolExecutionResult[];
  pendingApproval?: PendingApproval;
};

@Injectable()
export class AgentService {
  constructor(
    @Inject(ToolRegistryService)
    private readonly tools: ToolRegistryService,
    @Inject(LlmRouterService)
    private readonly llm: LlmRouterService,
    @Inject(BudgetGateService)
    private readonly budgetGate: BudgetGateService,
  ) {}

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const provider = this.llm.getActiveProviderName("agent");
    const steps: AgentRunResult["steps"] = [];
    const toolResults: ToolExecutionResult[] = [];

    if (!this.llm.hasProvider("agent")) {
      return this.ruleFallback(input, provider, steps, toolResults);
    }

    const budget = await this.budgetGate.check(input.userId);
    const respond = (result: AgentRunResult): AgentRunResult => this.withBudgetNote(input, budget, result);

    const messages: AgentMessage[] = [
      { role: "system", content: this.systemPrompt(input.context) },
      ...(input.history ?? []).map(
        (turn): AgentMessage => ({ role: turn.role, content: turn.content }),
      ),
      { role: "user", content: input.message },
    ];

    // If the principal just approved a proposed action, run it before reasoning on.
    let toolCallsSoFar = 0;
    if (input.approval) {
      const result = await this.execute(
        input.approval.tool,
        input.approval.payload,
        input,
        { approved: true },
      );
      steps.push(summarize(result));
      toolResults.push(result);
      toolCallsSoFar += 1;
      messages.push({
        role: "user",
        content: `The principal approved "${input.approval.tool}". OBSERVATION: ${stringify(
          result,
        )}`,
      });
    }

    let escalated = false;

    for (let i = 0; i < env.AGENT_MAX_STEPS; i += 1) {
      const tier =
        budget.state === "exceeded"
          ? CHEAP_TIER
          : escalated || toolCallsSoFar >= MULTI_TOOL_THRESHOLD
            ? STRONG_TIER
            : CHEAP_TIER;

      let raw: string | undefined;
      try {
        raw = await this.llm.complete({
          messages,
          temperature: 0.2,
          task: "agent",
          provider: tier,
          userId: input.userId,
        });
      } catch (error) {
        logger.error("agent llm step failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }
      if (!raw) break;

      // The model sometimes keeps generating past its first step — hallucinating
      // its own "OBSERVATION" and further steps in the same completion instead of
      // waiting for a real tool result. extractJson only ever returns the FIRST
      // balanced JSON object, so a genuine, well-formed first step is still safe
      // to act on; whatever fabricated continuation trails after it is discarded.
      const step = extractJson<AgentStep>(raw);
      if (!step) {
        // No parseable step at all. If the unstructured text itself looks like a
        // self-authored tool result (e.g. claiming an email was "sent" without us
        // ever calling send_email), refuse to trust it rather than echoing a
        // possibly-fabricated success claim straight to the principal.
        if (looksLikeFabricatedObservation(raw)) {
          // Low-confidence output from the cheap tier — escalate and retry this
          // exact step on the strong tier before giving up on the turn entirely.
          if (tier === CHEAP_TIER && !escalated) {
            escalated = true;
            continue;
          }
          logger.error("agent emitted unparseable text resembling a fabricated tool observation", {
            raw: raw.slice(0, 800),
          });
          return respond({
            reply: `Something glitched on my end, ${input.context.honorific} — I can't confirm that actually went through. Ask me again and I'll run it for real.`,
            provider,
            steps,
            toolResults,
          });
        }
        // Model answered in prose instead of JSON — accept it as the final word.
        return respond({ reply: raw.trim(), provider, steps, toolResults });
      }

      if (looksLikeFabricatedObservation(raw)) {
        logger.warn("agent kept generating past its first step; discarding the hallucinated continuation", {
          raw: raw.slice(0, 800),
        });
      }

      if (step.action !== "tool" || !step.tool_name) {
        return respond({
          reply: cleanSay(step.say) ?? `Done, ${input.context.honorific}.`,
          provider,
          steps,
          toolResults,
        });
      }

      const tool = this.tools.get(step.tool_name);
      if (!tool) {
        // A model naming a tool that doesn't exist is a reliability signal too —
        // bump to the strong tier for the retry.
        escalated = true;
        messages.push(assistantOf(step));
        messages.push({
          role: "user",
          content: `OBSERVATION: unknown tool "${step.tool_name}". Choose from the available tools.`,
        });
        continue;
      }

      const payload = step.tool_input ?? {};

      // Approval gate: propose, then stop and wait for an explicit "yes".
      if (tool.approvalRequired && !input.approval) {
        const preview = previewFor(
          step.tool_name,
          payload,
          input.context.timezone,
        );
        return respond({
          reply:
            cleanSay(step.say) ??
            `Ready to ${describeAction(step.tool_name)}, ${input.context.honorific}. Shall I proceed?`,
          provider,
          steps,
          toolResults,
          pendingApproval: { tool: step.tool_name, payload, preview },
        });
      }

      const result = await this.execute(step.tool_name, payload, input);
      steps.push(summarize(result));
      toolResults.push(result);
      toolCallsSoFar += 1;
      messages.push(assistantOf(step));
      messages.push({
        role: "user",
        content: `OBSERVATION: ${stringify(result)}`,
      });
    }

    const lastSay = toolResults.at(-1)?.message;
    return respond({
      reply: lastSay
        ? `Here's what I have, ${input.context.honorific}: ${lastSay}`
        : `I wasn't able to finish that one, ${input.context.honorific}.`,
      provider,
      steps,
      toolResults,
    });
  }

  /** Appends a one-time-per-cycle "approaching your AI budget" note when warranted. */
  private withBudgetNote(
    input: AgentRunInput,
    budget: { state: "ok" | "warn" | "exceeded" },
    result: AgentRunResult,
  ): AgentRunResult {
    if (budget.state !== "warn") return result;
    if (!this.budgetGate.consumeWarnOnce(input.userId)) return result;
    return {
      ...result,
      reply: `${result.reply}\n\nYou're at 80% of your AI budget this cycle, ${input.context.honorific}. Background features (decisions, memory, morning brief) will pause once it's used up.`,
    };
  }

  private async execute(
    name: string,
    payload: unknown,
    input: AgentRunInput,
    extra?: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    try {
      return await this.tools.execute({
        name,
        userId: input.userId,
        payload: extra ? { ...(payload as object), ...extra } : payload,
        context: input.context,
      });
    } catch (error) {
      return {
        tool: name,
        status: "not_implemented",
        message: `Tool failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  private systemPrompt(context: HeyRizRuntimeContext): string {
    const toolLines = this.tools
      .list()
      .map(
        (t) =>
          `- ${t.name}${t.approvalRequired ? " (needs approval)" : ""}: ${t.description}`,
      )
      .join("\n");

    const memory =
      context.semantic.length > 0
        ? context.semantic.map((m) => `- ${m.summary}`).join("\n")
        : "- (no relevant memory)";

    const dataSources =
      context.connectedDataSources.length > 0
        ? `Connected business data sources: ${context.connectedDataSources.join(", ")}.`
        : "No business data sources connected.";

    return [
      buildOperatorPrompt(context.honorific, context.language, context.timezoneConfirmed),
      agentContractInstructions,
      `Available tools:\n${toolLines}`,
      `Right now it is ${describeNow(new Date(), context.timezone)} for the principal. Use this exact date/year when resolving any relative or partial date the principal mentions (e.g. "Thursday", "next week", a date with no year) — never assume a year from training data.`,
      renderLive(context.live, context.timezone),
      `Relevant memory (fuzzy recall — NOT authoritative):\n${memory}`,
      dataSources,
    ].join("\n\n");
  }

  /** Deterministic single-shot path when no LLM key is configured. */
  private async ruleFallback(
    input: AgentRunInput,
    provider: string,
    steps: AgentRunResult["steps"],
    toolResults: ToolExecutionResult[],
  ): Promise<AgentRunResult> {
    if (input.approval) {
      const result = await this.execute(
        input.approval.tool,
        input.approval.payload,
        input,
        { approved: true },
      );
      steps.push(summarize(result));
      toolResults.push(result);
      return { reply: result.message, provider, steps, toolResults };
    }

    const choice = ruleSelectTool(input.message);
    if (!choice) {
      return {
        reply: `Standing by, ${input.context.honorific}. Ask me about today's schedule, your inbox, a reminder, or a follow-up.`,
        provider,
        steps,
        toolResults,
      };
    }

    const tool = this.tools.get(choice.name);
    if (tool?.approvalRequired) {
      return {
        reply: `Ready to ${describeAction(choice.name)}, ${input.context.honorific}. Confirm and I'll proceed.`,
        provider,
        steps,
        toolResults,
        pendingApproval: {
          tool: choice.name,
          payload: choice.payload,
          preview: previewFor(
            choice.name,
            choice.payload,
            input.context.timezone,
          ),
        },
      };
    }

    const result = await this.execute(choice.name, choice.payload, input);
    steps.push(summarize(result));
    toolResults.push(result);
    return { reply: result.message, provider, steps, toolResults };
  }
}

/** Renders the live calendar + unread inbox as an authoritative in-prompt block. */
function renderLive(live: LiveContext, timezone: string): string {
  if (!live.connected) {
    return "LIVE calendar & inbox: Google is not connected — for any schedule or mail question, say so (or call connect_google). Do not guess or claim something isn't there.";
  }
  const cal = live.schedule.length
    ? live.schedule.map((e) => `- ${liveScheduleLine(e, timezone)}`).join("\n")
    : "- clear today";
  const inbox = live.unread.length
    ? live.unread.map((m) => `- ${liveFrom(m.from)}: ${m.subject}`).join("\n")
    : "- nothing unread";
  return [
    "LIVE calendar — today (AUTHORITATIVE; trust over Relevant memory for today's schedule). " +
      "An entry marked \"(completed)\" has already finished — never list it as upcoming/open; " +
      "if asked what's left today, only count entries with a time still ahead of now:",
    cal,
    "LIVE unread inbox (AUTHORITATIVE snapshot; subjects only — use read_email_body for contents):",
    inbox,
  ].join("\n");
}

/** Already-finished events are marked "(completed)" so the model never reports a past meeting as still open. */
function liveScheduleLine(e: LiveScheduleEntry, timezone: string): string {
  if (e.allDay) return `all-day ${e.title}`;
  const endMs = Date.parse(e.end ?? e.start ?? "");
  if (!Number.isNaN(endMs) && endMs < Date.now()) {
    return `${e.title} (completed)`;
  }
  return `${liveTime(e.start, timezone)} ${e.title}`;
}

function liveTime(iso: string | undefined, timezone: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function liveFrom(from: string): string {
  const name = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (name) return name[1].trim();
  const email = from.match(/<([^>]+)>/);
  return (email ? email[1] : from).split("@")[0];
}

function ruleSelectTool(
  message: string,
): { name: string; payload: Record<string, unknown> } | undefined {
  const text = message.toLowerCase();
  if (/(schedule|calendar|today|meeting|agenda|brief)/.test(text)) {
    return { name: "calendar_briefing", payload: {} };
  }
  if (/remind/.test(text)) {
    return {
      name: "schedule_reminder",
      payload: {
        message,
        runAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    };
  }
  if (/(inbox|email|gmail|triage)/.test(text)) {
    return { name: "gmail_triage", payload: { message } };
  }
  if (/(remember|recall|what did|note)/.test(text)) {
    return { name: "memory_recall", payload: { query: message } };
  }
  if (/(mrr|revenue|razorpay|metric)/.test(text)) {
    return { name: "business_snapshot", payload: {} };
  }
  return undefined;
}

function summarize(result: ToolExecutionResult) {
  return { tool: result.tool, status: result.status, message: result.message };
}

function assistantOf(step: AgentStep): AgentMessage {
  return { role: "assistant", content: JSON.stringify(step) };
}

/** The only status strings a real ToolExecutionResult can ever carry (see tool.types.ts). */
const VALID_TOOL_STATUSES = new Set([
  "ok",
  "pending_approval",
  "not_implemented",
  "needs_connection",
  "conflict",
]);

/**
 * Detects a model turn that fabricated its own tool result instead of calling a
 * tool and waiting for the real OBSERVATION we push back. Two tells: the literal
 * word "OBSERVATION" (which only ever appears in OUR messages to the model, never
 * in its own output), or a "status" value that isn't one of the real enum members
 * (e.g. "sent", "done", "success" — all things a model invents, none of which this
 * codebase ever returns).
 */
function looksLikeFabricatedObservation(raw: string): boolean {
  if (/\bOBSERVATION\b/.test(raw)) return true;
  const statusRe = /"status"\s*:\s*"([a-zA-Z_]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = statusRe.exec(raw))) {
    if (!VALID_TOOL_STATUSES.has(match[1])) return true;
  }
  return false;
}

function cleanSay(say?: string | null): string | undefined {
  const trimmed = say?.trim();
  return trimmed ? trimmed : undefined;
}

function stringify(result: ToolExecutionResult): string {
  return JSON.stringify({
    tool: result.tool,
    status: result.status,
    message: result.message,
    priority: result.priority,
    data: result.data,
  }).slice(0, 4000);
}

function describeAction(tool: string): string {
  if (tool === "send_email") return "send this email";
  if (tool === "create_calendar_event") return "put this on your calendar";
  if (tool === "reschedule_calendar_event") return "move that event";
  return `run ${tool}`;
}

function previewFor(
  tool: string,
  payload: unknown,
  timezone: string,
): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  if (tool === "send_email") {
    return [
      `To: ${str(p.to)}`,
      `Subject: ${str(p.subject)}`,
      "",
      str(p.body),
    ].join("\n");
  }
  if (tool === "create_calendar_event") {
    const attendees = Array.isArray(p.attendees) ? p.attendees.join(", ") : "";
    return [
      `${str(p.summary)}`,
      formatEventRange(str(p.start), str(p.end), timezone),
      attendees ? `With: ${attendees}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (tool === "reschedule_calendar_event") {
    return [
      `Move to: ${formatEventRange(str(p.newStart), str(p.newEnd), timezone)}`,
      p.notifyAttendee === false ? "" : "They'll be notified of the change.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return JSON.stringify(payload);
}

function str(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}
