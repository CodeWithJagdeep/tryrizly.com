import { Injectable } from "@nestjs/common";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";

type EmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>;
};

/**
 * Turns text into vectors via the OpenAI-compatible embeddings endpoint.
 * When no key is configured it returns null so the memory layer can fall back
 * to keyword scoring — the assistant keeps working without an embeddings key.
 */
@Injectable()
export class EmbeddingsService {
  isAvailable(): boolean {
    return Boolean(env.OPENAI_API_KEY);
  }

  async embed(text: string): Promise<number[] | null> {
    const input = text.trim();
    if (!input || !env.OPENAI_API_KEY) return null;

    try {
      const res = await fetch(`${env.OPENAI_BASE_URL}/embeddings`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: env.EMBEDDINGS_MODEL, input }),
      });

      if (!res.ok) {
        logger.warn("embeddings request failed", { status: res.status });
        return null;
      }

      const data = (await res.json()) as EmbeddingResponse;
      return data.data?.[0]?.embedding ?? null;
    } catch (error) {
      logger.warn("embeddings request errored", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
