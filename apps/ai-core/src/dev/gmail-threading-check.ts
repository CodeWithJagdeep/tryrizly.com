import type { GoogleService } from "../google/google.service";
import type { HeyRizRuntimeContext } from "../context/context.types";
import { DraftCacheService } from "../tools/draft-cache.service";
import { createSendEmailTool } from "../tools/gmail.tools";

const context: HeyRizRuntimeContext = {
  userId: "u1",
  source: "telegram",
  structured: { activeDeals: [], preferences: [], pendingStates: [] },
  semantic: [],
  live: { connected: false, schedule: [], unread: [] },
  honorific: "sir",
  timezone: "UTC",
  timezoneConfirmed: true,
  connectedDataSources: [],
};

async function main() {
  const checks: Array<[string, boolean]> = [];

  // The bug this guards against: a model that drops threadId/inReplyTo when
  // proposing send_email must still produce a threaded reply, not a fresh
  // email, because DraftCacheService backfills them from the last draft.
  {
    let sentThreadId: string | undefined;
    let sentInReplyTo: string | undefined;
    const fakeGoogle = {
      sendMessage: async (_userId: string, input: { threadId?: string; inReplyTo?: string }) => {
        sentThreadId = input.threadId;
        sentInReplyTo = input.inReplyTo;
        return { connected: true as const, messageId: "m2", threadId: input.threadId };
      },
    } as unknown as GoogleService;

    const draftCache = new DraftCacheService();
    draftCache.set("u1", {
      to: "Naman <naman@example.com>",
      subject: "Re: Sync",
      body: "Works for me.",
      threadId: "t1",
      inReplyTo: "<orig@mail.gmail.com>",
    });

    const tool = createSendEmailTool(fakeGoogle, draftCache);
    await tool.execute({
      userId: "u1",
      payload: {
        to: "naman@example.com",
        subject: "Re: Sync",
        body: "Works for me.",
        approved: true,
        // threadId/inReplyTo deliberately omitted, as a model would if it forgot.
      },
      context,
    });

    checks.push(["dropped threadId recovered from cache", sentThreadId === "t1"]);
    checks.push(["dropped inReplyTo recovered from cache", sentInReplyTo === "<orig@mail.gmail.com>"]);
  }

  // A model-supplied threadId/inReplyTo is trusted as-is, cache is not consulted.
  {
    let sentThreadId: string | undefined;
    const fakeGoogle = {
      sendMessage: async (_userId: string, input: { threadId?: string }) => {
        sentThreadId = input.threadId;
        return { connected: true as const, messageId: "m3", threadId: input.threadId };
      },
    } as unknown as GoogleService;

    const draftCache = new DraftCacheService();
    draftCache.set("u1", {
      to: "naman@example.com",
      subject: "Re: Sync",
      body: "Works for me.",
      threadId: "stale-thread",
    });

    const tool = createSendEmailTool(fakeGoogle, draftCache);
    await tool.execute({
      userId: "u1",
      payload: {
        to: "naman@example.com",
        subject: "Re: Sync",
        body: "Works for me.",
        threadId: "t-explicit",
        approved: true,
      },
      context,
    });

    checks.push(["explicit threadId not overridden by cache", sentThreadId === "t-explicit"]);
  }

  // A draft to a different recipient must never leak its threadId onto an
  // unrelated send for someone else.
  {
    let sentThreadId: string | undefined;
    const fakeGoogle = {
      sendMessage: async (_userId: string, input: { threadId?: string }) => {
        sentThreadId = input.threadId;
        return { connected: true as const, messageId: "m4", threadId: input.threadId };
      },
    } as unknown as GoogleService;

    const draftCache = new DraftCacheService();
    draftCache.set("u1", {
      to: "naman@example.com",
      subject: "Re: Sync",
      body: "Works for me.",
      threadId: "naman-thread",
    });

    const tool = createSendEmailTool(fakeGoogle, draftCache);
    await tool.execute({
      userId: "u1",
      payload: {
        to: "someone-else@example.com",
        subject: "New intro",
        body: "Hi there.",
        approved: true,
      },
      context,
    });

    checks.push(["unrelated recipient does not inherit cached threadId", sentThreadId === undefined]);
  }

  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
    if (!pass) ok = false;
  }
  console.log(ok ? "GMAIL_THREADING_CHECK_OK" : "GMAIL_THREADING_CHECK_FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("GMAIL_THREADING_CHECK_FAIL", e);
  process.exit(1);
});
