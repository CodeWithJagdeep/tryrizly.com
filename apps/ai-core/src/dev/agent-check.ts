import "reflect-metadata";
import { AgentService } from "../agent/agent.service";
import type { BudgetGateService } from "../billing/budget-gate.service";
import type { LlmRouterService } from "../llm/llm-router.service";
import type { ToolRegistryService } from "../tools/tool-registry.service";
import type { HeyRizRuntimeContext } from "../context/context.types";
import type { ToolExecutionResult } from "../tools/tool.types";
import type { AgentPlanRepository } from "../planning/agent-plan.repository";
import { AgentSkillRegistryService } from "../skills/agent-skill-registry.service";
import { PromptAssemblerService } from "../prompt/prompt-assembler.service";

// Always-ok budget gate — these scenarios test tool-loop behavior, not billing.
const fakeBudgetGate = {
  check: async () => ({ state: "ok" as const, spendUsd: 0, budgetUsd: Number.POSITIVE_INFINITY, ratio: 0 }),
  consumeWarnOnce: () => false,
} as unknown as BudgetGateService;

const fakePlans = {
  getActive: async () => undefined,
  start: async () => undefined,
  markRunning: async (plan: unknown) => plan,
  markAwaitingApproval: async (plan: unknown) => plan,
  recordResult: async (plan: unknown) => plan,
  recordApprovedResult: async (plan: unknown) => plan,
  complete: async (plan: unknown) => plan,
} as unknown as AgentPlanRepository;
const fakeSkills = new AgentSkillRegistryService();
const fakePrompts = new PromptAssemblerService(fakeSkills);

// A scripted LLM: returns one canned step per call, in order.
function fakeLlm(script: string[]): LlmRouterService {
  let i = 0;
  return {
    getActiveProviderName: () => "grok",
    hasProvider: () => true,
    complete: async () => script[i++] ?? '{"action":"final","say":"Done, sir."}',
  } as unknown as LlmRouterService;
}

const fakeTools = {
  list: () => [
    { name: "calendar_briefing", category: "calendar", description: "today's schedule", approvalRequired: false, sensitiveDataPolicy: "live_fetch_only" },
    { name: "draft_email_reply", category: "gmail", description: "draft a reply", approvalRequired: false, sensitiveDataPolicy: "live_fetch_only" },
    { name: "send_email", category: "gmail", description: "send", approvalRequired: true, sensitiveDataPolicy: "live_fetch_only" },
    { name: "check_calendar_conflict", category: "calendar", description: "check for a clash", approvalRequired: false, sensitiveDataPolicy: "live_fetch_only" },
    { name: "reschedule_calendar_event", category: "calendar", description: "move an event", approvalRequired: true, sensitiveDataPolicy: "live_fetch_only" },
  ],
  get: (name: string) => ({ name, approvalRequired: name === "send_email" || name === "reschedule_calendar_event" }),
  validatePayload: (_name: string, payload: unknown) => ({ ok: true, value: payload }),
  execute: async ({ name }: { name: string }): Promise<ToolExecutionResult> => {
    if (name === "calendar_briefing")
      return { tool: name, status: "ok", message: "2 meetings today; next: Naman 15:00." };
    if (name === "draft_email_reply")
      return { tool: name, status: "ok", message: "Draft ready.", data: { sendPayload: { to: "naman@x.com", subject: "Re: Proposal", body: "Sounds good." } } };
    if (name === "send_email")
      return { tool: name, status: "ok", message: "Sent, sir — on its way to Naman." };
    if (name === "check_calendar_conflict")
      return {
        tool: name,
        status: "conflict",
        message: 'That clashes with "Naman sync" at 16:00, sir.',
        data: { conflict: { id: "evt_naman_1", title: "Naman sync", start: "2026-06-22T16:00:00Z", end: "2026-06-22T16:30:00Z" } },
      };
    if (name === "reschedule_calendar_event")
      return { tool: name, status: "ok", message: '"Naman sync" is now at 17:00 and they\'ve been notified.' };
    return { tool: name, status: "not_implemented", message: "n/a" };
  },
} as unknown as ToolRegistryService;

const context: HeyRizRuntimeContext = {
  userId: "default",
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
  honorific: "sir",
  timezone: "UTC",
  timezoneConfirmed: true,
  connectedDataSources: [],
};

