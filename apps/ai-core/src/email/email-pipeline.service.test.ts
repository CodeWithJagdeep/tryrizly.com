import { beforeEach, describe, expect, it, vi } from "vitest";

const queueMocks = vi.hoisted(() => ({
  enqueueNotification: vi.fn(async () => undefined),
  enqueueReminder: vi.fn(async () => undefined),
  enqueueSpineIngest: vi.fn(async () => undefined),
  enqueueWatchReply: vi.fn(async () => undefined),
  addPendingEmailAction: vi.fn(async () => undefined),
  appendActionAudit: vi.fn(async () => undefined),
}));

vi.mock("@heyriz/shared/queue/queues", () => ({
  enqueueNotification: queueMocks.enqueueNotification,
  enqueueReminder: queueMocks.enqueueReminder,
}));
vi.mock("@heyriz/shared/queue/spine", () => ({
  enqueueSpineIngest: queueMocks.enqueueSpineIngest,
}));
vi.mock("@heyriz/shared/queue/watch-replies", () => ({
  enqueueWatchReply: queueMocks.enqueueWatchReply,
}));
vi.mock("@heyriz/shared/queue/pending-actions", () => ({
  addPendingEmailAction: queueMocks.addPendingEmailAction,
}));
vi.mock("@heyriz/shared/action-audit", () => ({
  appendActionAudit: queueMocks.appendActionAudit,
}));

import { EmailPipelineService } from "./email-pipeline.service";

const input = {
  userId: "user-1",
  messageId: "message-1",
  threadId: "thread-1",
  from: "Sender <sender@example.com>",
  subject: "Status update",
  snippet: "A short update.",
};

function dependencies() {
  const google = {
    getMessage: vi.fn(async () => ({
      connected: true,
      message: { body: "Full message body.", cc: undefined },
    })),
  };
  const availability = {};
  const classifier = {
    isOtp: vi.fn(() => false),
    lowPriorityFacts: vi.fn(() => ({
      priority: "LOW",
      priorityReason: "Cached noise.",
      prioritySource: "rules",
      category: "general_low",
      summary: "Low-priority update.",
      confidence: "high",
      suggestedAction: "ignore",
    })),
    classify: vi.fn(),
  };
  const assessments = {
    assess: vi.fn(),
  };
  const emailPrefs = { get: vi.fn(async () => undefined) };
  const userPrefs = {
    getTimezone: vi.fn(async () => "UTC"),
    getAwayUntil: vi.fn(async () => undefined),
    getHonorific: vi.fn(async () => "sir"),
  };
  const memory = { remember: vi.fn(async () => ({ id: "memory-1" })) };
  const pipeline = new EmailPipelineService(
    google as never,
    availability as never,
    classifier as never,
    assessments as never,
    emailPrefs as never,
    userPrefs as never,
    memory as never,
  );
  return {
    pipeline,
    google,
    classifier,
    assessments,
    emailPrefs,
    userPrefs,
    memory,
  };
}

describe("EmailPipelineService canonical importance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a canonical LOW assessment without invoking the rival extraction classifier", async () => {
    const deps = dependencies();
    deps.assessments.assess.mockResolvedValue({
      priority: "LOW",
      reason: "Cached noise.",
      source: "rules",
      category: "bulk_noise",
      cacheStatus: "hit",
      evidenceLevel: "body",
      assessedAt: "2026-07-23T00:00:00.000Z",
      policyVersion: "test",
    });

    const result = await deps.pipeline.process(input);

    expect(result).toMatchObject({
      handled: "ignored",
      notificationSent: false,
      facts: {
        priority: "LOW",
        category: "general_low",
      },
    });
    expect(deps.classifier.classify).not.toHaveBeenCalled();
    expect(deps.classifier.lowPriorityFacts).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Full message body." }),
      expect.objectContaining({ priority: "LOW" }),
    );
    expect(queueMocks.enqueueNotification).not.toHaveBeenCalled();
  });

  it("does not let rich extraction downgrade a canonical HIGH assessment", async () => {
    const deps = dependencies();
    deps.assessments.assess.mockResolvedValue({
      priority: "HIGH",
      reason: "Concrete security risk.",
      source: "rules",
      category: "critical_action",
      requiresAction: true,
      cacheStatus: "hit",
      evidenceLevel: "body",
      assessedAt: "2026-07-23T00:00:00.000Z",
      policyVersion: "test",
    });
    deps.classifier.classify.mockResolvedValue({
      category: "newsletter",
      summary: "Security notice.",
      confidence: "medium",
      suggestedAction: "ignore",
      urgency: "low",
      riskLevel: "low",
      isMarketing: true,
      replyIntent: "ignore",
    });

    const result = await deps.pipeline.process(input);

    expect(result).toMatchObject({
      handled: "ask",
      notificationSent: true,
      facts: {
        priority: "HIGH",
        category: "general_high",
        suggestedAction: "review_manually",
        riskLevel: "high",
        isMarketing: false,
      },
    });
    expect(queueMocks.enqueueNotification).toHaveBeenCalledOnce();
  });
});
