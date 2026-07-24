import { describe, expect, it, vi } from "vitest";
import {
  EMAIL_ASSESSMENT_POLICY_VERSION,
  EmailAssessmentService,
} from "./email-assessment.service";
import type { StoredEmailAssessment } from "./email-assessment.repository";

function stored(
  messageId: string,
  evidenceLevel: "metadata" | "body" = "body",
): StoredEmailAssessment {
  return {
    userId: "user-1",
    messageId,
    policyVersion: EMAIL_ASSESSMENT_POLICY_VERSION,
    classification: {
      priority: "LOW",
      reason: "Previously classified noise.",
      source: "rules",
      category: "bulk_noise",
      requiresAction: false,
      confidence: "high",
    },
    evidenceLevel,
    origin: "background",
    assessedAt: "2026-07-23T00:00:00.000Z",
    expiresAt: "2026-08-23T00:00:00.000Z",
  };
}

describe("EmailAssessmentService", () => {
  it("joins a batch against cached worker assessments and computes only misses", async () => {
    const cached = stored("cached");
    const repository = {
      getMany: vi.fn(async () => new Map([["cached", cached]])),
      put: vi.fn(async () => undefined),
      withMessageLock: vi.fn(
        async (
          _userId: string,
          _messageId: string,
          task: () => Promise<unknown>,
        ) => task(),
      ),
    };
    const llm = {
      classifyPriority: vi.fn(async () => ({
        priority: "HIGH" as const,
        reason: "New security alert.",
        source: "rules" as const,
        category: "critical_action" as const,
        requiresAction: true,
        confidence: "high" as const,
      })),
    };
    const service = new EmailAssessmentService(
      repository as never,
      llm as never,
    );

    const results = await service.assessBatch([
      {
        userId: "user-1",
        messageId: "cached",
        subject: "Weekly digest",
        origin: "interactive",
      },
      {
        userId: "user-1",
        messageId: "new",
        subject: "Security alert",
        origin: "interactive",
      },
    ]);

    expect(results).toEqual([
      expect.objectContaining({ priority: "LOW", cacheStatus: "hit" }),
      expect.objectContaining({ priority: "HIGH", cacheStatus: "miss" }),
    ]);
    // One batch join plus one lock-protected recheck for the cache miss.
    expect(repository.getMany).toHaveBeenCalledTimes(2);
    expect(llm.classifyPriority).toHaveBeenCalledOnce();
    expect(repository.put).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "new",
        evidenceLevel: "metadata",
        policyVersion: EMAIL_ASSESSMENT_POLICY_VERSION,
      }),
    );
  });

  it("upgrades a metadata-only cache entry when a full body is available", async () => {
    const repository = {
      getMany: vi.fn(
        async () => new Map([["message-1", stored("message-1", "metadata")]]),
      ),
      put: vi.fn(async () => undefined),
      withMessageLock: vi.fn(
        async (
          _userId: string,
          _messageId: string,
          task: () => Promise<unknown>,
        ) => task(),
      ),
    };
    const llm = {
      classifyPriority: vi.fn(async () => ({
        priority: "LOW" as const,
        reason: "Body confirms a newsletter.",
        source: "rules" as const,
      })),
    };
    const service = new EmailAssessmentService(
      repository as never,
      llm as never,
    );

    const result = await service.assess({
      userId: "user-1",
      messageId: "message-1",
      subject: "Update",
      body: "Unsubscribe from this newsletter.",
      origin: "interactive",
    });

    expect(result).toMatchObject({
      cacheStatus: "miss",
      evidenceLevel: "body",
      priority: "LOW",
    });
    expect(llm.classifyPriority).toHaveBeenCalledOnce();
    expect(repository.put).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-1",
        evidenceLevel: "body",
      }),
    );
  });

  it("reuses a body-backed worker decision for interactive metadata triage", async () => {
    const repository = {
      getMany: vi.fn(
        async () => new Map([["message-1", stored("message-1", "body")]]),
      ),
      put: vi.fn(),
      withMessageLock: vi.fn(
        async (
          _userId: string,
          _messageId: string,
          task: () => Promise<unknown>,
        ) => task(),
      ),
    };
    const llm = { classifyPriority: vi.fn() };
    const service = new EmailAssessmentService(
      repository as never,
      llm as never,
    );

    const result = await service.assess({
      userId: "user-1",
      messageId: "message-1",
      subject: "Weekly digest",
      snippet: "Recommended stories.",
      origin: "interactive",
    });

    expect(result).toMatchObject({
      cacheStatus: "hit",
      evidenceLevel: "body",
      priority: "LOW",
    });
    expect(llm.classifyPriority).not.toHaveBeenCalled();
    expect(repository.put).not.toHaveBeenCalled();
  });

  it("single-flights concurrent cache misses so replicas share one decision", async () => {
    let cached: StoredEmailAssessment | undefined;
    let lock = Promise.resolve();
    const repository = {
      getMany: vi.fn(
        async () => new Map(cached ? [["message-1", cached]] : []),
      ),
      put: vi.fn(async (record: StoredEmailAssessment) => {
        cached = record;
      }),
      withMessageLock: vi.fn(
        async (
          _userId: string,
          _messageId: string,
          task: () => Promise<unknown>,
        ) => {
          const previous = lock;
          let release!: () => void;
          lock = new Promise<void>((resolve) => {
            release = resolve;
          });
          await previous;
          try {
            return await task();
          } finally {
            release();
          }
        },
      ),
    };
    const llm = {
      classifyPriority: vi.fn(async () => ({
        priority: "MEDIUM" as const,
        reason: "Needs review.",
        source: "model" as const,
      })),
    };
    const service = new EmailAssessmentService(
      repository as never,
      llm as never,
    );
    const input = {
      userId: "user-1",
      messageId: "message-1",
      subject: "Question",
      origin: "interactive" as const,
    };

    const [first, second] = await Promise.all([
      service.assess(input),
      service.assess(input),
    ]);

    expect(first.cacheStatus).toBe("miss");
    expect(second.cacheStatus).toBe("hit");
    expect(llm.classifyPriority).toHaveBeenCalledOnce();
  });
});
