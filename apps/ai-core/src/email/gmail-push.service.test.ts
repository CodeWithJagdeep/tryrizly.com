import { beforeEach, describe, expect, it, vi } from "vitest";

const queueMocks = vi.hoisted(() => ({
  enqueueEmailEvent: vi.fn(async () => ({ jobId: "email-job" })),
  enqueueGmailPush: vi.fn(async () => ({ jobId: "push-job" })),
}));

vi.mock("@heyriz/shared/queue/email-events", () => ({
  enqueueEmailEvent: queueMocks.enqueueEmailEvent,
}));
vi.mock("@heyriz/shared/queue/gmail-push", () => ({
  enqueueGmailPush: queueMocks.enqueueGmailPush,
}));

import { GmailPushService } from "./gmail-push.service";

const account = {
  id: "account-1",
  userId: "user-1",
  provider: "gmail",
  status: "connected",
  metadata: {
    accountEmail: "user@example.com",
    gmailWatchHistoryId: "100",
  },
};

function dependencies() {
  const connectors = {
    findById: vi.fn(async () => account),
    findAll: vi.fn(async () => [account]),
    findGmailAccountsByEmail: vi.fn(async () => [account]),
    advanceGmailHistoryCursor: vi.fn(async () => true),
    recordGmailWatch: vi.fn(async () => true),
  };
  const google = {
    listHistory: vi.fn(async () => ({
      connected: true,
      history: {
        messageIds: ["message-1", "message-2"],
        historyId: "125",
        historyExpired: false,
      },
    })),
    listThreads: vi.fn(),
    getMessage: vi
      .fn()
      .mockResolvedValueOnce({
        connected: true,
        message: {
          id: "message-1",
          threadId: "thread-1",
          from: "Security <security@example.com>",
          subject: "Security alert",
          snippet: "New sign-in.",
          labelIds: ["INBOX", "UNREAD"],
        },
      })
      .mockResolvedValueOnce({
        connected: true,
        message: {
          id: "message-2",
          threadId: "thread-2",
          from: "Archive <archive@example.com>",
          subject: "Already read",
          snippet: "Old.",
          labelIds: ["INBOX"],
        },
      }),
    watchMailbox: vi.fn(),
  };
  const service = new GmailPushService(connectors as never, google as never);
  return { service, connectors, google };
}

describe("GmailPushService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueMocks.enqueueEmailEvent.mockResolvedValue({ jobId: "email-job" });
  });

  it("queues only unread inbox additions and advances the cursor afterward", async () => {
    const deps = dependencies();

    await expect(
      deps.service.process({
        userId: "user-1",
        accountId: "account-1",
        emailAddress: "user@example.com",
        historyId: "120",
        pubsubMessageId: "pubsub-1",
      }),
    ).resolves.toEqual({
      handled: true,
      enqueued: 1,
      fallback: false,
    });

    expect(queueMocks.enqueueEmailEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "account-1",
        messageId: "message-1",
        source: "push",
      }),
    );
    expect(deps.connectors.advanceGmailHistoryCursor).toHaveBeenCalledWith(
      "account-1",
      "user-1",
      "125",
    );
    expect(
      queueMocks.enqueueEmailEvent.mock.invocationCallOrder[0],
    ).toBeLessThan(
      deps.connectors.advanceGmailHistoryCursor.mock.invocationCallOrder[0],
    );
  });

  it("does not advance history when downstream queueing fails", async () => {
    const deps = dependencies();
    queueMocks.enqueueEmailEvent.mockRejectedValueOnce(
      new Error("redis_unavailable"),
    );

    await expect(
      deps.service.process({
        userId: "user-1",
        accountId: "account-1",
        emailAddress: "user@example.com",
        historyId: "120",
        pubsubMessageId: "pubsub-1",
      }),
    ).rejects.toThrow("redis_unavailable");
    expect(deps.connectors.advanceGmailHistoryCursor).not.toHaveBeenCalled();
  });

  it("drops an out-of-order notification without reading Gmail again", async () => {
    const deps = dependencies();

    await expect(
      deps.service.process({
        userId: "user-1",
        accountId: "account-1",
        emailAddress: "user@example.com",
        historyId: "99",
        pubsubMessageId: "pubsub-old",
      }),
    ).resolves.toEqual({ handled: false, reason: "stale" });
    expect(deps.google.listHistory).not.toHaveBeenCalled();
    expect(queueMocks.enqueueEmailEvent).not.toHaveBeenCalled();
  });

  it("fans an authenticated mailbox notification into durable account jobs", async () => {
    const deps = dependencies();

    await expect(
      deps.service.enqueueNotification({
        emailAddress: "user@example.com",
        historyId: "120",
        pubsubMessageId: "pubsub-1",
      }),
    ).resolves.toEqual({ matched: 1, queued: 1 });
    expect(queueMocks.enqueueGmailPush).toHaveBeenCalledWith({
      userId: "user-1",
      accountId: "account-1",
      emailAddress: "user@example.com",
      historyId: "120",
      pubsubMessageId: "pubsub-1",
    });
  });
});
