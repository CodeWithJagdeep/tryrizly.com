// Shared between apps/gateway (owns the CRUD API + Mongo collections) and
// apps/worker (polls triggers, runs actions) so both sides agree on shape.
// v1 supports a narrow, fully-real slice of the flow-builder catalog — see
// LIVE_TRIGGER_EVENTS / LIVE_ACTION_EVENTS below, the single source of truth
// for which app+event combos actually execute (web mirrors this list to grey
// out everything else in the picker).

export type AutomationAppId =
  | "schedule"
  | "gmail"
  | "calendar"
  | "slack"
  | "telegram"
  | "calcom"
  | "discord"
  | "github"
  | "notion"
  | "stripe"
  | "google-drive"
  | "google-sheets"
  | "google-docs"
  | "google-forms"
  | "google-meet"
  | "postgres"
  | "mongodb"
  | "jira"
  | "pagerduty"
  | "trello"
  | "airtable"
  | "twilio";

export type AutomationStepKind = "trigger" | "action";

export type AutomationStep = {
  id: string;
  kind: AutomationStepKind;
  /** Catalog app id — may be any id in the frontend's full catalog; only the
   * ids in LIVE_* actually execute. */
  app: string;
  /** Display event name, e.g. "New Email Matching Search". Also the key that
   * LIVE_* event matching (isEventLive) checks — do not overwrite with a
   * user-facing rename; use `label` for that. */
  title: string;
  /** Optional user-given step name, shown in place of `title` on the canvas
   * and panel header. Purely cosmetic — never used for event matching. */
  label?: string;
  subtitle?: string;
  config: Record<string, unknown>;
};

export type AutomationFlowStatus = "draft" | "active" | "paused";

export type AutomationCursor = {
  lastPolledAt?: string;
  /** Bounded list of recently-seen trigger item ids, for de-dup. */
  seenIds?: string[];
};

