import { describe, expect, it } from "vitest";
import type { HeyRizRuntimeContext } from "../context/context.types";
import { AgentSkillRegistryService } from "../skills/agent-skill-registry.service";
import { PromptAssemblerService } from "./prompt-assembler.service";

const context: HeyRizRuntimeContext = {
  userId: "u1",
  source: "telegram",
  structured: { activeDeals: [], preferences: [], pendingStates: [] },
  semantic: [
    {
      id: "m1",
      summary: "The principal prefers morning reviews.",
      score: 0.9,
      source: "telegram",
      createdAt: "2026-07-20T10:00:00.000Z",
    },
  ],
  live: {
    connected: true,
    calendarConnected: true,
    inboxConnected: true,
    calendarStatus: "fresh",
    inboxStatus: "fresh",
    checkedAt: "2026-07-23T10:00:00.000Z",
    schedule: [{ title: "Product review", start: "2026-07-23T11:00:00.000Z", allDay: false }],
    unread: [{ from: "Priya <priya@example.com>", subject: "Launch plan" }],
  },
  honorific: "boss",
  principalName: "Jagdeep",
  timezone: "Asia/Kolkata",
  timezoneConfirmed: true,
  connectedDataSources: ["gmail", "calendar", "stripe"],
};

describe("PromptAssemblerService", () => {
  it("keeps permanent policy but exposes only selected skill tools and context", () => {
    const skills = new AgentSkillRegistryService();
    const assembler = new PromptAssemblerService(skills);
    const prompt = assembler.assemble({
      context,
      selection: skills.select(["email"]),
      tools: [
        {
          name: "send_email",
          category: "gmail",
          description: "Send email",
          approvalRequired: true,
          sensitiveDataPolicy: "live_fetch_only",
        },
        {
          name: "business_snapshot",
          category: "business",
          description: "Read revenue",
          approvalRequired: false,
          sensitiveDataPolicy: "read_only",
        },
      ],
    });

    expect(prompt).toContain("External writes require the runtime's explicit approval gate");
    expect(prompt).toContain("UNTRUSTED EXTERNAL DATA");
    expect(prompt).toContain("- send_email [approval required]: Send email");
    expect(prompt).not.toContain("- business_snapshot:");
    expect(prompt).toContain("LIVE UNREAD INBOX");
    expect(prompt).not.toContain("LIVE CALENDAR — TODAY");
    expect(prompt).not.toContain("RELEVANT FUZZY MEMORY");
    expect(prompt.length).toBeLessThan(9_000);
  });
});
