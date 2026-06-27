import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@heyriz/shared/env";
import type { LlmCompletionInput, LlmCompletionResult, LlmProvider } from "./llm.types";

const DEFAULT_MAX_TOKENS = 4096;

/**
 * Claude via the official Anthropic SDK (NOT an OpenAI-compatible shim). Used
 * for the cheaper/faster tiers in the model router — claude-haiku-4-5 for
 * drafting, claude-sonnet-4-6 when a task is routed there for stronger results.
 *
 * Only temperature-compatible models (Haiku 4.5 / Sonnet 4.6) are expected here;
 * Opus/Fable reject `temperature` and need adaptive-thinking handling, so the
 * router defaults never point at them.
 */
@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private client?: Anthropic;

  isConfigured() {
    return Boolean(env.ANTHROPIC_API_KEY);
  }

  async complete(input: LlmCompletionInput): Promise<LlmCompletionResult> {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    this.client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const model = input.model ?? env.ANTHROPIC_MODEL;
    // System turns are a top-level param on Anthropic, not messages.
    const system = input.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const convo = input.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Anthropic requires at least one (user-first) message.
    const messages = convo.length
      ? convo
      : [{ role: "user" as const, content: system || "Continue." }];

    const message = await this.client.messages.create({
      model,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: convo.length ? system || undefined : undefined,
      messages,
      // Opus 4.7+/Fable reject temperature; guard so a misrouted model still runs.
      ...(supportsTemperature(model) ? { temperature: input.temperature } : {}),
    });

    const content = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return {
      content,
      usage: message.usage
        ? {
            inputTokens: message.usage.input_tokens ?? 0,
            outputTokens: message.usage.output_tokens ?? 0,
          }
        : undefined,
    };
  }
}

function supportsTemperature(model: string): boolean {
  return !/opus-4-[78]|opus-4-8|fable|mythos/i.test(model);
}
