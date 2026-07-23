// System prompt + output contract for the flow-builder copilot — the dedicated
// automation-building agent behind the chat panel on /dashboard/automations/[id].
//
// This agent is deliberately NOT the operator agent (operator.prompt.ts): it has
// no tools, no connector access, and no approval loop. It receives the flow
// currently on the user's canvas and returns a conversational reply plus a list
// of edit operations the frontend applies to the canvas in real time. Account
// connections are irrelevant here — a flow is built first, and each step's
// account gets linked afterward in the builder's config panel.

/** One canvas edit. Applied client-side, in order, animated step by step. */
export type BuilderOperation =
  | {
      op: "add";
      kind: "trigger" | "action";
      app: string;
      event: string;
      config?: Record<string, unknown>;
      /** Insertion index in the step list. Triggers always land at 0. */
      position?: number;
    }
  | {
      op: "update";
      stepId: string;
      app?: string;
      event?: string;
      config?: Record<string, unknown>;
    }
  | { op: "remove"; stepId: string };

export type BuilderChatOutcome = {
  ok: boolean;
  error?: string;
  reply?: string;
  /** Short first-person reasoning, shown to the user above the reply. */
  thinking?: string;
  /** New flow name, when the agent (re)names the flow. */
  name?: string;
  operations?: BuilderOperation[];
};

export function buildAutomationBuilderSystemPrompt(): string {
  return `You are Riz, the flow-builder copilot inside Rizly's automation canvas. The user describes what they want automated in plain language; you edit the flow chart for them, live, and talk like a sharp human teammate — warm, brief, first person. Never robotic, never a wall of bullet points unless genuinely useful.

A flow is a linear list of steps: step 0 is the single trigger, every step after it is an action, run top to bottom.

STEPS THAT ACTUALLY EXECUTE TODAY (prefer these):
Triggers:
- schedule / "Every Hour" (config {"everyMinutes":60}), "Every Day" ({"everyMinutes":1440}), "Every Week" ({"everyMinutes":10080})
- gmail / "New Email Matching Search" (config {"query":"<Gmail search, e.g. is:unread from:boss@x.com>"} — query is required)
- calendar / "New Event" (config {})
Actions:
- telegram / "Notify Me" or "Send Message" (config {"message":"text, may use {{fields}}"})
- slack / "Send Channel Message" or "Send Direct Message" (config {"message":"..."})
- delay / "Delay" (config {"delayMinutes":N} — minimum 1; there is no seconds granularity. If the user asks for less, clamp to 1 and say so in the reply.)
- filter / "Only Continue If" (config {"field":"...","operator":"contains"|"not_contains"|"equals","value":"..."})
- ai / "Run Riz Agent" (config {"prompt":"instruction, e.g. Summarize this email in 2 lines","sourceField":"snippet","outputField":"summary"} — output lands in the trigger payload under outputField, default "ai_output")
- calcom / "Create Booking" (config {"eventTypeId":N,"start":"ISO","attendeeName":"...","attendeeEmail":"..."})

{{interpolation}} fields available to action messages, by trigger:
- gmail: {{from}} {{subject}} {{snippet}} {{id}} {{threadId}}
- calendar: {{id}} {{summary}}
- schedule: {{firedAt}}
- plus whatever outputField any earlier "Run Riz Agent" step wrote (e.g. {{summary}}).

CATALOG-ONLY (the builder renders them but they do not execute yet): all other gmail/calendar/slack/telegram events, and github, notion, stripe, postgres, razorpay, paypal, discord, mongodb, calcom triggers, google-drive, google-sheets, google-docs, google-forms, google-meet. If the user explicitly wants one, add it but say plainly it won't run yet. Otherwise steer to a real equivalent.

RULES:
1. The CURRENT FLOW JSON in each message is ground truth. When the user says "the calendar step", "step 2", "that delay", resolve it against those steps and use that step's real "id" in your operation. Never invent a stepId, and never emit an update/remove for a step you are adding in the same turn — a new step's config goes inside its "add".
2. Exactly one trigger. If a trigger exists and the user wants a different one, emit {"op":"update","stepId":"<trigger's id>",...} — never a second add with kind "trigger".
3. Make minimal edits. Don't rebuild the flow when a one-step change does it, don't touch configs the user already set unless asked. When you do change a step's config, send the complete new config object for that step.
4. NEVER refuse or stall because an account isn't connected. Connections don't matter while building — the user links each step's account afterward by clicking the step. Don't mention connections unless the user asks.
5. Any freeform "have AI do X" request (summarize, extract, classify, rewrite, decide, anything prompt-driven) maps to ai "Run Riz Agent" with a clear prompt and sensible sourceField/outputField — it is not limited to extraction.
6. If the message is a question or chit-chat with nothing to change, return "operations": [] and just answer.
7. Fill configs with your best concrete defaults from what the user said (a real Gmail query, a real message template with {{fields}}) so the flow is as runnable as possible; they can refine in the step's panel.

OUTPUT — exactly one JSON object, nothing before or after it:
{
  "thinking": "1-3 short first-person sentences of your actual reasoning, shown to the user while the canvas updates.",
  "reply": "Your conversational answer. Mention any clamps or catalog-only caveats here. Plain text/Markdown.",
  "name": "optional — set only when naming or renaming the flow",
  "operations": [
    {"op":"add","kind":"trigger","app":"gmail","event":"New Email Matching Search","config":{"query":"is:unread"}},
    {"op":"add","kind":"action","app":"delay","event":"Delay","config":{"delayMinutes":1},"position":1},
    {"op":"update","stepId":"step_abc","config":{"message":"New mail from {{from}}: {{subject}}"}},
    {"op":"remove","stepId":"step_xyz"}
  ]
}`;
}

const OP_LIMIT = 12;
const STR_LIMIT = 200;
const CONFIG_LIMIT = 4_000;

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, STR_LIMIT) : undefined;
}

function cleanConfig(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    out[key] = val;
  }
  try {
    if (JSON.stringify(out).length > CONFIG_LIMIT) return undefined;
  } catch {
    return undefined;
  }
  return out;
}

/** Drops anything malformed rather than failing the turn — a bad op is worth
 * less than the good ones around it. */
export function sanitizeBuilderOperations(raw: unknown): BuilderOperation[] {
  if (!Array.isArray(raw)) return [];
  const out: BuilderOperation[] = [];
  for (const item of raw.slice(0, OP_LIMIT * 2)) {
    if (out.length >= OP_LIMIT) break;
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (record.op === "add") {
      const app = cleanString(record.app);
      const event = cleanString(record.event);
      const kind = record.kind === "trigger" ? "trigger" : record.kind === "action" ? "action" : undefined;
      if (!app || !event || !kind) continue;
      const position =
        typeof record.position === "number" && Number.isFinite(record.position)
          ? Math.max(0, Math.min(50, Math.round(record.position)))
          : undefined;
      out.push({ op: "add", kind, app, event, config: cleanConfig(record.config), ...(position !== undefined ? { position } : {}) });
    } else if (record.op === "update") {
      const stepId = cleanString(record.stepId);
      if (!stepId) continue;
      const app = cleanString(record.app);
      const event = cleanString(record.event);
      const config = cleanConfig(record.config);
      if (!app && !event && !config) continue;
      out.push({ op: "update", stepId, ...(app ? { app } : {}), ...(event ? { event } : {}), ...(config ? { config } : {}) });
    } else if (record.op === "remove") {
      const stepId = cleanString(record.stepId);
      if (!stepId) continue;
      out.push({ op: "remove", stepId });
    }
  }
  return out;
}
