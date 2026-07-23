import { Inject, Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { billableUsdForAiTask } from "@heyriz/shared/billing/plan-budgets";
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
import {
  assessEmailImportance,
  type EmailImportanceAssessment,
} from "../email/email-importance";

type Route = { provider: string; model?: string };

@Injectable()
export class LlmRouterService {
  private readonly byName: Record<string, LlmProvider>;
  private readonly routes: Record<LlmTask, Route>;

  constructor(
    @Inject(GrokProvider) private readonly grok: GrokProvider,
    @Inject(OpenAiProvider) private readonly openai: OpenAiProvider,
    @Inject(AnthropicProvider) private readonly anthropic: AnthropicProvider,
    @Inject(UsageLedgerService)
    private readonly usageLedger: UsageLedgerService,
  ) {
    this.byName = {
      grok: this.grok,
      openai: this.openai,
      anthropic: this.anthropic,
    };

    // Cost-optimized defaults: everything that doesn't need frontier reasoning
    // runs on grok-3-mini (cheap xAI tier, same key/vendor already trusted with
    // this data — no new provider added for these). Every tier is overridable
    // via LLM_ROUTE_<TASK>="provider:model".
    this.routes = {
      classify: parseRoute(env.LLM_ROUTE_CLASSIFY, {
        provider: "grok",
        model: env.LLM_CLASSIFIER_MODEL || "grok-3-mini",
      }),
      memory: parseRoute(env.LLM_ROUTE_MEMORY, {
        provider: "grok",
        model: "grok-3-mini",
      }),
      brief: parseRoute(env.LLM_ROUTE_BRIEF, {
        provider: "grok",
        model: "grok-3-mini",
      }),
      draft: parseRoute(env.LLM_ROUTE_DRAFT, {
        provider: "anthropic",
        model: "claude-haiku-4-5",
      }),
      extract: parseRoute(env.LLM_ROUTE_EXTRACT, {
        provider: "grok",
        model: "grok-3-mini",
      }),
      agent: parseRoute(env.LLM_ROUTE_AGENT, { provider: "grok" }),
      query: parseRoute(env.LLM_ROUTE_QUERY, {
        provider: "grok",
        model: "grok-3-mini",
      }),
      // Conservative extraction; precision comes from the strict prompt. Bump to
      // anthropic:claude-sonnet-4-6 via LLM_ROUTE_DECIDE if false positives appear.
      decide: parseRoute(env.LLM_ROUTE_DECIDE, {
        provider: "grok",
        model: "grok-3-mini",
      }),
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
  private resolve(
    task?: LlmTask,
  ): { provider: LlmProvider; model?: string } | undefined {
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
    const rawCostUsd = estimateCostUsd(
      resolvedModel,
      inputTokens,
      outputTokens,
    );
    void this.usageLedger.record({
      userId: input.userId,
      task: input.task ?? "agent",
      provider: provider.name,
      model: resolvedModel,
      inputTokens,
      outputTokens,
      costUsd: billableUsdForAiTask(rawCostUsd),
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
    const preview = (input.body ?? input.snippet ?? "").slice(
      0,
      input.body ? 1500 : 200,
    );
    const compact = `From: ${input.from ?? "unknown"}\nSubject: ${
      input.subject ?? "(none)"
    }\nPreview: ${preview}`;
    const assessment = assessEmailImportance(input);

    // These are deliberately narrow, high-confidence overrides. They both
    // reduce classifier cost on obvious noise and prevent a small model from
    // promoting urgency-bait newsletters or suppressing real account threats.
    if (assessment.decisivePriority) {
      return rulesResult(assessment);
    }

    if (resolved) {
      try {
        const messages: AgentMessage[] = [
          {
            role: "system",
            content: [
              "You are a precision-first inbox triage classifier for a busy founder.",
              "Judge the consequence and user-specific action in the email, not the sender's display name or urgency-marketing language.",
              "HIGH requires a concrete, user-specific action plus serious or immediate consequence if missed: security/account compromise, failed or overdue payment, production incident, explicit urgent customer/investor request, or a time-sensitive direct request from a real person.",
              "MEDIUM requires a concrete personal request or useful user-specific update, but no serious immediate consequence.",
              "LOW is the default for bulk or automated mail with no concrete personal action: newsletters, digests, webinars/live sessions, registration campaigns, job feeds, market updates, TOS/privacy updates, receipts, cold outreach, social notifications, and generic deadline marketing.",
              "A person's name in the From header does not prove the email is personal. 'Urgent', 'deadline', 'live', and 'register now' do not prove importance.",
              "Automated security, payment-failure, production, and account-suspension alerts are exceptions and can be HIGH.",
              "When evidence is incomplete, choose the lower priority. Do not use MEDIUM as a catch-all.",
              'Reply ONLY with compact JSON: {"priority":"HIGH|MEDIUM|LOW","category":"critical_action|direct_action|useful_update|bulk_noise|transactional_noise","requiresAction":true|false,"consequenceIfIgnored":"serious|moderate|none","confidence":"high|medium|low","reason":"<=12 words"}',
            ].join("\n"),
          },
          {
            role: "user",
            content: `${compact}\nPolicy signals: ${assessment.evidence.join(", ") || "none"}`,
          },
        ];
        const result = await resolved.provider.complete({
          messages,
          model: resolved.model,
          temperature: 0,
          maxTokens: 160,
        });
        if (input.userId) {
          const model =
            resolved.model ?? defaultModelNameFor(resolved.provider.name);
          const rawCostUsd = estimateCostUsd(
            model,
            result.usage?.inputTokens ?? 0,
            result.usage?.outputTokens ?? 0,
          );
          void this.usageLedger.record({
            userId: input.userId,
            task: "classify",
            provider: resolved.provider.name,
            model,
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
            costUsd: billableUsdForAiTask(rawCostUsd),
          });
        }
        const parsed = extractJson<ModelPriorityOutput>(result.content);
        const priority = normalizePriority(parsed?.priority);
        if (priority) {
          return guardModelPriority(priority, parsed ?? {}, assessment);
        }
      } catch (error) {
        logger.warn("priority classifier llm failed; using rules", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return rulesClassify(assessment);
  }

  /**
   * Honors AI_PROVIDER as a preference when it names a configured provider;
   * otherwise falls through to whichever provider actually has credentials.
   * A route defaulting to an unconfigured vendor (e.g. no Grok key) must
   * still land somewhere usable instead of silently degrading every task
   * that hits this fallback to the rules-only path.
   */
  private getProvider(): LlmProvider | undefined {
    const preferred = env.AI_PROVIDER
      ? this.byName[env.AI_PROVIDER]
      : undefined;
    if (preferred?.isConfigured()) return preferred;

    return [this.anthropic, this.openai, this.grok].find((provider) =>
      provider.isConfigured(),
    );
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

type ModelPriorityOutput = {
  priority?: string;
  category?: string;
  requiresAction?: boolean;
  consequenceIfIgnored?: string;
  confidence?: string;
  reason?: string;
};

function rulesClassify(
  assessment: EmailImportanceAssessment,
): PriorityClassification {
  return {
    priority: assessment.suggestedPriority,
    reason: assessment.reason,
    source: "rules",
    category:
      assessment.suggestedPriority === "LOW"
        ? assessment.isBulk
          ? "bulk_noise"
          : "transactional_noise"
        : assessment.hasDirectRequest
          ? "direct_action"
          : "useful_update",
    requiresAction: assessment.hasDirectRequest || assessment.hasCriticalSignal,
    confidence: assessment.decisivePriority ? "high" : "low",
  };
}

function rulesResult(
  assessment: EmailImportanceAssessment,
): PriorityClassification {
  const priority = assessment.decisivePriority;
  if (!priority) return rulesClassify(assessment);
  return {
    priority,
    reason: assessment.reason,
    source: "rules",
    category:
      priority === "HIGH"
        ? "critical_action"
        : assessment.isBulk
          ? "bulk_noise"
          : "transactional_noise",
    requiresAction: priority === "HIGH",
    confidence: "high",
  };
}

/**
 * The model may reason about ambiguous content, but it cannot grant HIGH to an
 * email without both action and consequence. This asymmetric threshold is what
 * keeps a single flaky classifier call from turning inbox noise into an alert.
 */
function guardModelPriority(
  priority: HeyRizPriority,
  parsed: ModelPriorityOutput,
  assessment: EmailImportanceAssessment,
): PriorityClassification {
  const category = normalizePriorityCategory(parsed.category);
  const consequence = parsed.consequenceIfIgnored?.toLowerCase();
  const requiresAction = parsed.requiresAction === true;
  const modelSaysNoise =
    category === "bulk_noise" || category === "transactional_noise";

  if (!assessment.hasCriticalSignal && (assessment.isBulk || modelSaysNoise)) {
    return {
      priority: "LOW",
      reason: assessment.isBulk
        ? assessment.reason
        : parsed.reason?.trim() ||
          "Bulk or transactional message without action.",
      source: "llm",
      category:
        category ?? (assessment.isBulk ? "bulk_noise" : "transactional_noise"),
      requiresAction: false,
      confidence: normalizeModelConfidence(parsed.confidence),
    };
  }

  if (
    priority === "HIGH" &&
    !assessment.hasCriticalSignal &&
    !(requiresAction && consequence === "serious")
  ) {
    return {
      priority: assessment.hasDirectRequest
        ? "MEDIUM"
        : assessment.suggestedPriority,
      reason: "No concrete action with serious consequence if missed.",
      source: "llm",
      category:
        category ??
        (assessment.hasDirectRequest ? "direct_action" : "useful_update"),
      requiresAction,
      confidence: "medium",
    };
  }

  if (
    priority === "MEDIUM" &&
    assessment.isLikelyAutomated &&
    !requiresAction
  ) {
    return {
      priority: "LOW",
      reason: "Automated message without a concrete personal action.",
      source: "llm",
      category: category ?? "transactional_noise",
      requiresAction: false,
      confidence: normalizeModelConfidence(parsed.confidence),
    };
  }

  return {
    priority,
    reason: parsed.reason?.trim() || "classified by model",
    source: "llm",
    category,
    requiresAction,
    confidence: normalizeModelConfidence(parsed.confidence),
  };
}

function normalizePriorityCategory(
  value?: string,
): PriorityClassification["category"] {
  switch (value) {
    case "critical_action":
    case "direct_action":
    case "useful_update":
    case "bulk_noise":
    case "transactional_noise":
      return value;
    default:
      return undefined;
  }
}

function normalizeModelConfidence(
  value?: string,
): PriorityClassification["confidence"] {
  if (value === "high" || value === "low") return value;
  return "medium";
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
  return {
    provider: trimmed.slice(0, idx).trim(),
    model: trimmed.slice(idx + 1).trim() || undefined,
  };
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
