import { randomUUID } from "crypto";
import {
  isEventLive,
  isFlowRunnable,
  LIVE_ACTION_EVENTS,
  LIVE_TRIGGER_EVENTS,
  type AutomationFlow,
  type AutomationStep,
} from "@heyriz/shared/automations/types";
import {
  automationStepConfigJsonSchema,
  validateAutomationStepConfig,
} from "@heyriz/shared/automations/schemas";
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

function titleCaseApp(app: string): string {
  return app.charAt(0).toUpperCase() + app.slice(1);
}

function describeChain(trigger: { app: string }, actions: { app: string }[]): string {
  return [trigger, ...actions].map((s) => titleCaseApp(s.app)).join(" → ");
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

// ── describe_automation_event ───────────────────────────────────────────────

type DescribeEventPayload = { app?: string; kind?: "trigger" | "action"; event?: string };

/**
 * Config-shape lookup for a single app/event, so the model can build a valid
 * flow in one pass instead of guessing and retrying. Backed by the same Zod
 * schemas the gateway enforces at activation, exported as JSON Schema.
 */
export const describeAutomationEventTool: HeyRizTool<DescribeEventPayload> = {
  name: "describe_automation_event",
  category: "automation",
  description:
    "Returns the required `config` shape (JSON Schema) for one automation app/event, e.g. {app:'github', kind:'trigger', event:'New Issue'}. " +
    "Read-only. Call before create_automation whenever unsure what config an event needs.",
  approvalRequired: false,
  sensitiveDataPolicy: "none",
  async execute({ payload, context }) {
    const { app, kind, event } = payload;
    if (!app || !kind || !event) {
      return {
        tool: "describe_automation_event",
        status: "invalid_input",
        message: `I need an app, kind (trigger/action) and event name, ${context.honorific}. ${liveOptionsMessage()}`,
      };
    }
    if (!isEventLive(app, kind, event)) {
      return {
        tool: "describe_automation_event",
        status: "invalid_input",
        message: `"${app}: ${event}" isn't a live ${kind}, ${context.honorific}. ${liveOptionsMessage()}`,
      };
    }
    const configSchema = automationStepConfigJsonSchema({ kind, app, title: event });
    // Two different shapes mean "takes no config": no registered schema at all
    // (see validateAutomationStepConfig), and a registered-but-empty object
    // like telegram's `z.object({}).strict()`. Both should read the same to the
    // model, or it'll try to invent fields for an event that accepts none.
    const properties = (configSchema as { properties?: Record<string, unknown> } | undefined)?.properties;
    const takesNoConfig = !configSchema || Object.keys(properties ?? {}).length === 0;
    return {
      tool: "describe_automation_event",
      status: "ok",
      message: takesNoConfig
        ? `"${app}: ${event}" needs no config — an empty config object is valid.`
        : `"${app}: ${event}" takes this config: ${JSON.stringify(configSchema)}`,
      data: { app, kind, event, configSchema: configSchema ?? null },
    };
  },
};

// ── create_automation ───────────────────────────────────────────────────────

type StepInput = { app: string; event: string; config?: Record<string, unknown> };

type CreateAutomationPayload = {
  name?: string;
  trigger?: StepInput;
  actions?: StepInput[];
  /** Skips config validation so a half-specified flow still saves as a draft —
   * only when the principal asked for something to finish in the builder. */
  allowIncomplete?: boolean;
};

export function createAutomationTool(): HeyRizTool<CreateAutomationPayload> {
  return {
    name: "create_automation",
    category: "automation",
    // The live catalog is inlined here rather than left to liveOptionsMessage()'s
    // error path: without it the model guesses app/event strings blind, burns a
    // turn getting rejected, and sometimes invents apps that don't exist. Same
    // reasoning for pointing at describe_automation_event — a draft whose config
    // fails validation can never be activated, so "build it and run it" dies at
    // the last step unless the model knows the shape up front.
    description:
      "Creates a new automation flow (trigger -> one or more actions) in the flow builder, saved as a draft (not yet running). " +
      "No approval prompt — it's inert until activate_automation is called. The principal can edit it in the flow builder afterward.\n\n" +
      "Use ONLY these app/event combos — anything else is rejected:\n" +
      liveOptionsMessage() +
      "\n\nMost events also need a `config` object (github needs a repo, discord needs a channelId, gmail needs a query). " +
      "Call describe_automation_event first when unsure of the shape, or ask the principal for values only they know. " +
      "A draft with invalid config cannot be activated, so get config right at creation time. " +
      "Set allowIncomplete:true only if the principal explicitly wants a rough draft to finish in the builder themselves.",
    approvalRequired: false,
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

      // Catch bad config here rather than letting the draft save and fail at
      // activate time — validateAutomationFlowForActivation would reject it
      // anyway, two turns later and without telling the model the shape.
      if (!payload.allowIncomplete) {
        for (const step of steps) {
          const check = validateAutomationStepConfig(step);
          if (check.ok) continue;
          return {
            tool: "create_automation",
            status: "invalid_input",
            message:
              `I can't create that yet, ${context.honorific} — "${step.app}: ${step.title}" needs ` +
              `${check.issues.map((i) => i.message).join(" ")} ` +
              `Ask me for anything only you'd know (a repo, a channel, a search query), or I can save it as a rough draft to finish in the builder.`,
            data: {
              app: step.app,
              event: step.title,
              kind: step.kind,
              issues: check.issues,
              configSchema: automationStepConfigJsonSchema(step),
            },
          };
        }
      }

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

      const chain = describeChain(payload.trigger, payload.actions);
      return {
        tool: "create_automation",
        status: "ok",
        message: `Created "${payload.name}" as a draft, ${context.honorific}: ${chain}. Say the word and I'll activate it, or you can finish configuring it in the flow builder first.`,
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