export type AutomationFlow = {
  id: string;
  userId: string;
  name: string;
  status: AutomationFlowStatus;
  steps: AutomationStep[];
  cursor?: AutomationCursor;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRunStepResult = {
  stepId: string;
  app: string;
  status: "success" | "failed" | "skipped";
  error?: string;
  /** Deterministic receipt from the provider/runtime. A success without
   * evidence is never considered a completed unattended action. */
  evidence?: AutomationStepEvidence;
};

export type AutomationStepEvidence = {
  kind: "provider_ack" | "data_result" | "ai_result" | "control";
  provider: string;
  acknowledged: true;
  /** Stable provider object id when the API returned one (message, issue,
   * event, file, booking, etc.). */
  resourceId?: string;
  resourceUrl?: string;
  /** Bounded metadata only — never connector credentials or full payloads. */
  metadata?: Record<string, string | number | boolean | null>;
};

/** Immutable, configuration-free description of a step as it existed when a
 * run started. Config is deliberately excluded so audit history never becomes
 * another place for credentials or private payloads to leak. */
export type AutomationRunPlanStep = Pick<
  AutomationStep,
  "id" | "kind" | "app" | "title" | "label"
>;

type AutomationRunAuditEventBase = {
  id: string;
  at: string;
  /** Starts at one and increments whenever a supervisor revises the plan. */
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
      evidence: AutomationStepEvidence;
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
      /** Human-readable supervisor explanation, preserved verbatim but bounded. */
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

export type AutomationRunStatus = "running" | "success" | "failed";

export type AutomationRun = {
  id: string;
  flowId: string;
  userId: string;
  startedAt: string;
  finishedAt?: string;
  status: AutomationRunStatus;
  triggerPayload: Record<string, unknown>;
  stepResults: AutomationRunStepResult[];
  /** Original revision-one plan. Never rewritten when the active plan pivots. */
  originalPlan?: AutomationRunPlanStep[];
  /** Ordered, append-only account of execution, recovery, and verification. */
  auditTrail?: AutomationRunAuditEvent[];
};

export function snapshotAutomationRunPlan(
  steps: AutomationStep[],
): AutomationRunPlanStep[] {
  return steps.map(({ id, kind, app, title, label }) => ({
    id,
    kind,
    app,
    title,
    ...(label ? { label } : {}),
  }));
}

export function auditEventForAutomationStepResult(input: {
  runId: string;
  result: AutomationRunStepResult;
  at: string;
  revision: number;
  sequence: number;
  skippedReason?: string;
}): AutomationRunAuditEvent {
  const base = {
    id: `${input.runId}:${input.sequence}`,
    at: input.at,
    revision: input.revision,
  };
  if (input.result.status === "success" && input.result.evidence) {
    return {
      ...base,
      type: "step_succeeded",
      stepId: input.result.stepId,
      evidence: input.result.evidence,
    };
  }
  if (input.result.status === "failed") {
    return {
      ...base,
      type: "step_failed",
      stepId: input.result.stepId,
      error: input.result.error?.slice(0, 2_000) || "The step failed without an error message.",
    };
  }
  if (input.result.status === "success") {
    return {
      ...base,
      type: "step_failed",
      stepId: input.result.stepId,
      error: "Completion was rejected because the step did not provide evidence.",
      code: "missing_evidence",
    };
  }
  return {
    ...base,
    type: "step_skipped",
    stepId: input.result.stepId,
    reason: (input.skippedReason || "Skipped after an earlier step stopped the run.").slice(0, 1_000),
  };
}

/** Which trigger events actually fire, per app. Everything else is UI-only. */
export const LIVE_TRIGGER_EVENTS: Record<string, string[]> = {
  schedule: ["Every Day", "Every Hour", "Every Week"],
  gmail: ["New Email Matching Search"],
  calendar: ["New Event"],
  // Both poll a Sheet (the Forms trigger reads the form's own response
  // sheet) — see AutomationRunWorkerService and SchedulerService.pollOneAutomation.
  "google-sheets": ["New Row"],
  "google-forms": ["New Submission"],
  // Polls Calendar for events with a Meet link starting in the next couple
  // of minutes — no separate Meet API, same connection as "calendar".
  "google-meet": ["Meeting Started"],
  airtable: ["New Record"],
  // Push-only, not polled — there's no cheap "list recent comments" endpoint
  // to poll. Fed by the Notion webhook receiver in apps/gateway instead of
  // SchedulerService's automation-poll cron; see NotionWebhookService.
  notion: ["New Comment"],
};

/** Which action events actually run, per app. Everything else is UI-only. */
export const LIVE_ACTION_EVENTS: Record<string, string[]> = {
  slack: ["Send Channel Message", "Send Direct Message"],
  telegram: ["Send Message", "Notify Me"],
  calcom: ["Create Booking"],
  discord: ["Send Message"],
  github: ["Create Issue"],
  notion: ["Create Page"],
  stripe: ["Create Customer"],
  "google-drive": ["Upload File"],
  "google-sheets": ["Create Row"],
  "google-docs": ["Create Document"],
  "google-meet": ["Create Meeting"],
  // Read-only enrich steps, not writes — connector.service.ts refuses to
  // store a write-capable Postgres/Mongo credential in the first place, so
  // "Insert Row"/"Insert Document" stay unimplemented ("Coming soon").
  postgres: ["Run a Query"],
  mongodb: ["Find Document"],
  jira: ["Create Issue"],
  pagerduty: ["Create Incident"],
  trello: ["Create Card"],
  airtable: ["Create Record"],
  twilio: ["Send SMS"],
  // Flow-control steps — not tied to a connector, "none" account method.
  delay: ["Delay"],
  filter: ["Only Continue If"],
  // Consumes AI credits (budget-gated) — see AiCoreService.automationAiExtract.
  ai: ["Run Riz Agent"],
};

export type DelayConfig = { delayMinutes: number };

export type FilterOperator = "contains" | "not_contains" | "equals";

export type FilterConfig = { field: string; operator: FilterOperator; value: string };

/** Evaluates a "filter" step's condition against the trigger payload (all string comparisons, case-insensitive). */
export function evaluateFilter(config: FilterConfig, payload: Record<string, unknown>): boolean {
  const raw = payload[config.field];
  const actual = (raw === undefined || raw === null ? "" : String(raw)).toLowerCase();
  const expected = (config.value ?? "").toLowerCase();
  if (config.operator === "contains") return actual.includes(expected);
  if (config.operator === "not_contains") return !actual.includes(expected);
  return actual === expected;
}

export function isAppLive(appId: string, kind: AutomationStepKind): boolean {
  const map = kind === "trigger" ? LIVE_TRIGGER_EVENTS : LIVE_ACTION_EVENTS;
  return (map[appId]?.length ?? 0) > 0;
}

export function isEventLive(appId: string, kind: AutomationStepKind, eventName: string): boolean {
  const map = kind === "trigger" ? LIVE_TRIGGER_EVENTS : LIVE_ACTION_EVENTS;
  return Boolean(map[appId]?.includes(eventName));
}

/** A flow is runnable once it has a live trigger and at least one live action. */
export function isFlowRunnable(steps: AutomationStep[]): boolean {
  const [trigger, ...actions] = steps;
  if (!trigger || trigger.kind !== "trigger") return false;
  if (!isEventLive(trigger.app, "trigger", trigger.title)) return false;
  if (actions.length === 0) return false;
  return actions.every((step) => step.kind === "action" && isEventLive(step.app, "action", step.title));
}
