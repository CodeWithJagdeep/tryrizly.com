// Server-backed persistence for automation flows — proxied through
// /api/automations/* to the gateway, which owns automation_flows /
// automation_runs in Mongo and the poll/run execution engine in apps/worker.
//
// A flow is a linear list of steps: the first step is always the trigger,
// everything after it is an action, run top-to-bottom (Zapier-style).

export type AutomationStepKind = "trigger" | "action";

export type AutomationStep = {
  id: string;
  kind: AutomationStepKind;
  title: string;
  /** Optional user-given step name, shown in place of `title`. Cosmetic only —
   * never used for live-event matching. Mirrors shared/src/automations/types.ts. */
  label?: string;
  subtitle: string;
  app: string;
  /** Per-app fields (Gmail search query, Slack target/message, Cal.com booking fields, …). */
  config: Record<string, unknown>;
};

export type AutomationFlowStatus = "draft" | "active" | "paused";

export type AutomationFlow = {
  id: string;
  name: string;
  status: AutomationFlowStatus;
  steps: AutomationStep[];
  updatedAt: string;
};

export type AutomationRunStepResult = {
  stepId: string;
  app: string;
  status: "success" | "failed" | "skipped";
  error?: string;
  evidence?: {
    kind: "provider_ack" | "data_result" | "ai_result" | "control";
    provider: string;
    acknowledged: true;
    resourceId?: string;
    resourceUrl?: string;
    metadata?: Record<string, string | number | boolean | null>;
  };
};

export type AutomationRunPlanStep = Pick<
  AutomationStep,
  "id" | "kind" | "app" | "title" | "label"
>;

type AutomationRunAuditEventBase = {
  id: string;
  at: string;
  revision: number;
};

export type AutomationRunAuditEvent =
  | (AutomationRunAuditEventBase & {
      type: "plan_created";
      stepIds: string[];
    })
  | (AutomationRunAuditEventBase & {
      type: "step_succeeded";
      stepId: string;
      evidence: NonNullable<AutomationRunStepResult["evidence"]>;
    })
  | (AutomationRunAuditEventBase & {
      type: "step_failed";
      stepId: string;
      error: string;
      code?: string;
    })
  | (AutomationRunAuditEventBase & {
      type: "step_skipped";
      stepId: string;
      reason: string;
    })
  | (AutomationRunAuditEventBase & {
      type: "plan_revised";
      reason: string;
      supersededStepIds: string[];
      preservedStepIds: string[];
      replacementSteps: AutomationRunPlanStep[];
    })
  | (AutomationRunAuditEventBase & {
      type: "final_verification";
      result: "passed" | "failed";
      method: "deterministic_evidence" | "semantic_goal";
      summary: string;
    });

export type AutomationRun = {
  id: string;
  flowId: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "success" | "failed";
  stepResults: AutomationRunStepResult[];
  originalPlan?: AutomationRunPlanStep[];
  auditTrail?: AutomationRunAuditEvent[];
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  return (await res.json().catch(() => ({}))) as T;
}

export async function listFlows(): Promise<AutomationFlow[]> {
  const data = await api<{ flows?: AutomationFlow[] }>("/api/automations");
  return data.flows ?? [];
}

export async function getFlow(id: string): Promise<AutomationFlow | null> {
  const data = await api<{ flow?: AutomationFlow }>(`/api/automations/${encodeURIComponent(id)}`);
  return data.flow ?? null;
}

export async function saveFlow(flow: {
  id: string;
  name: string;
  steps: AutomationStep[];
}): Promise<{ flow: AutomationFlow | null; error?: string }> {
  const data = await api<{ flow?: AutomationFlow; message?: string }>("/api/automations", {
    method: "POST",
    body: JSON.stringify(flow),
  });
  if (!data.flow) {
    return {
      flow: null,
      error:
        data.message === "automation_limit_reached"
          ? "You've reached your plan's automation limit. Upgrade to add more."
          : (data.message ?? "Couldn't save this automation."),
    };
  }
  return { flow: data.flow };
}

export async function deleteFlow(id: string): Promise<boolean> {
  const data = await api<{ ok?: boolean }>(`/api/automations/${encodeURIComponent(id)}`, { method: "DELETE" });
  return Boolean(data.ok);
}

export async function activateFlow(id: string): Promise<{
  ok: boolean;
  error?: string;
  issues?: Array<{ stepId?: string; path: string; message: string }>;
}> {
  return api(`/api/automations/${encodeURIComponent(id)}/activate`, { method: "POST" });
}

export async function pauseFlow(id: string): Promise<{
  ok: boolean;
  error?: string;
  issues?: Array<{ stepId?: string; path: string; message: string }>;
}> {
  return api(`/api/automations/${encodeURIComponent(id)}/pause`, { method: "POST" });
}

export async function listRuns(id: string): Promise<AutomationRun[]> {
  const data = await api<{ runs?: AutomationRun[] }>(`/api/automations/${encodeURIComponent(id)}/runs`);
  return data.runs ?? [];
}

// ── Flow-builder chat (the canvas copilot) ──────────────────────────────────
// Mirrors BuilderOperation in apps/ai-core/src/prompt/automation-builder.prompt.ts
// (web is a separate repo, so the type is duplicated the same way LIVE_* is).

export type BuilderChatOp =
  | {
      op: "add";
      kind: AutomationStepKind;
      app: string;
      event: string;
      config?: Record<string, unknown>;
      position?: number;
    }
  | { op: "update"; stepId: string; app?: string; event?: string; config?: Record<string, unknown> }
  | { op: "remove"; stepId: string };

export type BuilderChatResult = {
  ok?: boolean;
  reply?: string;
  thinking?: string;
  name?: string;
  operations?: BuilderChatOp[];
  error?: string;
};

export async function builderChat(input: {
  flowId: string;
  name: string;
  steps: AutomationStep[];
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<BuilderChatResult> {
  const call = () =>
    api<BuilderChatResult>("/api/automations/chat", {
      method: "POST",
      body: JSON.stringify(input),
    });
  try {
    return await call();
  } catch (error) {
    // A rejected fetch here is a socket-level failure (e.g. the dev server
    // closed a keep-alive connection under the POST) — the request never got
    // an answer. This endpoint only computes and returns ops, it writes
    // nothing, so one retry is always safe.
    if (error instanceof TypeError) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return call();
    }
    throw error;
  }
}

export function newFlowId(): string {
  return `flow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newStepId(): string {
  return `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
