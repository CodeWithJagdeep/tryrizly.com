import { describe, expect, it } from "vitest";
import { AgentSkillRegistryService } from "./agent-skill-registry.service";
import { SkillRouterService } from "./skill-router.service";

describe("SkillRouterService", () => {
  it("routes an implied meeting note to both email and calendar without an LLM call", async () => {
    let llmCalls = 0;
    const registry = new AgentSkillRegistryService();
    const router = new SkillRouterService(
      registry,
      {
        hasProvider: () => true,
        complete: async () => {
          llmCalls += 1;
          return '{"skill_ids":[]}';
        },
      } as never,
    );

    const route = await router.route({
      userId: "u1",
      message: "Can you shoot John a quick note about the meeting?",
    });

    expect(route.skillIds).toEqual(expect.arrayContaining(["email", "calendar"]));
    expect(route.toolNames).toEqual(
      expect.arrayContaining(["send_email", "calendar_briefing"]),
    );
    expect(llmCalls).toBe(0);
  });

  it("routes a Jira/Airtable question to connected_sources without an LLM call", async () => {
    let llmCalls = 0;
    const registry = new AgentSkillRegistryService();
    const router = new SkillRouterService(
      registry,
      {
        hasProvider: () => true,
        complete: async () => {
          llmCalls += 1;
          return '{"skill_ids":[]}';
        },
      } as never,
    );

    const route = await router.route({
      userId: "u1",
      message: "Any open Jira issues assigned to me, and what's new in Airtable?",
    });

    expect(route.skillIds).toEqual(expect.arrayContaining(["connected_sources"]));
    expect(route.toolNames).toEqual(
      expect.arrayContaining(["jira_search", "airtable_records"]),
    );
    expect(llmCalls).toBe(0);
  });

  it("inherits capabilities from recent history for an ambiguous follow-up", async () => {
    const registry = new AgentSkillRegistryService();
    const router = new SkillRouterService(
      registry,
      {
        hasProvider: () => true,
        complete: async () => '{"skill_ids":[]}',
      } as never,
    );

    const route = await router.route({
      userId: "u1",
      message: "Yes, do it",
      history: [
        {
          role: "user",
          content: "Draft an email to Priya and schedule the review for Friday",
        },
      ],
    });

    expect(route.skillIds).toEqual(expect.arrayContaining(["email", "calendar"]));
  });

  it("uses the cheap classifier only for genuinely ambiguous context", async () => {
    let llmCalls = 0;
    const registry = new AgentSkillRegistryService();
    const router = new SkillRouterService(
      registry,
      {
        hasProvider: () => true,
        complete: async () => {
          llmCalls += 1;
          return '{"skill_ids":["memory","email"]}';
        },
      } as never,
    );

    const route = await router.route({
      userId: "u1",
      message: "What about that?",
      history: [{ role: "assistant", content: "I can look into it." }],
    });

    expect(llmCalls).toBe(1);
    expect(route.skillIds).toEqual(["memory", "email"]);
    expect(route.source).toBe("hybrid");
  });

  it("fails catalog validation for an unowned runtime tool", () => {
    const registry = new AgentSkillRegistryService();

    expect(() =>
      registry.assertCompatible(["send_email", "brand_new_tool"]),
    ).toThrow(/runtime tools without a domain skill/);
  });
});
