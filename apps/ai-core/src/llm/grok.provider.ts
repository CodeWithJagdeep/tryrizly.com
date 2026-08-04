import { Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { chatComplete } from "./openai-compatible";
import type { LlmCompletionInput, LlmCompletionResult, LlmProvider } from "./llm.types";

@Injectable()
export class GrokProvider implements LlmProvider {
  readonly name = "grok";

  isConfigured() {
    return Boolean(env.XAI_API_KEY);
  }

  async complete(input: LlmCompletionInput): Promise<LlmCompletionResult> {
    if (!env.XAI_API_KEY) {
      throw new Error("XAI_API_KEY is not configured");
    }

    return chatComplete({
      baseUrl: env.XAI_BASE_URL,
      apiKey: env.XAI_API_KEY,
      model: input.model ?? env.GROK_MODEL,
      messages: input.messages,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      reasoningEffort: input.reasoningEffort,
    });
  }
}
