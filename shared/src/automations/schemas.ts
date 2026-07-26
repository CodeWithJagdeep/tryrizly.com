import { z } from "zod";
import type { AutomationFlow, AutomationStep } from "./types";
import { isEventLive } from "./types";

const shortText = z.string().trim().min(1).max(4_000);
const templateText = z.string().min(1).max(20_000);
const optionalText = z.string().max(20_000).optional();
const account = z.string().trim().min(1).max(200).optional();
const outputField = z.string().trim().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/).optional();

const schemas = new Map<string, z.ZodType<Record<string, unknown>>>();

function key(step: Pick<AutomationStep, "kind" | "app" | "title">): string {
  return `${step.kind}:${step.app}:${step.title}`;
}

function register(
  kind: AutomationStep["kind"],
  app: string,
  titles: string[],
  schema: z.ZodType<Record<string, unknown>>,
) {
  for (const title of titles) schemas.set(`${kind}:${app}:${title}`, schema);
}

register("trigger", "schedule", ["Every Hour", "Every Day", "Every Week"], z.object({
  everyMinutes: z.number().int().min(1).max(525_600),
}).strict());
register("trigger", "gmail", ["New Email Matching Search"], z.object({
  query: z.string().max(2_000),
  account,
  subject: z.string().max(500).optional(),
  from: z.string().max(500).optional(),
  hasAttachment: z.boolean().optional(),
  unread: z.boolean().optional(),
  advanced: z.boolean().optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.query.trim()) {
    ctx.addIssue({ code: "custom", path: ["query"], message: "Add at least one Gmail search condition." });
  }
}));
register("trigger", "calendar", ["New Event"], z.object({ account }).strict());
register("trigger", "google-meet", ["Meeting Started"], z.object({ account }).strict());
register("trigger", "google-sheets", ["New Row"], z.object({
  spreadsheetId: shortText,
  range: shortText,
  hasHeaderRow: z.boolean().optional(),
  account,
}).strict());
register("trigger", "google-forms", ["New Submission"], z.object({
  spreadsheetId: shortText,
  range: shortText,
  hasHeaderRow: z.boolean().optional(),
  account,
}).strict());
register("trigger", "airtable", ["New Record"], z.object({
  baseId: shortText,
  table: shortText,
  account,
}).strict());
// channelId is the only value ever matched at trigger time (deterministic
// exact-string equality, never resolved via AI) — see
// discord.repository.ts's resolveChannel, run once at creation time when the
// principal types a channel name/#name, and AiCoreService.discordChannelEvent.
register("trigger", "discord", ["New Message"], z.object({
  channelId: shortText,
  channelName: z.string().trim().max(200).optional(),
  mode: z.enum(["notify", "summarize"]).default("notify"),
}).strict());
register("trigger", "shopify", ["New Order"], z.object({ account }).strict());
register("trigger", "shopify", ["Low Inventory"], z.object({
  // Fires when available drops to or below this threshold; unset means "any decrease".
  threshold: z.number().int().min(0).max(1_000_000).optional(),
  account,
}).strict());
register("trigger", "calendly", ["Booking Created", "Booking Cancelled"], z.object({ account }).strict());
register("trigger", "typeform", ["New Submission"], z.object({ account }).strict());
register("trigger", "gumroad", ["New Sale"], z.object({ account }).strict());
register("trigger", "lemonsqueezy", ["New Sale"], z.object({ account }).strict());
register("trigger", "dropbox", ["File Changed"], z.object({ account }).strict());
register("trigger", "figma", ["New Comment"], z.object({ account }).strict());
register("trigger", "uptimerobot", ["Monitor Down", "Monitor Up"], z.object({ account }).strict());
register("trigger", "quickbooks", ["New Invoice", "Invoice Paid"], z.object({ account }).strict());
register("trigger", "xero", ["New Invoice"], z.object({ account }).strict());
register("trigger", "wise", ["New Transaction"], z.object({ account }).strict());
register("trigger", "deel", ["New Contract", "Payment Completed"], z.object({ account }).strict());
register("trigger", "box", ["File Changed"], z.object({ account }).strict());
register("trigger", "statuspage", ["New Incident", "Incident Update"], z.object({ account }).strict());
register("trigger", "betterstack", ["Incident Started", "Incident Resolved"], z.object({ account }).strict());
register("trigger", "bamboohr", ["New Time Off Request", "New Hire"], z.object({ account }).strict());

