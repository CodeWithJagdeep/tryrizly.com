import type { AgentMessage, LlmCompletionResult } from "./llm.types";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/**
 * Minimal client for any OpenAI-compatible `/chat/completions` endpoint.
 * Both xAI (Grok) and OpenAI expose this exact shape, so the two providers
 * are thin wrappers around this single call.
 */
export async function chatComplete(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: AgentMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<LlmCompletionResult> {
  const response = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${opts.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature ?? 0.2,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      messages: opts.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `llm request failed: ${response.status} ${errorText.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("llm returned no content");
  }

  return {
    content,
    usage: data.usage
      ? {
          inputTokens: data.usage.prompt_tokens ?? 0,
          outputTokens: data.usage.completion_tokens ?? 0,
        }
      : undefined,
  };
}
