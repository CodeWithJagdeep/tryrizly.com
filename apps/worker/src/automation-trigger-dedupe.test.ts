import { describe, expect, it } from "vitest";
import {
  selectNewGmailTriggerItems,
  shouldPollAutomationFlow,
} from "./automation-trigger-dedupe";

const messages = [
  { id: "gmail-3", subject: "Newest", internalDate: "1784872740000" },
  { id: "gmail-2", subject: "Older", internalDate: "1784872680000" },
  { id: "gmail-1", subject: "Oldest", internalDate: "1784872620000" },
];

describe("Gmail automation trigger deduplication", () => {
  it("uses existing matches as a baseline on the first successful poll", () => {
    expect(
      selectNewGmailTriggerItems(
        messages,
        undefined,
        "2026-07-24T06:00:00.000Z",
      ),
    ).toEqual({
      newItems: [],
      seenIds: ["gmail-3", "gmail-2", "gmail-1"],
      baselineEstablished: true,
    });
  });

  it("delivers unseen messages after the baseline has been persisted", () => {
    expect(
      selectNewGmailTriggerItems(messages, {
        lastPolledAt: "2026-07-24T06:00:00.000Z",
        seenIds: ["gmail-2", "gmail-1"],
      }),
    ).toEqual({
      newItems: [messages[0]],
      seenIds: ["gmail-2", "gmail-1"],
      baselineEstablished: false,
    });
  });

  it("honors a legacy seen-id cursor instead of suppressing a new arrival", () => {
    expect(
      selectNewGmailTriggerItems(messages, {
        seenIds: ["gmail-2", "gmail-1"],
      }),
    ).toMatchObject({
      newItems: [messages[0]],
      baselineEstablished: false,
    });
  });

  it("allows the first message after an empty baseline", () => {
    expect(
      selectNewGmailTriggerItems([{ id: "gmail-new" }], {
        lastPolledAt: "2026-07-24T06:00:00.000Z",
        seenIds: [],
      }),
    ).toMatchObject({
      newItems: [{ id: "gmail-new" }],
      baselineEstablished: false,
    });
  });

  it("does not lose a message received between activation and the first poll", () => {
    const arrivedAfterActivation = {
      id: "gmail-new",
      internalDate: String(Date.parse("2026-07-24T06:00:01.000Z")),
    };

    expect(
      selectNewGmailTriggerItems(
        [arrivedAfterActivation, ...messages],
        undefined,
        "2026-07-24T06:00:00.000Z",
      ),
    ).toEqual({
      newItems: [arrivedAfterActivation],
      seenIds: ["gmail-3", "gmail-2", "gmail-1"],
      baselineEstablished: true,
    });
  });
});

describe("Gmail automation delivery mode", () => {
  it("uses Pub/Sub for active watches and scheduled polling for fallback", () => {
    expect(
      shouldPollAutomationFlow({
        mode: "scheduled",
        triggerApp: "gmail",
        gmailPushActive: true,
      }),
    ).toBe(false);
    expect(
      shouldPollAutomationFlow({
        mode: "gmail-push",
        triggerApp: "gmail",
        gmailPushActive: true,
      }),
    ).toBe(true);
    expect(
      shouldPollAutomationFlow({
        mode: "scheduled",
        triggerApp: "gmail",
        gmailPushActive: false,
      }),
    ).toBe(true);
  });

  it("runs hourly reconciliation only for active Gmail watches", () => {
    expect(
      shouldPollAutomationFlow({
        mode: "reconcile",
        triggerApp: "gmail",
        gmailPushActive: true,
      }),
    ).toBe(true);
    expect(
      shouldPollAutomationFlow({
        mode: "reconcile",
        triggerApp: "gmail",
        gmailPushActive: false,
      }),
    ).toBe(false);
  });

  it("keeps non-Gmail triggers on their normal scheduler", () => {
    expect(
      shouldPollAutomationFlow({
        mode: "scheduled",
        triggerApp: "schedule",
        gmailPushActive: false,
      }),
    ).toBe(true);
    expect(
      shouldPollAutomationFlow({
        mode: "gmail-push",
        triggerApp: "schedule",
        gmailPushActive: false,
      }),
    ).toBe(false);
  });
});
