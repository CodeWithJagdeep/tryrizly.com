import type { GoogleService } from "../google/google.service";
import type { HeyRizTool } from "./tool.types";
import { enqueueWatchReply } from "@heyriz/shared/queue/watch-replies";

const HOUR = 3_600_000;
const MIN_DELAY_MS = 5 * 60_000;

type WatchForReplyPayload = {
  threadId?: string;
  reason?: string;
  windowHours?: number;
  maxAttempts?: number;
};

export function createWatchForReplyTool(
  google: GoogleService,
): HeyRizTool<WatchForReplyPayload> {
  return {
    name: "watch_for_reply",
    category: "gmail",
    description:
      "Internally watch a Gmail thread for a reply and nudge the principal later if none arrives. No external email is sent.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      if (!payload.threadId) {
        return {
          tool: "watch_for_reply",
          status: "not_implemented",
          message: `I need the Gmail threadId before I can watch for a reply, ${context.honorific}.`,
        };
      }

      const thread = await google.getThreadMessages(userId, payload.threadId);
      if (!thread.connected) {
        return {
          tool: "watch_for_reply",
          status: "needs_connection",
          message: `Google not connected. NEXT STEP: call the connect_google tool immediately to send ${context.honorific} a direct sign-in link.`,
        };
      }

      const maxAttempts = clampInt(payload.maxAttempts ?? 4, 1, 12);
      const windowHours = clampNumber(payload.windowHours ?? 4, 0.25, 72);
      const totalWindowMs = windowHours * HOUR;
      const firstDelayMs = Math.max(
        MIN_DELAY_MS,
        Math.floor(totalWindowMs / (2 ** maxAttempts - 1)),
      );
      const reason = payload.reason?.trim();
      const fallbackMessage =
        reason && reason.length > 0
          ? `No reply yet on ${reason}, ${context.honorific}. Want me to follow up?`
          : `No reply yet on that email thread, ${context.honorific}. Want me to follow up?`;

      const scheduled = await enqueueWatchReply({
        userId,
        threadId: payload.threadId,
        baselineMessageCount: thread.messages.length,
        fallbackMessage,
        reason,
        attempt: 1,
        maxAttempts,
        nextDelayMs: firstDelayMs,
        delayMs: firstDelayMs,
      });

      return {
        tool: "watch_for_reply",
        status: "ok",
        message: `I'll watch that thread for a reply, ${context.honorific}.`,
        data: {
          scheduled,
          baselineMessageCount: thread.messages.length,
          windowHours,
          maxAttempts,
        },
      };
    },
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
