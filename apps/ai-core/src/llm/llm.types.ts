import type { HeyRizPriority } from "../context/context.types";

export type AgentRole = "system" | "user" | "assistant";

export type AgentMessage = {
  role: AgentRole;
  content: string;
};

/**
 * Logical work tiers the router maps to a (provider, model) pair. Cheap,
 * high-volume tiers (classify/memory/brief) go to small models; accuracy- or
 * reasoning-critical tiers (extract/agent/query) stay on a strong model.
 */
export type LlmTask =
  | "classify"
  | "extract"
  | "draft"
  | "memory"
  | "brief"
  | "agent"
  | "query"
  | "decide";

export type LlmCompletionInput = {
  messages: AgentMessage[];
  /** Explicit model override — wins over the task route's model. */
  model?: string;
  /** Explicit provider override — wins over the task route's provider. Used by the agent loop's tiered model selection. */
  provider?: "grok" | "openai" | "anthropic";
  temperature?: number;
  /** Max output tokens (Anthropic requires it; OpenAI/Grok ignore when unset). */
  maxTokens?: number;
  /** Which routing tier to use; falls back to the default provider if unset. */
  task?: LlmTask;
  /** Who this call is billed to — required for usage-ledger cost tracking. */
  userId?: string;
};

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type LlmCompletionResult = {
  content: string;
  usage?: LlmUsage;
};

export type PriorityClassification = {
  priority: HeyRizPriority;
  reason: string;
  source: "llm" | "rules";
  category?:
    | "critical_action"
    | "direct_action"
    | "useful_update"
    | "bulk_noise"
    | "transactional_noise";
  requiresAction?: boolean;
  confidence?: "high" | "medium" | "low";
};

export interface LlmProvider {
  readonly name: string;
  isConfigured(): boolean;
  /** Returns the assistant message content plus token usage when the API reports it. */
  complete(input: LlmCompletionInput): Promise<LlmCompletionResult>;
}
