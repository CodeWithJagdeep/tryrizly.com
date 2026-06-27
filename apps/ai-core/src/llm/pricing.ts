import { logger } from "@heyriz/shared/logger";

/**
 * USD per 1M tokens. Keep this in step with the provider's published pricing —
 * there's no API to fetch it live. An unmodeled model logs a warning and costs
 * $0 rather than silently throwing, so a routing change never breaks the
 * actual LLM call over a missing price entry.
 */
const PRICE_PER_1M: Record<string, { input: number; output: number }> = {
  "grok-4.3": { input: 1.25, output: 2.5 },
  "grok-4.20": { input: 2, output: 6 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICE_PER_1M[model];
  if (!price) {
    logger.warn("llm pricing: no rate for model, costing $0 in usage ledger", { model });
    return 0;
  }
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}
