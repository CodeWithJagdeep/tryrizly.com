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
register("trigger", "calcom", [
  "New Booking",
  "Booking Cancelled",
  "Booking Rescheduled",
  "Meeting Started",
  "Meeting Ended",
  "Out of Office Created",
], z.object({
  // Optional narrowing filter — most people want every booking, so this is
  // never required. Left blank, every booking on the account fires the flow.
  attendeeEmail: z.string().trim().max(320).optional(),
  account,
}).strict());
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
  // The server (guildId) picked in the flow-builder's "Server" field — purely
  // narrows which server's channels DiscordChannelPicker shows; channelId
  // above is still the only value actually matched at trigger time.
  account,
}).strict());
// No config needed — TelegramService resolves the exact userId from the
// owner-linked chatId before this ever reaches a flow filter, unlike
// Discord/Slack which need a channelId (or nothing at all matches).
register("trigger", "telegram", ["New Message"], z.object({}).strict());
// channelId only, mirroring Discord's trigger config exactly — matched by
// exact-string equality in AiCoreService.slackChannelEvent, never resolved
// via AI. No channelName field yet: unlike Discord there's no synced
// channel catalog on the Slack side to resolve a typed name against, so the
// flow builder has no picker for this — the raw channel ID must be entered
// (or wired up later once such a resolver exists).
register("trigger", "slack", ["New Message Posted to Channel"], z.object({
  channelId: shortText,
}).strict());
// Workspace-wide for whichever of our users is linked into that Slack team —
// no channelId to scope by, see AiCoreService.slackWorkspaceEvent.
register("trigger", "slack", ["New Mention", "New Reaction Added"], z.object({}).strict());
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
register("trigger", "dropbox", ["New File in Folder", "New or Updated File in Folder"], z.object({
  folderPath: shortText,
  account,
}).strict());
register("trigger", "dropbox", ["New Shared File"], z.object({ account }).strict());
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

// Split from "Send Direct Message" deliberately: the DM variant resolves the
// principal's own channel server-side and needs no target, while the channel
// variant must carry an explicit channelId — conflating them is what let
// "Send Channel Message" silently deliver to the DM instead.
register("action", "slack", ["Send Channel Message"], z.object({
  channelId: shortText,
  channelName: z.string().trim().max(200).optional(),
  message: templateText,
  account,
}).strict());
register("action", "slack", ["Send Direct Message"], z.object({
  message: templateText,
  account,
}).strict());
register("action", "telegram", ["Send Message", "Notify Me"], z.object({
  message: templateText,
  account,
}).strict());
register("action", "discord", ["Send Message"], z.object({
  message: templateText,
  // "self" (default) DMs whichever account the flow's owner linked; "user"
  // DMs an arbitrary Discord user by raw snowflake id instead.
  target: z.enum(["self", "user"]).optional(),
  targetUserId: z.string().trim().max(32).optional(),
  account,
}).strict());
register("action", "discord", ["Send Channel Message"], z.object({
  channelId: shortText,
  channelName: z.string().trim().max(200).optional(),
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
register("action", "github", ["Create Issue"], z.object({
  repo: shortText,
  title: templateText,
  body: optionalText,
  account,
}).strict());
// Not .strict(): older flows built before the trigger config UI was split
// from the "Create Issue" action may still carry unused title/body keys.
register("trigger", "github", ["New Pull Request", "New Issue", "New Push", "New Comment on Issue/PR"], z.object({
  repo: shortText,
  // Only meaningful for "New Push" — unset means the repo's default branch.
  branch: z.string().trim().max(250).optional(),
  account,
}));
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

function humanizeFieldName(path: string): string {
  const last = path.split(".").pop() || path;
  const spaced = last.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function validateAutomationStepConfig(step: AutomationStep): AutomationValidationResult {
  const schema = schemas.get(key(step));
  // No schema registered just means this live event needs no config of its
  // own (e.g. calcom's poll triggers, Notion's push-only "New Comment",
  // Telegram's owner-resolved "New Message") — validateAutomationFlowForActivation
  // only reaches this function after confirming isEventLive already, so an
  // unregistered combo here is "no shape to check", not "unsupported".
  if (!schema) return { ok: true };
  const result = schema.safeParse(step.config);
  if (result.success) return { ok: true };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => {
      const path = issue.path.join(".") || "config";
      // Zod's default "invalid_type" message ("Invalid input: expected
      // string, received undefined") is what you get for any empty required
      // field with no custom message registered — surface a plain-English
      // one instead of that internal text. Schemas with their own custom
      // `error`/message (e.g. calcom's Create Booking fields) pass through
      // untouched since their text never matches the default pattern.
      const message =
        issue.code === "invalid_type" && /^Invalid input/.test(issue.message)
          ? `${humanizeFieldName(path)} is required.`
          : issue.message;
      return { stepId: step.id, path, message };
    }),
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
  // Out of Office Created is deliberately excluded — verified live against a
  // real account and rejected (insufficient_scope: needs SCHEDULE_READ, which
  // the current Cal.com OAuth client doesn't request), so it can't fire yet.
  "trigger:calcom:New Booking",
  "trigger:calcom:Booking Cancelled",
  "trigger:calcom:Booking Rescheduled",
  "trigger:calcom:Meeting Started",
  "trigger:calcom:Meeting Ended",
  "trigger:discord:New Message",
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
  "action:discord:Send Message",
  "action:discord:Send Channel Message",
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
