import { Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { chatComplete } from "./openai-compatible";
import type { LlmCompletionInput, LlmCompletionResult, LlmProvider } from "./llm.types";

@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly name = "openai";

  isConfigured() {
    return Boolean(env.OPENAI_API_KEY);
  }

  async complete(input: LlmCompletionInput): Promise<LlmCompletionResult> {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    return chatComplete({
      baseUrl: env.OPENAI_BASE_URL,
      apiKey: env.OPENAI_API_KEY,
      model: input.model ?? env.OPENAI_MODEL,
      messages: input.messages,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });
  }
}
