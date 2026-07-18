import { describe, expect, it } from "vitest";
import { EmailClassifierService } from "./email-classifier.service";

const classifier = new EmailClassifierService({
  hasProvider: () => false,
} as never);

describe("EmailClassifierService fallback rules", () => {
  it.each([
    {
      from: "hirist.com <info@jobfeed.hirist.com>",
      subject: "10+ Jobs Matching Your Profile",
      body: "Interview tips and new jobs selected for you.",
    },
    {
      from: "Y Combinator <workatastartup@ycombinator.com>",
      subject: "Still looking for a job?",
      body: "Apply to 20 jobs from this week's startup job feed.",
    },
    {
      from: "Jonathan at Wonsulting <jonathan+j@wonsulting.com>",
      subject: "The first 100 applicants",
      body: "Join our career coaching campaign.",
    },
  ])("classifies bulk career mail as newsletter: $subject", async (message) => {
    const result = await classifier.classify(message);

    expect(result).toMatchObject({
      category: "newsletter",
      requiresReply: false,
      isMarketing: true,
      suggestedAction: "ignore",
    });
  });

  it("keeps a direct interview request actionable", async () => {
    const result = await classifier.classify({
      from: "Asha Recruiter <asha@example.com>",
      subject: "Interview for Senior AI Engineer",
      body: "Can you meet on Tuesday at 2 PM?",
    });

    expect(result).toMatchObject({
      category: "meeting_request",
      requiresReply: true,
      isMarketing: false,
    });
  });

  it("keeps account-impact alerts above unsubscribe footers", async () => {
    const result = await classifier.classify({
      from: "GoDaddy <donotreply@e.godaddy.com>",
      subject: "Action required: domain expiring",
      body: "Your domain will expire tomorrow. Unsubscribe from product updates.",
    });

    expect(result).toMatchObject({
      category: "account_alert",
      urgency: "urgent",
      riskLevel: "high",
    });
  });
});