async function main() {
  // Scenario A: read calendar -> draft -> propose send -> PAUSE for approval.
  const agentA = new AgentService(
    fakeTools,
    fakeLlm([
      '{"thought":"check day","action":"tool","tool_name":"calendar_briefing","tool_input":{}}',
      '{"thought":"draft reply","action":"tool","tool_name":"draft_email_reply","tool_input":{"messageId":"m1","instructions":"accept, propose Tue 3pm"}}',
      '{"thought":"send it","action":"tool","tool_name":"send_email","tool_input":{"to":"naman@x.com","subject":"Re: Proposal","body":"Sounds good."}}',
    ]),
    fakeBudgetGate,
    fakePlans,
    fakeSkills,
    fakePrompts,
  );
  const a = await agentA.run({ userId: "default", message: "Reply to Naman accepting", context });
  console.log("SCENARIO_A_steps:", a.steps.map((s) => s.tool).join(" -> "));
  console.log("SCENARIO_A_pendingApproval:", JSON.stringify(a.pendingApproval));

  // Scenario B: the principal approves -> the gated tool actually runs.
  const agentB = new AgentService(
    fakeTools,
    fakeLlm(['{"action":"final","say":"Sent, sir — your reply is on its way to Naman."}']),
    fakeBudgetGate,
    fakePlans,
    fakeSkills,
    fakePrompts,
  );
  const b = await agentB.run({
    userId: "default",
    message: "yes send it",
    context,
    approval: { tool: "send_email", payload: { to: "naman@x.com", subject: "Re: Proposal", body: "Sounds good." } },
  });
  console.log("SCENARIO_B_executed:", b.steps.map((s) => `${s.tool}:${s.status}`).join(", "));
  console.log("SCENARIO_B_reply:", b.reply);

  // Scenario C: check for a conflict -> see one -> propose moving the clashing
  // event -> PAUSE for approval (the negotiation flow from a 3pm meeting ask).
  const agentC = new AgentService(
    fakeTools,
    fakeLlm([
      '{"thought":"check 3pm window","action":"tool","tool_name":"check_calendar_conflict","tool_input":{"start":"2026-06-22T16:00:00Z","end":"2026-06-22T16:30:00Z"}}',
      '{"thought":"move the clashing event instead","action":"tool","tool_name":"reschedule_calendar_event","tool_input":{"eventId":"evt_naman_1","newStart":"2026-06-22T17:00:00Z","newEnd":"2026-06-22T17:30:00Z"}}',
    ]),
    fakeBudgetGate,
    fakePlans,
    fakeSkills,
    fakePrompts,
  );
  const c = await agentC.run({
    userId: "default",
    message: "reschedule with Naman to 4pm",
    context,
  });
  console.log("SCENARIO_C_steps:", c.steps.map((s) => `${s.tool}:${s.status}`).join(", "));
  console.log("SCENARIO_C_pendingApproval:", JSON.stringify(c.pendingApproval));

  // Scenario D: obvious read-only calendar date questions bypass the LLM, so
  // a misspelled "tomorrow" cannot be answered from today's live context.
  let dLlmCalls = 0;
  let dPayload: Record<string, unknown> | undefined;
  const dateTools = {
    list: () => fakeTools.list(),
    get: (name: string) => ({ name, approvalRequired: false }),
    validatePayload: (_name: string, payload: unknown) => ({ ok: true, value: payload }),
    execute: async ({ name, payload }: { name: string; payload: Record<string, unknown> }): Promise<ToolExecutionResult> => {
      if (name === "calendar_briefing") {
        dPayload = payload;
        return { tool: name, status: "ok", message: "Your calendar is clear tomorrow, sir." };
      }
      return { tool: name, status: "not_implemented", message: "n/a" };
    },
  } as unknown as ToolRegistryService;
  const agentD = new AgentService(
    dateTools,
    {
      getActiveProviderName: () => "grok",
      hasProvider: () => true,
      complete: async () => {
        dLlmCalls += 1;
        return '{"action":"final","say":"Your calendar is clear today, sir."}';
      },
    } as unknown as LlmRouterService,
    fakeBudgetGate,
    fakePlans,
    fakeSkills,
    fakePrompts,
  );
  const d = await agentD.run({
    userId: "default",
    message: "Whats about tommorrow?",
    context,
  });
  console.log("SCENARIO_D_steps:", d.steps.map((s) => `${s.tool}:${s.status}`).join(", "));
  console.log("SCENARIO_D_payload:", JSON.stringify(dPayload));
  console.log("SCENARIO_D_llmCalls:", dLlmCalls);

  const ok =
    a.steps.length === 2 &&
    a.pendingApproval?.tool === "send_email" &&
    b.steps.some((s) => s.tool === "send_email" && s.status === "ok") &&
    c.steps.length === 1 &&
    c.steps[0]?.tool === "check_calendar_conflict" &&
    c.steps[0]?.status === "conflict" &&
    c.pendingApproval?.tool === "reschedule_calendar_event" &&
    d.steps[0]?.tool === "calendar_briefing" &&
    Boolean(dPayload?.startDate) &&
    Boolean(dPayload?.endDate) &&
    dLlmCalls === 0 &&
    /tomorrow/i.test(d.reply);
  console.log(ok ? "AGENT_CHECK_OK" : "AGENT_CHECK_FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("AGENT_CHECK_FAIL", e);
  process.exit(1);
});
