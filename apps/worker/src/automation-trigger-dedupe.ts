import type { AutomationCursor } from "@heyriz/shared/automations/types";

const MAX_SEEN_TRIGGER_IDS = 200;

export type AutomationPollMode = "scheduled" | "gmail-push" | "reconcile";

export function shouldPollAutomationFlow(input: {
  mode: AutomationPollMode;
  triggerApp: string;
  gmailPushActive: boolean;
}): boolean {
  if (input.triggerApp !== "gmail") return input.mode === "scheduled";
  if (input.mode === "gmail-push") return true;
  if (input.mode === "reconcile") return input.gmailPushActive;
  return !input.gmailPushActive;
}

/**
 * Gmail search returns the most recent messages that match a query, including
 * messages from before an automation was activated. The first successful poll
 * therefore establishes a baseline instead of replaying the inbox.
 *
 * Once lastPolledAt exists, every previously unseen id is a real post-baseline
 * arrival and may be enqueued. A legacy cursor that already has seen ids is
 * also honored even if it predates lastPolledAt.
 */
export function selectNewGmailTriggerItems<
  T extends { id: string; internalDate?: string },
>(
  messages: T[],
  cursor?: AutomationCursor,
  activatedAt?: string,
): {
  newItems: T[];
  seenIds: string[];
  baselineEstablished: boolean;
} {
  const seen = new Set(cursor?.seenIds ?? []);
  const baselineEstablished = !cursor?.lastPolledAt && seen.size === 0;

  if (baselineEstablished) {
    const activationMs = activatedAt ? Date.parse(activatedAt) : Number.NaN;
    const newItems: T[] = [];
    for (const message of messages) {
      const receivedMs = Number(message.internalDate);
      if (
        Number.isFinite(activationMs) &&
        Number.isFinite(receivedMs) &&
        receivedMs >= activationMs
      ) {
        // The message arrived after activation but before the first scheduler
        // tick. Deliver it instead of losing it while establishing the baseline.
        newItems.push(message);
      } else {
        seen.add(message.id);
      }
    }
    return {
      newItems,
      seenIds: [...seen].slice(-MAX_SEEN_TRIGGER_IDS),
      baselineEstablished: true,
    };
  }

  return {
    newItems: messages.filter((message) => !seen.has(message.id)),
    seenIds: [...seen].slice(-MAX_SEEN_TRIGGER_IDS),
    baselineEstablished: false,
  };
}
