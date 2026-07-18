import { VectorMemoryService } from "../memory/vector-memory.service";
import type { HeyRizEventSource } from "../context/context.types";
import type { HeyRizTool } from "./tool.types";

type MemoryRecallPayload = {
  query?: string;
};

type RememberFactPayload = {
  text?: string;
  summary?: string;
  source?: HeyRizEventSource;
};

export function createMemoryRecallTool(
  vectorMemory: VectorMemoryService,
): HeyRizTool<MemoryRecallPayload> {
  return {
    name: "memory_recall",
    category: "memory",
    description:
      "Search vector memory for summaries/topics, then fetch sensitive source data live if needed.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload }) {
      const query = payload.query?.trim();

      if (!query) {
        return {
          tool: "memory_recall",
          status: "ok",
          message: "No memory query provided.",
          data: [],
        };
      }

      const hits = await vectorMemory.search({
        userId,
        query,
        limit: 5,
      });

      return {
        tool: "memory_recall",
        status: "ok",
        message:
          hits.length > 0
            ? "Relevant memory summaries found."
            : "No relevant memory summaries found.",
        data: hits,
      };
    },
  };
}

export function createRememberFactTool(
  vectorMemory: VectorMemoryService,
): HeyRizTool<RememberFactPayload> {
  return {
    name: "remember_fact",
    category: "memory",
    description:
      "Save a short, durable, non-sensitive fact or summary to long-term memory (preferences, decisions, who-is-who, context worth recalling later). Stored with a timestamp and recalled only when relevant.",
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      const text = (payload.summary ?? payload.text)?.trim();
      if (!text) {
        return {
          tool: "remember_fact",
          status: "not_implemented",
          message: `Nothing to store, ${context.honorific} — give me the fact to remember.`,
        };
      }

      const { id } = await vectorMemory.remember({
        userId,
        source: payload.source ?? "telegram",
        summary: text,
        metadata: {
          kind: "explicit-fact",
          provenance: "principal",
          confidence: "high",
        },
      });

      return {
        tool: "remember_fact",
        status: "ok",
        message: `Noted, ${context.honorific} — I'll remember that.`,
        data: { id },
      };
    },
  };
}
