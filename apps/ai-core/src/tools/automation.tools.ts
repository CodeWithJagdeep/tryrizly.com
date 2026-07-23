import { randomUUID } from "crypto";
import {
  isEventLive,
  isFlowRunnable,
  LIVE_ACTION_EVENTS,
  LIVE_TRIGGER_EVENTS,
  type AutomationFlow,
  type AutomationStep,
} from "@heyriz/shared/automations/types";
import { env } from "@heyriz/shared/env";
import type { HeyRizTool } from "./tool.types";

/**
 * Gateway owns automation_flows/automation_runs in Mongo (see
 * apps/gateway/src/automations/) — these tools call its CRUD API the same
 * way apps/worker does, rather than opening a second Mongo client here.
 */
async function gatewayFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const gatewayUrl = env.NEXT_PUBLIC_GATEWAY_URL;
  if (!gatewayUrl) return null;
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
  if (init?.body) headers["content-type"] = "application/json";
  if (env.AUTH_INTERNAL_SECRET) headers["x-heyriz-internal-secret"] = env.AUTH_INTERNAL_SECRET;
  try {
    const res = await fetch(`${gatewayUrl}${path}`, { ...init, headers });
    return (await res.json().catch(() => null)) as T;
  } catch {
    return null;
  }
}

function describeTriggerEvent(event: string): string {
  return `Trigger: ${event}`;
}

function describeStep(step: { app: string; event: string }): string {
  return `${step.app} — ${step.event}`;
}

function liveOptionsMessage(): string {
  const triggers = Object.entries(LIVE_TRIGGER_EVENTS)
    .map(([app, events]) => `${app} (${events.join(", ")})`)
    .join("; ");
  const actions = Object.entries(LIVE_ACTION_EVENTS)
    .map(([app, events]) => `${app} (${events.join(", ")})`)
    .join("; ");
  return `Supported triggers: ${triggers}. Supported actions: ${actions}.`;
}

// ── list_automations ────────────────────────────────────────────────────────

export const listAutomationsTool: HeyRizTool<Record<string, never>> = {
  name: "list_automations",
  category: "automation",
  description:
    "Lists the principal's automation flows built in the flow builder (/dashboard/automations), with their status (draft/active/paused) and what each one does. Read-only.",
  approvalRequired: false,
  sensitiveDataPolicy: "live_fetch_only",
  async execute({ userId, context }) {
    const result = await gatewayFetch<{ flows?: AutomationFlow[]; error?: string }>(
      `/api/automations?userId=${encodeURIComponent(userId)}`,
    );
    if (!result || result.error) {
      return {
        tool: "list_automations",
        status: "transient_error",
        message: `I couldn't reach the automations service, ${context.honorific}. Try again in a moment.`,
      };
    }
    const flows = result.flows ?? [];
    if (flows.length === 0) {
      return {
        tool: "list_automations",
        status: "ok",
        message: `You don't have any automations yet, ${context.honorific}.`,
        data: { flows: [] },
      };
    }
    const lines = flows.map((f) => {
      const trigger = f.steps[0];
      const actionCount = Math.max(0, f.steps.length - 1);
      return `• "${f.name}" — ${f.status}${trigger ? `, triggers on ${trigger.app}: ${trigger.title}` : ""}, ${actionCount} action${actionCount === 1 ? "" : "s"} (id: ${f.id})`;
    });
    return {
      tool: "list_automations",
      status: "ok",
      message: `You have ${flows.length} automation${flows.length === 1 ? "" : "s"}, ${context.honorific}:\n\n${lines.join("\n")}`,
      data: { flows },
    };
  },
};

// ── create_automation ───────────────────────────────────────────────────────

type StepInput = { app: string; event: string; config?: Record<string, unknown> };

type CreateAutomationPayload = {
  name?: string;
  trigger?: StepInput;
  actions?: StepInput[];
  approved?: boolean;
};

