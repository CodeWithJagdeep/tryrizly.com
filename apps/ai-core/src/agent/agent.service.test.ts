import { describe, expect, it } from "vitest";
import { AgentService } from "./agent.service";
import type { HeyRizRuntimeContext } from "../context/context.types";
import type { AgentPlan, AgentPlanRepository } from "../planning/agent-plan.repository";

const context: HeyRizRuntimeContext = {
  userId: "owner@example.com",
  source: "telegram",
  structured: { activeDeals: [], preferences: [], pendingStates: [] },
  semantic: [],
  live: {
    connected: false,
    calendarConnected: false,
    inboxConnected: false,
    calendarStatus: "not_connected",
    inboxStatus: "not_connected",
    checkedAt: new Date(0).toISOString(),
    schedule: [],
    unread: [],
  },
  honorific: "boss",
  timezone: "UTC",
  timezoneConfirmed: true,
  connectedDataSources: ["slack", "calendar"],
};

describe("AgentService planning", () => {
  it("executes a multi-step plan and labels connector observations as untrusted", async () => {
    const llmMessages: Array<Array<{ role: string; content: string }>> = [];
    const script = [
      JSON.stringify({
        thought: "investigate all sources first",
        action: "tool",
        plan: {
          goal: "Find and explain the latest announcement",
          steps: [
            { id: "search", task: "Search connected sources", tool: "source_updates" },
            { id: "answer", task: "Compare timestamps and explain the latest", tool: null },
          ],
        },
        plan_step_id: "search",
        plan_complete: false,
        tool_name: "source_updates",
        tool_input: { query: "announcement" },
        say: null,
      }),
      JSON.stringify({
        thought: "the evidence is sufficient",
        action: "final",
        plan: null,
        plan_step_id: "answer",
        plan_complete: true,
        tool_name: null,
        tool_input: null,
        say: "The Slack announcement is the newest update, boss.",
      }),
    ];
    const llm = {
      getActiveProviderName: () => "grok",
      hasProvider: () => true,
      complete: async ({ messages }: { messages: Array<{ role: string; content: string }> }) => {
        llmMessages.push(messages);
        return script.shift();
      },
    };
    const tools = {
      list: () => [
        {
          name: "source_updates",
          category: "business",
          description: "search connected sources",
          approvalRequired: false,
          sensitiveDataPolicy: "live_fetch_only",
        },
      ],
      get: () => ({
        name: "source_updates",
        approvalRequired: false,
        sensitiveDataPolicy: "live_fetch_only",
      }),
      validatePayload: (_name: string, payload: unknown) => ({ ok: true as const, value: payload }),
      execute: async () => ({
        tool: "source_updates",
        status: "ok" as const,
        message: "Slack announcement at 10:00; calendar review at 09:00",
      }),
    };
    let storedPlan: AgentPlan | undefined;
    const plans = {
      getActive: async () => undefined,
      start: async (userId: string, request: string, proposed: { goal: string; steps: Array<{ id: string; task: string; tool?: string }> }) => {
        const now = new Date().toISOString();
        storedPlan = {
          id: "plan-1",
          userId,
          request,
          goal: proposed.goal,
          status: "active",
          steps: proposed.steps.map((step) => ({ ...step, status: "pending" as const })),
          createdAt: now,
          updatedAt: now,
        };
        return storedPlan;
      },
      markRunning: async (plan: AgentPlan, stepId: string) => {
        storedPlan = update(plan, stepId, "in_progress");
        return storedPlan;
      },
      recordResult: async (plan: AgentPlan, stepId: string) => {
        storedPlan = update(plan, stepId, "completed");
        return storedPlan;
      },
      complete: async (plan: AgentPlan) => {
        storedPlan = {
          ...plan,
          status: "completed",
          steps: plan.steps.map((step) => ({ ...step, status: "completed" })),
        };
        return storedPlan;
      },
    } as unknown as AgentPlanRepository;
    const budget = { check: async () => ({ state: "ok" as const }) };
    const agent = new AgentService(tools as never, llm as never, budget as never, plans);

    const result = await agent.run({
      userId: context.userId,
      message: "Find the latest announcement across our connected apps",
      context,
    });

    expect(result.plan?.status).toBe("completed");
    expect(result.steps).toEqual([
      expect.objectContaining({ tool: "source_updates", status: "ok" }),
    ]);
    expect(llmMessages[1]?.at(-1)?.content).toContain("UNTRUSTED EXTERNAL DATA");
  });
});

function update(plan: AgentPlan, id: string, status: "in_progress" | "completed"): AgentPlan {
  return {
    ...plan,
    steps: plan.steps.map((step) => (step.id === id ? { ...step, status } : step)),
  };
}
