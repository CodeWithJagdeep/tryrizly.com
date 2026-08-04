import { Inject, Injectable } from "@nestjs/common";
import { LlmRouterService } from "../llm/llm-router.service";

const CHEAP_TIER = "grok" as const;
const CHEAP_MODEL = "grok-3-mini";

/** The only status strings a real ToolExecutionResult can carry. */
const VALID_TOOL_STATUSES = new Set([
  "ok",
  "pending_approval",
  "not_implemented",
  "invalid_input",
  "needs_connection",
  "transient_error",
  "forbidden",
  "conflict",
]);

/**
 * A reply that announces an action in progress or about to happen. These are
 * only legitimate alongside a tool step; alone they mean the model stalled.
 */
const PROMISE_RE =
  /\b(?:creating|scheduling|sending|adding|booking|drafting|saving|updating|cancelling|canceling|rescheduling|setting|checking|verifying)\b[^.!?]{0,80}\bnow\b|\b(?:i(?:'|’)?ll|i will|let me|going to)\s+(?:create|schedule|send|add|book|draft|save|update|cancel|reschedule|set|check|verify|look)\b/i;

const CAPABILITY_MISS_RE =
  /\b(?:i (?:do not|don't|cannot|can't) (?:have|access|send|schedule|use|do)|not available to me|unable to access|don't have the ability|outside my capabilities|no tools? (?:available|for))\b/i;

@Injectable()
export class AgentGuardrailService {
  constructor(
    @Inject(LlmRouterService)
    private readonly llm: LlmRouterService,
  ) {}

  /**
   * Detect model-authored tool observations. The deterministic check covers
   * protocol markers and impossible statuses before any model output is used.
   */
  looksLikeFabricatedObservation(raw: string): boolean {
    if (/\bOBSERVATION\b/.test(raw)) return true;
    const statusRe = /"status"\s*:\s*"([a-zA-Z_]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = statusRe.exec(raw))) {
      if (!VALID_TOOL_STATUSES.has(match[1])) return true;
    }
    return false;
  }

  /**
   * Detect a final response that merely promises future work. Regex remains
   * the fast path, but every zero-tool final now reaches the semantic judge;
   * novel wording and long/non-English promises no longer bypass it.
   */
  async isStalledPromise(
    text: string,
    toolsRanThisTurn: number,
    userId: string,
  ): Promise<boolean> {
    if (PROMISE_RE.test(text)) return true;
    if (toolsRanThisTurn > 0) return false;
    return this.saysItIsActing(text, userId);
  }

  looksLikeCapabilityMiss(text: string): boolean {
    return CAPABILITY_MISS_RE.test(text);
  }

  private async saysItIsActing(say: string, userId: string): Promise<boolean> {
    try {
      const verdict = await this.llm.complete({
        messages: [
          {
            role: "user",
            content:
              `An AI assistant ended its turn with the message below without performing any action. ` +
              `Answer exactly YES or NO: does the message claim the assistant is currently performing ` +
              `or about to perform a concrete action (sending, creating, scheduling, checking, etc.), ` +
              `rather than reporting a finished result, answering, or asking the user a question? ` +
              `The message may be in any language.\n\nMessage: ${JSON.stringify(say.slice(0, 4_000))}`,
          },
        ],
        temperature: 0,
        task: "agent",
        provider: CHEAP_TIER,
        model: CHEAP_MODEL,
        reasoningEffort: "low",
        userId,
      });
      return /^\s*yes\b/i.test(verdict ?? "");
    } catch {
      return false;
    }
  }
}