export function createAutomationTool(): HeyRizTool<CreateAutomationPayload> {
  return {
    name: "create_automation",
    category: "automation",
    description:
      "Creates a new automation flow (trigger -> one or more actions) in the flow builder, saved as a draft (not yet running). " +
      "Only a narrow set of app/event combos actually execute — check with list_automations or ask the principal before " +
      "assuming something like GitHub or Notion is supported. Requires approval. Does not activate the flow — use " +
      "activate_automation afterward if the principal wants it running.",
    approvalRequired: true,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      if (!payload.name || !payload.trigger || !payload.actions?.length) {
        return {
          tool: "create_automation",
          status: "invalid_input",
          message: `I need a name, one trigger, and at least one action to create an automation, ${context.honorific}. ${liveOptionsMessage()}`,
        };
      }

      if (!isEventLive(payload.trigger.app, "trigger", payload.trigger.event)) {
        return {
          tool: "create_automation",
          status: "invalid_input",
          message: `"${payload.trigger.app}: ${payload.trigger.event}" isn't a live trigger yet, ${context.honorific}. ${liveOptionsMessage()}`,
        };
      }
      const deadAction = payload.actions.find((a) => !isEventLive(a.app, "action", a.event));
      if (deadAction) {
        return {
          tool: "create_automation",
          status: "invalid_input",
          message: `"${deadAction.app}: ${deadAction.event}" isn't a live action yet, ${context.honorific}. ${liveOptionsMessage()}`,
        };
      }

      if (!payload.approved) {
        const preview = [
          describeTriggerEvent(describeStep(payload.trigger)),
          ...payload.actions.map((a, i) => `Step ${i + 1}: ${describeStep(a)}`),
        ].join("\n");
        return {
          tool: "create_automation",
          status: "pending_approval",
          message: `Create automation "${payload.name}", ${context.honorific}?\n\n${preview}\n\nIt'll be saved as a draft — you'll need to activate it separately.`,
          data: { name: payload.name, trigger: payload.trigger, actions: payload.actions },
        };
      }

      const steps: AutomationStep[] = [
        {
          id: randomUUID(),
          kind: "trigger",
          app: payload.trigger.app,
          title: payload.trigger.event,
          config: payload.trigger.config ?? {},
        },
        ...payload.actions.map((a) => ({
          id: randomUUID(),
          kind: "action" as const,
          app: a.app,
          title: a.event,
          config: a.config ?? {},
        })),
      ];

      const result = await gatewayFetch<{ flow?: AutomationFlow; error?: string }>("/api/automations", {
        method: "POST",
        body: JSON.stringify({ userId, name: payload.name, steps }),
      });
      if (!result?.flow) {
        return {
          tool: "create_automation",
          status: "transient_error",
          message: `I couldn't save that automation, ${context.honorific} — ${result?.error ?? "the automations service didn't respond"}. Try again in a moment.`,
        };
      }

      return {
        tool: "create_automation",
        status: "ok",
        message: `Created "${payload.name}" as a draft, ${context.honorific}. Say the word and I'll activate it, or you can finish configuring it in the flow builder first.`,
        data: { flow: result.flow },
      };
    },
  };
}

// ── activate_automation / pause_automation ──────────────────────────────────

type FlowActionPayload = { flowId?: string; approved?: boolean };

export function createActivateAutomationTool(): HeyRizTool<FlowActionPayload> {
  return {
    name: "activate_automation",
    category: "automation",
    description:
      "Activates a draft or paused automation flow so it starts running automatically in the background. Requires approval, since this makes the flow start acting on its own going forward.",
    approvalRequired: true,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      if (!payload.flowId) {
        return { tool: "activate_automation", status: "invalid_input", message: `Which automation, ${context.honorific}?` };
      }

      const flowResult = await gatewayFetch<{ flow?: AutomationFlow }>(
        `/api/automations/${encodeURIComponent(payload.flowId)}?userId=${encodeURIComponent(userId)}`,
      );
      const flow = flowResult?.flow;
      if (!flow) {
        return { tool: "activate_automation", status: "invalid_input", message: `I couldn't find that automation, ${context.honorific}.` };
      }
      if (!isFlowRunnable(flow.steps)) {
        return {
          tool: "activate_automation",
          status: "invalid_input",
          message: `"${flow.name}" needs a live trigger and at least one live action before it can be activated, ${context.honorific}.`,
        };
      }

      if (!payload.approved) {
        return {
          tool: "activate_automation",
          status: "pending_approval",
          message: `Activate "${flow.name}", ${context.honorific}? It'll start running automatically from now on.`,
          data: { flowId: flow.id, name: flow.name },
        };
      }

      const result = await gatewayFetch<{ ok?: boolean; error?: string }>(
        `/api/automations/${encodeURIComponent(payload.flowId)}/activate`,
        { method: "POST", body: JSON.stringify({ userId }) },
      );
      if (!result?.ok) {
        return {
          tool: "activate_automation",
          status: "transient_error",
          message: `Couldn't activate "${flow.name}", ${context.honorific} — ${result?.error ?? "something went wrong"}.`,
        };
      }
      return {
        tool: "activate_automation",
        status: "ok",
        message: `"${flow.name}" is active, ${context.honorific} — it'll run automatically from here.`,
      };
    },
  };
}

export function createPauseAutomationTool(): HeyRizTool<FlowActionPayload> {
  return {
    name: "pause_automation",
    category: "automation",
    description: "Pauses an active automation flow so it stops running. Safe/reversible — no approval needed.",
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      if (!payload.flowId) {
        return { tool: "pause_automation", status: "invalid_input", message: `Which automation, ${context.honorific}?` };
      }
      const result = await gatewayFetch<{ ok?: boolean; error?: string }>(
        `/api/automations/${encodeURIComponent(payload.flowId)}/pause`,
        { method: "POST", body: JSON.stringify({ userId }) },
      );
      if (!result?.ok) {
        return {
          tool: "pause_automation",
          status: "transient_error",
          message: `Couldn't pause that automation, ${context.honorific} — ${result?.error ?? "something went wrong"}.`,
        };
      }
      return { tool: "pause_automation", status: "ok", message: `Paused, ${context.honorific}.` };
    },
  };
}
