import { describe, expect, it, vi } from "vitest";
import { createGmailTriageTool } from "./gmail.tools";
import type { PriorityClassification } from "../llm/llm.types";

describe("gmail_triage result contract", () => {
  it("keeps low-value unread messages out of the notable items collection", async () => {
    const messages = [
      {
        id: "security",
        threadId: "t-security",
        from: "Google <no-reply@accounts.google.com>",
        to: "founder@example.com",
        subject: "Security alert",
        snippet: "A new sign-in was detected.",
        labelIds: ["IMPORTANT"],
      },
      {
        id: "update",
        threadId: "t-update",
        from: "Asha <asha@example.com>",
        to: "founder@example.com",
        subject: "Project update",
        snippet: "Sharing the latest project notes.",
        labelIds: [],
      },
      {
        id: "digest",
        threadId: "t-digest",
        from: "Quora <digest@quora.example>",
        to: "founder@example.com",
        subject: "Your Quora digest",
        snippet: "Recommended stories.",
        labelIds: [],
      },
    ];
    const google = {
      listThreads: vi.fn(async () => ({ connected: true, messages })),
      getMessage: vi.fn(async (_userId: string, id: string) => ({
        connected: true,
        message: {
          ...messages.find((message) => message.id === id)!,
          body:
            id === "security"
              ? "A new sign-in was detected."
              : "Sharing the latest project notes.",
        },
      })),
    };
    const assess = vi.fn(
      async (input: { subject?: string }) => {
        let classification: PriorityClassification;
        if (input.subject === "Security alert") {
          classification = {
            priority: "HIGH",
            reason: "Concrete account security risk.",
            source: "rules",
            category: "critical_action",
            requiresAction: true,
            confidence: "high",
          };
        } else if (input.subject === "Project update") {
          classification = {
            priority: "MEDIUM",
            reason: "Useful personal update.",
            source: "llm",
            category: "useful_update",
            requiresAction: false,
            confidence: "medium",
          };
        } else {
          classification = {
            priority: "LOW",
            reason: "Automated digest.",
            source: "rules",
            category: "bulk_noise",
            requiresAction: false,
            confidence: "high",
          };
        }
        return {
          ...classification,
          cacheStatus: "miss" as const,
          evidenceLevel: input.subject ? ("metadata" as const) : ("body" as const),
          assessedAt: "2026-07-23T00:00:00.000Z",
          policyVersion: "test",
        };
      },
    );
    const assessments = {
      assess,
      assessBatch: vi.fn(async (inputs: Array<{ subject?: string }>) =>
        Promise.all(inputs.map((input) => assess(input))),
      ),
    };
    const tool = createGmailTriageTool(
      google as never,
      assessments as never,
    );

    const result = await tool.execute({
      userId: "user-1",
      payload: {},
      context: { honorific: "sir" } as never,
    });
    const data = result.data as {
      items: Array<{ id: string }>;
      important: Array<{ id: string }>;
      forDigest: Array<{ id: string }>;
      lessImportant: Array<{ id: string }>;
      counts: { high: number; medium: number; low: number };
    };

    expect(result.priority).toBe("HIGH");
    expect(result.message).toContain("Google (Security alert)");
    expect(result.message).not.toContain("Quora digest");
    expect(data.items.map((item) => item.id)).toEqual(["security", "update"]);
    expect(data.important.map((item) => item.id)).toEqual(["security"]);
    expect(data.forDigest.map((item) => item.id)).toEqual(["update"]);
    expect(data.lessImportant.map((item) => item.id)).toEqual(["digest"]);
    expect(data.counts).toEqual({ high: 1, medium: 1, low: 1 });
  });

  it("finds a critical message beyond Gmail-labelled noise before applying the result limit", async () => {
    const messages = [
      {
        id: "gmail-important-noise",
        threadId: "t-noise",
        from: "Digest <digest@example.com>",
        to: "founder@example.com",
        subject: "Weekly digest",
        snippet: "Recommended stories.",
        labelIds: ["STARRED", "IMPORTANT"],
      },
      {
        id: "actual-security-risk",
        threadId: "t-security",
        from: "Google <no-reply@accounts.google.com>",
        to: "founder@example.com",
        subject: "Security alert",
        snippet: "A new sign-in was detected.",
        labelIds: [],
      },
    ];
    const google = {
      listThreads: vi.fn(async () => ({ connected: true, messages })),
      getMessage: vi.fn(async () => ({
        connected: true,
        message: {
          ...messages[1],
          body: "A new sign-in was detected.",
        },
      })),
    };
    const assess = vi.fn(async ({ subject }: { subject?: string }) => {
      const classification =
        subject === "Security alert"
          ? {
              priority: "HIGH",
              reason: "Concrete account security risk.",
              source: "rules",
              category: "critical_action",
              requiresAction: true,
              confidence: "high",
            }
          : {
              priority: "LOW",
              reason: "Automated digest.",
              source: "rules",
              category: "bulk_noise",
              requiresAction: false,
              confidence: "high",
            };
      return {
        ...classification,
        cacheStatus: "miss" as const,
        evidenceLevel: "metadata" as const,
        assessedAt: "2026-07-23T00:00:00.000Z",
        policyVersion: "test",
      };
    });
    const assessments = {
      assess,
      assessBatch: vi.fn(async (inputs: Array<{ subject?: string }>) =>
        Promise.all(inputs.map((input) => assess(input))),
      ),
    };
    const tool = createGmailTriageTool(google as never, assessments as never);

    const result = await tool.execute({
      userId: "user-1",
      payload: { maxResults: 1 },
      context: { honorific: "sir" } as never,
    });
    const data = result.data as {
      important: Array<{ id: string }>;
      reviewedCount: number;
    };

    expect(data.important.map((item) => item.id)).toEqual([
      "actual-security-risk",
    ]);
    expect(data.reviewedCount).toBe(2);
  });
});