register("action", "slack", ["Send Channel Message", "Send Direct Message"], z.object({
  message: templateText,
  account,
}).strict());
register("action", "telegram", ["Send Message", "Notify Me"], z.object({
  message: templateText,
  account,
}).strict());
register("action", "discord", ["Send Message"], z.object({
  message: templateText,
  account,
}).strict());
register("action", "delay", ["Delay"], z.object({
  delayMinutes: z.number().int().min(1).max(43_200),
}).strict());
register("action", "filter", ["Only Continue If"], z.object({
  field: shortText,
  operator: z.enum(["contains", "not_contains", "equals"]),
  value: z.string().max(4_000),
}).strict());
register("action", "ai", ["Run Riz Agent"], z.object({
  prompt: shortText,
  sourceField: z.string().trim().max(100).optional(),
  outputField,
  quality: z.enum(["fast", "advanced"]).optional(),
  outputType: z.enum(["text", "json", "boolean", "number"]).optional(),
  contextScopes: z.array(z.enum(["preferences", "memory", "decisions"])).max(3).optional(),
}).strict());
register("action", "calcom", ["Create Booking"], z.object({
  eventTypeId: z.number().int().positive(),
  start: shortText,
  attendeeName: shortText,
  attendeeEmail: shortText,
  timeZone: z.string().trim().max(100).optional(),
  notes: optionalText,
  account,
}).strict());
register("action", "github", ["Create Issue"], z.object({
  repo: shortText,
  title: templateText,
  body: optionalText,
  account,
}).strict());
register("action", "notion", ["Create Page"], z.object({
  parentId: shortText,
  parentType: z.enum(["database_id", "page_id"]).optional(),
  title: templateText,
  content: optionalText,
  account,
}).strict());
register("action", "stripe", ["Create Customer"], z.object({
  email: templateText,
  name: z.string().max(4_000).optional(),
  account,
}).strict());
register("action", "google-drive", ["Upload File"], z.object({
  name: templateText,
  mimeType: z.string().trim().max(200).optional(),
  content: templateText,
  account,
}).strict());
register("action", "google-sheets", ["Create Row"], z.object({
  spreadsheetId: shortText,
  range: shortText,
  values: templateText,
  account,
}).strict());
register("action", "google-docs", ["Create Document"], z.object({
  title: templateText,
  content: optionalText,
  account,
}).strict());
register("action", "google-meet", ["Create Meeting"], z.object({
  summary: templateText,
  start: templateText,
  durationMinutes: z.number().int().min(5).max(1_440).optional(),
  attendees: z.string().max(8_000).optional(),
  account,
}).strict());
register("action", "postgres", ["Run a Query"], z.object({
  query: shortText,
  paramsCsv: z.string().max(8_000).optional(),
  outputField,
  account,
}).strict());
register("action", "mongodb", ["Find Document"], z.object({
  collection: shortText,
  filter: z.string().max(20_000).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  outputField,
  account,
}).strict());
register("action", "jira", ["Create Issue"], z.object({
  projectKey: shortText,
  summary: templateText,
  description: optionalText,
  issueType: z.string().trim().max(100).optional(),
  account,
}).strict());
register("action", "pagerduty", ["Create Incident"], z.object({
  serviceId: shortText,
  title: templateText,
  urgency: z.enum(["high", "low"]).optional(),
  details: optionalText,
  account,
}).strict());
register("action", "trello", ["Create Card"], z.object({
  listId: shortText,
  name: templateText,
  description: optionalText,
  account,
}).strict());
register("action", "airtable", ["Create Record"], z.object({
  baseId: shortText,
  table: shortText,
  fields: shortText,
  account,
}).strict());
register("action", "twilio", ["Send SMS"], z.object({
  to: templateText,
  body: templateText,
  account,
}).strict());

