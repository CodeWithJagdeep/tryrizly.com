import { Inject, Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { AnthropicProvider } from "./anthropic.provider";
import { GrokProvider } from "./grok.provider";
import { OpenAiProvider } from "./openai.provider";
import { estimateCostUsd } from "./pricing";
import { UsageLedgerService } from "./usage-ledger.service";
import type {
  AgentMessage,
  LlmCompletionInput,
  LlmProvider,
  LlmTask,
  PriorityClassification,
} from "./llm.types";
import type { HeyRizPriority } from "../context/context.types";
import { logger } from "@heyriz/shared/logger";

type Route = { provider: string; model?: string };

@Injectable()
export class LlmRouterService {
  private readonly byName: Record<string, LlmProvider>;
  private readonly routes: Record<LlmTask, Route>;

  constructor(
    @Inject(GrokProvider) private readonly grok: GrokProvider,
    @Inject(OpenAiProvider) private readonly openai: OpenAiProvider,
    @Inject(AnthropicProvider) private readonly anthropic: AnthropicProvider,
    @Inject(UsageLedgerService) private readonly usageLedger: UsageLedgerService,
  ) {
    this.byName = { grok: this.grok, openai: this.openai, anthropic: this.anthropic };

    // Cost-optimized defaults: cheap/high-volume tiers on a small model, and
    // accuracy/reasoning-critical tiers on the proven strong model (grok).
    // Every tier is overridable via LLM_ROUTE_<TASK>="provider:model".
    this.routes = {
      classify: parseRoute(env.LLM_ROUTE_CLASSIFY, {
        provider: "openai",
        model: env.LLM_CLASSIFIER_MODEL || env.OPENAI_MODEL,
      }),
      memory: parseRoute(env.LLM_ROUTE_MEMORY, { provider: "openai", model: env.OPENAI_MODEL }),
      brief: parseRoute(env.LLM_ROUTE_BRIEF, { provider: "openai", model: env.OPENAI_MODEL }),
      draft: parseRoute(env.LLM_ROUTE_DRAFT, { provider: "anthropic", model: "claude-haiku-4-5" }),
      extract: parseRoute(env.LLM_ROUTE_EXTRACT, { provider: "grok" }),
      agent: parseRoute(env.LLM_ROUTE_AGENT, { provider: "grok" }),
      query: parseRoute(env.LLM_ROUTE_QUERY, { provider: "grok" }),
      // Conservative extraction; precision comes from the strict prompt. Bump to
      // anthropic:claude-sonnet-4-6 via LLM_ROUTE_DECIDE if false positives appear.
      decide: parseRoute(env.LLM_ROUTE_DECIDE, { provider: "openai", model: env.OPENAI_MODEL }),
    };
  }

  /**
   * `task` matters: per-task routes (LLM_ROUTE_AGENT etc.) are only consulted
   * here, not in `getProvider()`'s global AI_PROVIDER fallback. Callers that
   * care about a specific tier (the agent loop, in particular) must pass it —
   * otherwise a configured Anthropic/OpenAI/Grok key for that tier is ignored
   * and the caller silently degrades to the rules fallback.
   */
  getActiveProviderName(task?: LlmTask) {
    return this.resolve(task)?.provider.name ?? "rules";
  }

  hasProvider(task?: LlmTask) {
    return Boolean(this.resolve(task));
  }

  async complete(input: LlmCompletionInput): Promise<string | undefined> {
    const resolved = this.resolveForCall(input);
    if (!resolved) return undefined;
    const model = input.model ?? resolved.model;
    const result = await resolved.provider.complete({
      ...input,
      model,
      maxTokens: input.maxTokens ?? defaultMaxTokens(input.task),
    });
    this.logUsage(input, resolved.provider, model, result.usage);
    return result.content;
  }

  /**
   * Honors an explicit per-call provider override (used by the agent loop's
   * tiered model selection) before falling back to the task's normal route.
   */
  private resolveForCall(
    input: LlmCompletionInput,
  ): { provider: LlmProvider; model?: string } | undefined {
    if (input.provider) {
      const provider = this.byName[input.provider];
      if (provider?.isConfigured()) {
        return { provider, model: input.model };
      }
      // Explicit provider not configured — fall through to the task's route.
    }
    return this.resolve(input.task);
  }

  /**
   * Picks the (provider, model) for a task. Uses the task's route when its
   * provider has credentials; otherwise falls back to the default AI_PROVIDER
   * so a missing OpenAI/Anthropic key never breaks a tier.
   */
  private resolve(task?: LlmTask): { provider: LlmProvider; model?: string } | undefined {
    if (task) {
      const route = this.routes[task];
      const provider = this.byName[route.provider];
      if (provider?.isConfigured()) {
        return { provider, model: route.model };
      }
    }
    const fallback = this.getProvider();
    return fallback ? { provider: fallback, model: undefined } : undefined;
  }

  /** Best-effort cost logging — never throws, never blocks the caller. */
  private logUsage(
    input: LlmCompletionInput,
    provider: LlmProvider,
    model: string | undefined,
    usage: { inputTokens: number; outputTokens: number } | undefined,
  ): void {
    if (!input.userId) return;
    const resolvedModel = model ?? defaultModelNameFor(provider.name);
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    void this.usageLedger.record({
      userId: input.userId,
      task: input.task ?? "agent",
      provider: provider.name,
      model: resolvedModel,
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(resolvedModel, inputTokens, outputTokens),
    });
  }

  /**
   * The cheap, fast "nano" path: classify importance from minimal context
   * (subject + sender). Uses a small classifier model when an LLM is configured,
   * and falls back to deterministic keyword rules otherwise.
   */
  async classifyPriority(input: {
    subject?: string;
    from?: string;
    snippet?: string;
    /** Full message body, fetched live (e.g. for a second pass on a HIGH/MEDIUM hit) — never persisted. */
    body?: string;
    userId?: string;
  }): Promise<PriorityClassification> {
    const resolved = this.resolve("classify");
    const preview = (input.body ?? input.snippet ?? "").slice(0, input.body ? 1500 : 200);
    const compact = `From: ${input.from ?? "unknown"}\nSubject: ${
      input.subject ?? "(none)"
    }\nPreview: ${preview}`;

    if (resolved) {
      try {
        const messages: AgentMessage[] = [
          {
            role: "system",
            content: [
              "You triage a founder's inbox. Classify importance as HIGH, MEDIUM, or LOW.",
              "HIGH: investor/customer/founder-critical, meeting request from a real contact, payment failure, production issue, due follow-up on an active deal.",
              "MEDIUM: normal reply from a known contact, non-urgent team update, useful-but-not-urgent news.",
              "LOW: newsletter, automated receipt, cold outreach, social/marketing notification.",
              'Reply with ONLY compact JSON: {"priority":"HIGH|MEDIUM|LOW","reason":"<=12 words"}',
            ].join("\n"),
          },
          { role: "user", content: compact },
        ];
        const result = await resolved.provider.complete({
          messages,
          model: resolved.model,
          temperature: 0,
          maxTokens: 128,
        });
        if (input.userId) {
          const model = resolved.model ?? defaultModelNameFor(resolved.provider.name);
          void this.usageLedger.record({
            userId: input.userId,
            task: "classify",
            provider: resolved.provider.name,
            model,
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
            costUsd: estimateCostUsd(
              model,
              result.usage?.inputTokens ?? 0,
              result.usage?.outputTokens ?? 0,
            ),
          });
        }
        const parsed = extractJson<{ priority?: string; reason?: string }>(result.content);
        const priority = normalizePriority(parsed?.priority);
        if (priority) {
          return {
            priority,
            reason: parsed?.reason?.trim() || "classified by model",
            source: "llm",
          };
        }
      } catch (error) {
        logger.warn("priority classifier llm failed; using rules", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return rulesClassify(compact);
  }

  /**
   * Honors AI_PROVIDER as a preference when it names a configured provider;
   * otherwise falls through to whichever provider actually has credentials.
   * A route defaulting to an unconfigured vendor (e.g. no Grok key) must
   * still land somewhere usable instead of silently degrading every task
   * that hits this fallback to the rules-only path.
   */
  private getProvider(): LlmProvider | undefined {
    const preferred = env.AI_PROVIDER ? this.byName[env.AI_PROVIDER] : undefined;
    if (preferred?.isConfigured()) return preferred;

    return [this.anthropic, this.openai, this.grok].find((provider) => provider.isConfigured());
  }
}

/**
 * Mirrors each provider's own `input.model ?? env.X_MODEL` fallback so the
 * usage ledger logs the model that was ACTUALLY called, even when the route
 * left `model` unset and the provider filled in its env default internally.
 */
function defaultModelNameFor(providerName: string): string {
  switch (providerName) {
    case "grok":
      return env.GROK_MODEL;
    case "openai":
      return env.OPENAI_MODEL;
    case "anthropic":
      return env.ANTHROPIC_MODEL;
    default:
      return "unknown";
  }
}

function rulesClassify(text: string): PriorityClassification {
  const lower = text.toLowerCase();
  const isHigh =
    /investor|urgent|asap|payment failed|failed payment|meeting|invoice overdue|contract|demo/.test(
      lower,
    );
  const isLow = /newsletter|receipt|unsubscribe|no-reply|noreply|promotion|sale/.test(
    lower,
  );
  const priority: HeyRizPriority = isHigh ? "HIGH" : isLow ? "LOW" : "MEDIUM";
  return {
    priority,
    reason: isHigh
      ? "matched high-signal keyword"
      : isLow
        ? "matched low-signal keyword"
        : "no strong signal",
    source: "rules",
  };
}

function normalizePriority(value?: string): HeyRizPriority | undefined {
  const upper = value?.toUpperCase();
  if (upper === "HIGH" || upper === "MEDIUM" || upper === "LOW") {
    return upper;
  }
  return undefined;
}

/** Parses an "LLM_ROUTE_*" value ("provider:model" or "provider") into a route. */
function parseRoute(value: string | undefined, fallback: Route): Route {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  const idx = trimmed.indexOf(":");
  if (idx === -1) return { provider: trimmed };
  return { provider: trimmed.slice(0, idx).trim(), model: trimmed.slice(idx + 1).trim() || undefined };
}

function defaultMaxTokens(task: LlmTask | undefined): number {
  switch (task) {
    case "classify":
      return 128;
    case "memory":
      return 96;
    case "brief":
      return 256;
    case "draft":
      return 600;
    case "decide":
      return 500;
    case "extract":
    case "query":
      return 700;
    case "agent":
    default:
      return 800;
  }
}

export function extractJson<T>(raw: string): T | undefined {
  const fenced = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = fenced.indexOf("{");
  if (start === -1) return undefined;

  // Models sometimes ignore "emit only one JSON object" and keep going —
  // hallucinating an OBSERVATION and further steps after the first one. Take
  // only the first balanced object so that trailing junk never reaches the
  // caller (which otherwise falls back to shipping the raw text to the user).
  const end = matchingBraceEnd(fenced, start);
  if (end === -1) return undefined;

  try {
    return JSON.parse(fenced.slice(start, end + 1)) as T;
  } catch {
    return undefined;
  }
}

/** Returns the index of the `}` that closes the `{` at `start`, or -1. */
function matchingBraceEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}
