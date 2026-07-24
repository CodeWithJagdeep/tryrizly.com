import { describe, expect, it, vi } from "vitest";
import { of } from "rxjs";
import type { GmailPushJobData } from "@heyriz/shared/queue/types";
import { GmailPushWorkerService } from "./gmail-push.worker.service";

const job: GmailPushJobData = {
  userId: "user-1",
  accountId: "gmail-account-1",
  emailAddress: "owner@example.com",
  historyId: "120",
  pubsubMessageId: "pubsub-1",
};

function serviceWithResult(result: Record<string, unknown>) {
  const scheduler = {
    dispatchGmailAutomationsFromPush: vi.fn().mockResolvedValue(undefined),
  };
  const service = new GmailPushWorkerService(scheduler as never);
  const send = vi.fn().mockReturnValue(of(result));
  Object.assign(service as unknown as { aiCore: unknown }, {
    aiCore: { send, close: vi.fn() },
  });
  return { service, scheduler, send };
}

describe("GmailPushWorkerService automation fan-out", () => {
  it("wakes Gmail automations immediately after mailbox history is processed", async () => {
    const { service, scheduler, send } = serviceWithResult({
      handled: true,
      enqueued: 1,
    });

    await expect(service.processPush(job)).resolves.toMatchObject({
      handled: true,
      enqueued: 1,
    });
    expect(send).toHaveBeenCalledWith("gmail.push.process", job);
    expect(scheduler.dispatchGmailAutomationsFromPush).toHaveBeenCalledWith(
      "user-1",
    );
  });

  it("retries automation dispatch safely after a stale duplicate notification", async () => {
    const { service, scheduler } = serviceWithResult({
      handled: false,
      reason: "stale",
    });

    await service.processPush(job);

    expect(scheduler.dispatchGmailAutomationsFromPush).toHaveBeenCalledWith(
      "user-1",
    );
  });

  it("does not dispatch for a disconnected or disabled account", async () => {
    const { service, scheduler } = serviceWithResult({
      handled: false,
      reason: "disabled",
    });

    await service.processPush(job);

    expect(scheduler.dispatchGmailAutomationsFromPush).not.toHaveBeenCalled();
  });
});