export type AutomationValidationIssue = {
  stepId?: string;
  path: string;
  message: string;
};

export type AutomationValidationResult =
  | { ok: true }
  | { ok: false; issues: AutomationValidationIssue[] };

export function validateAutomationStepConfig(step: AutomationStep): AutomationValidationResult {
  const schema = schemas.get(key(step));
  if (!schema) {
    return {
      ok: false,
      issues: [{ stepId: step.id, path: "title", message: `Unsupported automation step: ${step.app} / ${step.title}` }],
    };
  }
  const result = schema.safeParse(step.config);
  if (result.success) return { ok: true };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      stepId: step.id,
      path: issue.path.join(".") || "config",
      message: issue.message,
    })),
  };
}

export function validateAutomationFlowForActivation(
  flow: Pick<AutomationFlow, "name" | "steps">,
): AutomationValidationResult {
  const issues: AutomationValidationIssue[] = [];
  if (!flow.name.trim()) issues.push({ path: "name", message: "Flow name is required." });
  if (flow.steps.length < 2) {
    issues.push({ path: "steps", message: "A flow needs one trigger and at least one action." });
  }
  if (flow.steps.length > 50) {
    issues.push({ path: "steps", message: "A flow can contain at most 50 steps." });
  }
  const ids = new Set<string>();
  flow.steps.forEach((step, index) => {
    if (!step.id || ids.has(step.id)) {
      issues.push({ stepId: step.id, path: `steps.${index}.id`, message: "Step ids must be present and unique." });
    }
    ids.add(step.id);
    const expectedKind = index === 0 ? "trigger" : "action";
    if (step.kind !== expectedKind) {
      issues.push({ stepId: step.id, path: `steps.${index}.kind`, message: `Step ${index + 1} must be an ${expectedKind}.` });
    }
    if (!isEventLive(step.app, expectedKind, step.title)) {
      issues.push({ stepId: step.id, path: `steps.${index}.title`, message: `${step.app} / ${step.title} is not executable.` });
      return;
    }
    const validated = validateAutomationStepConfig(step);
    if (!validated.ok) issues.push(...validated.issues);
  });
  return issues.length ? { ok: false, issues } : { ok: true };
}

const SAFE_TRIGGER_KEYS = new Set([
  "trigger:schedule:Every Hour",
  "trigger:schedule:Every Day",
  "trigger:schedule:Every Week",
  "trigger:gmail:New Email Matching Search",
  "trigger:calendar:New Event",
  "trigger:google-meet:Meeting Started",
]);

const SAFE_ACTION_KEYS = new Set([
  "action:telegram:Notify Me",
  "action:telegram:Send Message",
  "action:slack:Send Channel Message",
  "action:slack:Send Direct Message",
  "action:delay:Delay",
  "action:filter:Only Continue If",
  "action:ai:Run Riz Agent",
  "action:calcom:Create Booking",
  "action:google-meet:Create Meeting",
]);

export function validateAutomationReleasePolicy(
  flow: Pick<AutomationFlow, "steps">,
  tier: "safe" | "expanded",
): AutomationValidationResult {
  if (tier === "expanded") return { ok: true };
  const issues = flow.steps.flatMap((step) => {
    const allowed = step.kind === "trigger"
      ? SAFE_TRIGGER_KEYS.has(key(step))
      : SAFE_ACTION_KEYS.has(key(step));
    return allowed
      ? []
      : [{
          stepId: step.id,
          path: "title",
          message: `${step.app} / ${step.title} is not enabled in the safe automation release tier.`,
        }];
  });
  return issues.length ? { ok: false, issues } : { ok: true };
}

/** JSON Schema representation used by builder/model integrations. Runtime
 * enforcement always uses the same Zod source schema above. */
export function automationStepConfigJsonSchema(step: Pick<AutomationStep, "kind" | "app" | "title">) {
  const schema = schemas.get(key(step));
  return schema ? z.toJSONSchema(schema) : undefined;
}
