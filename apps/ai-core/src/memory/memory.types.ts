import type {
  HeyRizEventSource,
  SemanticMemoryHit,
} from "../context/context.types";

export type StoredMemory = SemanticMemoryHit & {
  userId: string;
  embedding?: number[];
  metadata?: Record<string, string | number | boolean | null>;
};

export type MemorySearchInput = {
  userId: string;
  query: string;
  limit?: number;
  source?: HeyRizEventSource;
};

export type MemoryWriteInput = {
  userId: string;
  source: HeyRizEventSource;
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export interface MemoryStore {
  search(input: MemorySearchInput): Promise<SemanticMemoryHit[]>;
  remember(input: MemoryWriteInput): Promise<{ id: string }>;
}
