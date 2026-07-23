import { describe, expect, it } from "vitest";
import { assessEmailImportance } from "./email-importance";

describe("assessEmailImportance", () => {
  it.each([
    {
      from: "Shruthi <events@training.example>",
      subject: "Shruthi LIVE SDET session",
      body: "Join our free session and reserve your spot.",
    },
    {
      from: "Ananya <notifications@events.example>",
      subject: "Your registration link",
      body: "Registration is open. Save your seat.",
    },
    {
      from: "Indeed <no-reply@indeed.com>",
      subject: "Updates to our Terms of Service",
      body: "Our terms are changing next month.",
    },
    {
      from: "Upstox <updates@upstox.example>",
      subject: "Your daily market update",
      body: "Today's market headlines and watchlist.",
    },
    {
      from: "Quora Digest <digest@quora.example>",
      subject: "Your Quora digest",
      body: "Top stories recommended for you.",
    },
    {
      from: "Rizly <notifications@rizly.example>",
      subject: "You have a new message",
      body: "Someone sent you a message.",
    },
    {
      from: "Neha from ClearTax <neha@updates.cleartax.example>",
      subject: "ITR filing deadline is approaching",
      body: "File with ClearTax today. Unsubscribe or manage email preferences.",
    },
  ])("keeps inbox noise LOW: $subject", (message) => {
    expect(assessEmailImportance(message)).toMatchObject({
      decisivePriority: "LOW",
      suggestedPriority: "LOW",
    });
  });

  it("keeps a concrete security alert HIGH despite an automated sender and footer", () => {
    expect(
      assessEmailImportance({
        from: "Google <no-reply@accounts.google.com>",
        subject: "Security alert",
        body: "A new sign-in was detected on your account. Manage email preferences.",
      }),
    ).toMatchObject({
      decisivePriority: "HIGH",
      suggestedPriority: "HIGH",
      hasCriticalSignal: true,
    });
  });

  it("does not treat a normal human request as bulk mail", () => {
    expect(
      assessEmailImportance({
        from: "Asha Rao <asha@example.com>",
        subject: "Tuesday interview",
        body: "Are you available to meet Tuesday at 2 PM?",
      }),
    ).toMatchObject({
      suggestedPriority: "MEDIUM",
      hasDirectRequest: true,
      isBulk: false,
    });
  });

  it("does not promote urgency words without a concrete risk or personal request", () => {
    expect(
      assessEmailImportance({
        from: "Events <events@conference.example>",
        subject: "Urgent: register today",
        body: "Reserve your spot in our upcoming webinar.",
      }),
    ).toMatchObject({
      decisivePriority: "LOW",
      suggestedPriority: "LOW",
      hasCriticalSignal: false,
    });
  });
});
