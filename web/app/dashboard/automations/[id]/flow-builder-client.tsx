"use client";

import "@xyflow/react/dist/style.css";

import {
  BaseEdge,
  Background,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AirtableIcon,
  CalComIcon,
  CalendarIcon,
  DiscordIcon,
  GitHubIcon,
  GmailIcon,
  GoogleDocsIcon,
  GoogleDriveIcon,
  GoogleFormsIcon,
  GoogleMeetIcon,
  GoogleSheetsIcon,
  JiraIcon,
  MongoDbIcon,
  NotionIcon,
  PagerDutyIcon,
  PayPalIcon,
  PostgresIcon,
  RazorpayIcon,
  SlackIcon,
  StripeIcon,
  TelegramIcon,
  TrelloIcon,
  TwilioIcon,
} from "../../../components/ConnectorIcons";
import { ArrowUpIcon, ClockIcon, PlugIcon, WandIcon } from "../../components/icons";
import { MarkdownMessage } from "../../components/MarkdownMessage";
import {
  activateFlow,
  type AutomationFlow,
  type AutomationRun,
  type AutomationStep,
  type BuilderChatOp,
  builderChat,
  deleteFlow,
  getFlow,
  listRuns,
  newFlowId,
  newStepId,
  pauseFlow,
  saveFlow,
} from "../../lib/automation-store";

// ── App catalog ─────────────────────────────────────────────────────────────

type EventKind = "Polling" | "Instant" | "Action";

type AppEvent = {
  name: string;
  description: string;
  kind: EventKind;
};

type AppDef = {
  id: string;
  name: string;
  triggers: AppEvent[];
  actions: AppEvent[];
  category?: string;
};

// Apps with hand-written trigger/action copy and real SVG logos.
const DETAILED_APPS: AppDef[] = [
  {
    id: "gmail",
    name: "Gmail",
    category: "Email & Calendar",
    triggers: [
      { name: "New Attachment", description: "Triggers when you receive a new attachment.", kind: "Polling" },
      { name: "New Conversation", description: "Triggers when a new email conversation begins in your inbox.", kind: "Polling" },
      { name: "New Email", description: "Triggers when a new email appears in the specified mailbox.", kind: "Polling" },
      { name: "New Email Matching Search", description: "Triggers when you receive a new email that matches a search string you provide.", kind: "Polling" },
      { name: "New Label", description: "Triggers when you add a new label.", kind: "Polling" },
      { name: "New Labeled Conversation", description: "Triggers the first time a label is added to a conversation. Replies within that conversation will not trigger again.", kind: "Polling" },
      { name: "New Labeled Email", description: "Triggers when an email is labeled. Also triggers when a reply is added to the conversation.", kind: "Polling" },
      { name: "New Starred Email", description: "Triggers when you receive a new email and star it within two days.", kind: "Polling" },
    ],
    actions: [
      { name: "Send Email", description: "Sends an email from your Gmail account.", kind: "Action" },
      { name: "Create Draft", description: "Creates a draft email in your Gmail account.", kind: "Action" },
      { name: "Reply to Email", description: "Sends a reply to an existing email thread.", kind: "Action" },
      { name: "Add Label to Email", description: "Applies a label to an existing email.", kind: "Action" },
    ],
  },
  {
    id: "calendar",
    name: "Google Calendar",
    category: "Email & Calendar",
    triggers: [
      { name: "New Event", description: "Triggers when an event is created in your calendar.", kind: "Polling" },
      { name: "Event Start", description: "Triggers a specified time before an event starts.", kind: "Polling" },
      { name: "Event Cancelled", description: "Triggers when an event is cancelled.", kind: "Polling" },
      { name: "New or Updated Event", description: "Triggers when an event is created or updated.", kind: "Polling" },
    ],
    actions: [
      { name: "Create Detailed Event", description: "Creates an event with the details you specify.", kind: "Action" },
      { name: "Update Event", description: "Updates an existing event.", kind: "Action" },
      { name: "Find Availability", description: "Finds free/busy time across your calendars.", kind: "Action" },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    category: "Communication",
    triggers: [
      { name: "New Message Posted to Channel", description: "Triggers when a new message is posted to a channel.", kind: "Instant" },
      { name: "New Mention", description: "Triggers when your username is mentioned in a channel.", kind: "Instant" },
      { name: "New Reaction Added", description: "Triggers when a reaction is added to a message.", kind: "Instant" },
    ],
    actions: [
      { name: "Send Channel Message", description: "Posts a message to a channel you choose.", kind: "Action" },
      { name: "Send Direct Message", description: "Sends a direct message to a user.", kind: "Action" },
    ],
  },
  {
    id: "telegram",
    name: "Telegram",
    category: "Communication",
    triggers: [{ name: "New Message", description: "Triggers when a new message is received by your bot.", kind: "Instant" }],
    actions: [
      { name: "Notify Me", description: "Sends you a Telegram notification.", kind: "Action" },
      { name: "Send Message", description: "Sends a message to a chat or user.", kind: "Action" },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    category: "Developer & IT Tools",
    triggers: [
      { name: "New Pull Request", description: "Triggers when a new pull request is opened.", kind: "Instant" },
      { name: "New Issue", description: "Triggers when a new issue is created.", kind: "Instant" },
      { name: "New Push", description: "Triggers when a commit is pushed to a branch.", kind: "Instant" },
    ],
    actions: [
      { name: "Create Issue", description: "Creates a new issue in a repository.", kind: "Action" },
      { name: "Create Comment", description: "Comments on an issue or pull request.", kind: "Action" },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    category: "Productivity & Files",
    triggers: [
      { name: "New Database Item", description: "Triggers when a new item is added to a database.", kind: "Polling" },
      { name: "Updated Database Item", description: "Triggers when an item in a database is updated.", kind: "Polling" },
    ],
    actions: [
      { name: "Create Page", description: "Creates a new page in a database.", kind: "Action" },
      { name: "Update Page", description: "Updates the properties of an existing page.", kind: "Action" },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Payments",
    triggers: [
      { name: "New Payment", description: "Triggers when a new payment is completed.", kind: "Instant" },
      { name: "New Subscription", description: "Triggers when a customer starts a new subscription.", kind: "Instant" },
      { name: "Failed Charge", description: "Triggers when a charge fails.", kind: "Instant" },
    ],
    actions: [
      { name: "Create Customer", description: "Creates a new customer record.", kind: "Action" },
      { name: "Create Invoice", description: "Creates a new invoice for a customer.", kind: "Action" },
    ],
  },
  {
    id: "postgres",
    name: "Postgres",
    category: "Databases",
    triggers: [{ name: "New Row", description: "Triggers when a new row is added to a table.", kind: "Polling" }],
    actions: [
      { name: "Run a Query", description: "Runs a read-only SQL query and feeds the results into later steps.", kind: "Action" },
      { name: "Insert Row", description: "Inserts a new row into a table.", kind: "Action" },
    ],
  },
  {
    id: "schedule",
    name: "Schedule",
    category: "Scheduling",
    triggers: [
      { name: "Every Day", description: "Triggers every day at a time you choose.", kind: "Polling" },
      { name: "Every Hour", description: "Triggers once every hour.", kind: "Polling" },
      { name: "Every Week", description: "Triggers on the days of the week you choose.", kind: "Polling" },
    ],
    actions: [],
  },
];

// The remaining apps Rizly actually connects to (see connector.service.ts /
// connectors-client.tsx) but that don't yet have hand-written trigger/action
// copy. Every app here has a real logo in APP_ICONS below — no fallback tile.
const REMAINING_APPS: AppDef[] = [
  {
    id: "calcom",
    name: "Cal.com",
    category: "Scheduling",
    triggers: [{ name: "New Booking", description: "Triggers when a new booking is made in Cal.com.", kind: "Instant" }],
    actions: [{ name: "Create Booking", description: "Creates a booking in Cal.com.", kind: "Action" }],
  },
  {
    id: "razorpay",
    name: "Razorpay",
    category: "Payments",
    triggers: [
      { name: "New Payment", description: "Triggers when a payment succeeds in Razorpay.", kind: "Instant" },
      { name: "Failed Payment", description: "Triggers when a payment fails in Razorpay.", kind: "Instant" },
    ],
    actions: [{ name: "Create Invoice", description: "Creates an invoice in Razorpay.", kind: "Action" }],
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "Payments",
    triggers: [
      { name: "New Payment", description: "Triggers when a payment succeeds in PayPal.", kind: "Instant" },
      { name: "New Refund", description: "Triggers when a refund is issued in PayPal.", kind: "Instant" },
    ],
    actions: [{ name: "Create Invoice", description: "Creates an invoice in PayPal.", kind: "Action" }],
  },
  {
    id: "discord",
    name: "Discord",
    category: "Communication",
    triggers: [{ name: "New Message", description: "Triggers when a new message is posted in Discord.", kind: "Instant" }],
    actions: [{ name: "Send Message", description: "Sends a message in Discord.", kind: "Action" }],
  },
  {
    id: "mongodb",
    name: "MongoDB",
    category: "Databases",
    triggers: [{ name: "New Document", description: "Triggers when a new document is added in MongoDB.", kind: "Polling" }],
    actions: [
      { name: "Insert Document", description: "Inserts a new document into a collection.", kind: "Action" },
      { name: "Find Document", description: "Finds a document in a collection.", kind: "Action" },
    ],
  },
  // Drive/Sheets/Docs share one OAuth grant ("google_workspace" — see
  // oauthProviderFor below); Meet reuses the existing Calendar connection and
  // needs no grant of its own (createEvent always requests a Meet link).
  {
    id: "google-drive",
    name: "Google Drive",
    category: "Productivity & Files",
    triggers: [{ name: "New File", description: "Triggers when a new file is added in Google Drive.", kind: "Polling" }],
    actions: [{ name: "Upload File", description: "Uploads a file to Google Drive.", kind: "Action" }],
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    category: "Databases",
    triggers: [{ name: "New Row", description: "Triggers when a new row is added in Google Sheets.", kind: "Polling" }],
    actions: [{ name: "Create Row", description: "Creates a new row in Google Sheets.", kind: "Action" }],
  },
  {
    id: "google-docs",
    name: "Google Docs",
    category: "Productivity & Files",
    triggers: [],
    actions: [{ name: "Create Document", description: "Creates a new document in Google Docs.", kind: "Action" }],
  },
  {
    id: "google-forms",
    name: "Google Forms",
    category: "Productivity & Files",
    triggers: [{ name: "New Submission", description: "Triggers when a new response is added to the form's response sheet.", kind: "Polling" }],
    actions: [],
  },
  {
    id: "google-meet",
    name: "Google Meet",
    category: "Communication",
    triggers: [{ name: "Meeting Started", description: "Triggers when a Meet-enabled calendar event starts.", kind: "Polling" }],
    actions: [{ name: "Create Meeting", description: "Creates a Calendar event with a Google Meet link.", kind: "Action" }],
  },
  // Manual API-key/token connectors — no OAuth app to register, connects
  // instantly from the connectors page.
  {
    id: "jira",
    name: "Jira",
    category: "Developer & IT Tools",
    triggers: [{ name: "New Issue", description: "Triggers when a new issue is created in a project.", kind: "Polling" }],
    actions: [{ name: "Create Issue", description: "Creates a new issue in a Jira project.", kind: "Action" }],
  },
  {
    id: "pagerduty",
    name: "PagerDuty",
    category: "Developer & IT Tools",
    triggers: [{ name: "New Incident", description: "Triggers when a new incident is created on a service.", kind: "Polling" }],
    actions: [{ name: "Create Incident", description: "Opens a new incident on a PagerDuty service.", kind: "Action" }],
  },
  {
    id: "trello",
    name: "Trello",
    category: "Productivity & Files",
    triggers: [{ name: "New Card", description: "Triggers when a new card is added to a list.", kind: "Polling" }],
    actions: [{ name: "Create Card", description: "Creates a new card in a Trello list.", kind: "Action" }],
  },
  {
    id: "airtable",
    name: "Airtable",
    category: "Databases",
    triggers: [{ name: "New Record", description: "Triggers when a new record is added to a table.", kind: "Polling" }],
    actions: [{ name: "Create Record", description: "Creates a new record in an Airtable table.", kind: "Action" }],
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "Communication",
    triggers: [],
    actions: [{ name: "Send SMS", description: "Sends a text message via your Twilio number.", kind: "Action" }],
  },
];

// No cosmetic-only Google Workspace apps remain — all five (Drive, Sheets,
// Docs, Forms, Meet) execute for real now (see REMAINING_APPS above).
const COSMETIC_APPS: AppDef[] = [];

// Flow-control steps — not third-party connectors, no account needed. Let you
// build "trigger -> wait -> only continue if -> action" chains.
const UTILITY_APPS: AppDef[] = [
  {
    id: "delay",
    name: "Delay",
    category: "Flow control",
    triggers: [],
    actions: [{ name: "Delay", description: "Pauses the automation for a set number of minutes before continuing.", kind: "Action" }],
  },
  {
    id: "filter",
    name: "Filter",
    category: "Flow control",
    triggers: [],
    actions: [{ name: "Only Continue If", description: "Stops the automation here unless a field from the trigger matches a condition.", kind: "Action" }],
  },
  {
    id: "ai",
    name: "Riz Agent",
    category: "Flow control",
    triggers: [],
    actions: [{ name: "Run Riz Agent", description: "Give it any prompt — summarize, extract, decide, rewrite, whatever you need — against data from the trigger. Uses AI credits.", kind: "Action" }],
  },
];

const APPS: AppDef[] = [...DETAILED_APPS, ...REMAINING_APPS, ...COSMETIC_APPS, ...UTILITY_APPS];

const APP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  gmail: GmailIcon,
  calendar: CalendarIcon,
  slack: SlackIcon,
  telegram: TelegramIcon,
  github: GitHubIcon,
  notion: NotionIcon,
  stripe: StripeIcon,
  postgres: PostgresIcon,
  discord: DiscordIcon,
  paypal: PayPalIcon,
  razorpay: RazorpayIcon,
  calcom: CalComIcon,
  mongodb: MongoDbIcon,
  "google-drive": GoogleDriveIcon,
  "google-sheets": GoogleSheetsIcon,
  "google-docs": GoogleDocsIcon,
  "google-forms": GoogleFormsIcon,
  "google-meet": GoogleMeetIcon,
  jira: JiraIcon,
  pagerduty: PagerDutyIcon,
  trello: TrelloIcon,
  airtable: AirtableIcon,
  twilio: TwilioIcon,
};

function AppIcon({ app, className }: { app: string; className?: string }) {
  const Icon = APP_ICONS[app];
  if (Icon) return <Icon className={className} />;
  if (app === "schedule" || app === "delay") return <ClockIcon className={className} />;
  if (app === "filter") return <BranchGlyph className={className} />;
  if (app === "ai") return <WandIcon className={className} />;
  return <PlugIcon className={className} />;
}

const appDef = (id: string) => APPS.find((a) => a.id === id);
const appName = (id: string) => appDef(id)?.name ?? "";

// How each app is actually connected in Rizly — the "Account" step differs a lot
// by provider, so the config panel branches on this instead of always showing an
// OAuth "Sign in" button.
type ConnectMethod = "oauth" | "bot" | "secret" | "none";

function connectMethod(appId: string): ConnectMethod {
  if (appId === "telegram") return "bot"; // deep-link / QR to the Rizly bot
  if (appId === "schedule" || appId === "delay" || appId === "filter" || appId === "ai") return "none"; // built-in, no account
  if (
    appId === "stripe" ||
    appId === "postgres" ||
    appId === "discord" ||
    appId === "jira" ||
    appId === "pagerduty" ||
    appId === "trello" ||
    appId === "twilio"
  ) {
    return "secret";
  }
  // Google Sheets is OAuth (bundled under google_workspace), despite sharing
  // the "Databases" category label with Postgres/MongoDB below.
  if (appId === "google-sheets" || appId === "google-drive" || appId === "google-docs" || appId === "google-meet") {
    return "oauth";
  }
  // Databases and AI models connect with a connection string / API key.
  const cat = appDef(appId)?.category;
  if (cat === "Databases" || cat === "AI" || cat === "Analytics") return "secret";
  // Everything else is OAuth "Sign in".
  return "oauth";
}

// Which connector a given app id's "Sign in" / connection-status check
// actually targets — most apps connect 1:1, but Drive/Sheets/Docs share a
// single "google_workspace" grant and Meet reuses the existing Calendar
// connection outright (no separate grant of its own).
function oauthProviderFor(appId: string): string {
  if (appId === "google-drive" || appId === "google-sheets" || appId === "google-docs" || appId === "google-forms") {
    return "google_workspace";
  }
  if (appId === "google-meet") return "calendar";
  return appId;
}

// ── v1 execution scope ──────────────────────────────────────────────────────
// Mirrors shared/src/automations/types.ts (LIVE_TRIGGER_EVENTS/LIVE_ACTION_EVENTS)
// on the backend — web can't import the monorepo's shared package (it's a
// separately-deployed nested repo), so this list is duplicated deliberately.
// Everything outside it renders in the catalog but is disabled ("Coming soon"):
// the flow builder no longer promises execution it can't deliver.

const LIVE_TRIGGER_EVENTS: Record<string, string[]> = {
  schedule: ["Every Day", "Every Hour", "Every Week"],
  gmail: ["New Email Matching Search"],
  calendar: ["New Event"],
  "google-sheets": ["New Row"],
  "google-forms": ["New Submission"],
  "google-meet": ["Meeting Started"],
  airtable: ["New Record"],
};

const LIVE_ACTION_EVENTS: Record<string, string[]> = {
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
  // Read-only enrich steps — Rizly can't store a write-capable Postgres/Mongo
  // credential (rejected at connect time), so "Insert Row"/"Insert Document"
  // stay disabled below.
  postgres: ["Run a Query"],
  mongodb: ["Find Document"],
  jira: ["Create Issue"],
  pagerduty: ["Create Incident"],
  trello: ["Create Card"],
  airtable: ["Create Record"],
  twilio: ["Send SMS"],
  delay: ["Delay"],
  filter: ["Only Continue If"],
  ai: ["Run Riz Agent"],
};

function isAppLive(appId: string, kind: AutomationStep["kind"]): boolean {
  const map = kind === "trigger" ? LIVE_TRIGGER_EVENTS : LIVE_ACTION_EVENTS;
  return (map[appId]?.length ?? 0) > 0;
}

function isEventLive(appId: string, kind: AutomationStep["kind"], eventName: string): boolean {
  const map = kind === "trigger" ? LIVE_TRIGGER_EVENTS : LIVE_ACTION_EVENTS;
  return Boolean(map[appId]?.includes(eventName));
}

/** When an app has exactly one live event for this step kind, skip making the user pick it — auto-select it. */
function soleLiveEvent(appId: string, kind: AutomationStep["kind"]): string | undefined {
  const map = kind === "trigger" ? LIVE_TRIGGER_EVENTS : LIVE_ACTION_EVENTS;
  const events = map[appId];
  return events?.length === 1 ? events[0] : undefined;
}

function isFlowRunnable(steps: AutomationStep[]): boolean {
  const [trigger, ...actions] = steps;
  if (!trigger || trigger.kind !== "trigger" || !trigger.app) return false;
  if (!isEventLive(trigger.app, "trigger", trigger.title)) return false;
  if (actions.length === 0) return false;
  return actions.every((step) => step.app && isEventLive(step.app, "action", step.title));
}


// ── Layout constants ─────────────────────────────────────────────────────────

const NODE_GAP = 176;

// ── Node data types ────────────────────────────────────────────────────────────

type StepNodeData = {
  step: AutomationStep;
  index: number;
  selected: boolean;
  onOpen: () => void;
  onDelete?: () => void;
};
type AdderNodeData = { onAdd: () => void };
type InsertEdgeData = { onInsert: () => void };

// ── Custom node: a numbered step card (Zapier-style) ───────────────────────────

function StepNode({ data }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const { step, index, selected } = d;
  const isTrigger = step.kind === "trigger";
  const hasApp = !!step.app;
  const hasEvent = !!step.title;

  return (
    <div
      onClick={d.onOpen}
      className={`group w-[352px] cursor-pointer rounded-[10px] border-2 bg-white px-4 pb-4 pt-3 transition ${
        selected
          ? "border-[#6C4BF4] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          : "border-slate-200 shadow-sm hover:border-slate-300"
      }`}
    >
      {!isTrigger && (
        <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
      )}

      {/* Header row: chip + kebab */}
      <div className="flex items-center justify-between">
        {hasApp ? (
          <span className="inline-flex items-center gap-1.5">
            <AppIcon app={step.app} className="h-[18px] w-[18px]" />
            <span className="text-[13px] font-semibold text-slate-800">{appName(step.app)}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5">
            {isTrigger ? <BoltGlyph className="h-3.5 w-3.5 text-slate-500" /> : <GearGlyph className="h-3.5 w-3.5 text-slate-500" />}
            <span className="text-[12px] font-semibold text-slate-600">{isTrigger ? "Trigger" : "Action"}</span>
          </span>
        )}
        <div className="flex items-center gap-1">
          {d.onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                d.onDelete?.();
              }}
              title="Remove step"
              className="nopan nodrag flex h-6 w-6 items-center justify-center rounded-md text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-red-500 group-hover:opacity-100"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </button>
          )}
          <span className="flex h-6 w-6 items-center justify-center text-slate-400">
            <KebabGlyph className="h-4 w-4" />
          </span>
        </div>
      </div>

      {/* Title row */}
      <div className="mt-2 text-[15px]">
        <span className="font-semibold text-slate-900">{index + 1}. </span>
        <span className={hasEvent ? "text-slate-900" : "text-slate-500"}>
          {hasEvent ? (step.label || step.title) : isTrigger ? "Select the event" : "Select the event for your Zap to run"}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-slate-300" />
    </div>
  );
}

function AdderNode({ data }: NodeProps) {
  const d = data as unknown as AdderNodeData;
  return (
    <div className="flex w-[352px] justify-center">
      <Handle type="target" position={Position.Top} className="!h-0 !w-0 !border-0 !bg-transparent" />
      <button
        type="button"
        onClick={d.onAdd}
        title="Add a step"
        className="nopan nodrag flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white hover:text-[#6C4BF4] hover:shadow-sm"
      >
        <PlusGlyph />
      </button>
    </div>
  );
}

// Shown alone on a brand-new, blank flow — one clear call to action instead of
// a pre-seeded trigger+action stub pair with two "Select the event" nodes.
function StartTriggerNode({ data }: NodeProps) {
  const d = data as unknown as AdderNodeData;
  return (
    <button
      type="button"
      onClick={d.onAdd}
      className="flex w-[352px] items-center gap-3 rounded-[10px] border-2 border-dashed border-[#6C4BF4]/40 bg-white px-4 py-4 text-left transition hover:border-[#6C4BF4] hover:bg-[#6C4BF4]/5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6C4BF4]/10 text-[#6C4BF4]">
        <BoltGlyph className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-[15px] font-semibold text-slate-900">Start trigger</span>
        <span className="block text-[13px] text-slate-500">Choose the app and event that kicks this off.</span>
      </span>
      <Handle type="source" position={Position.Bottom} className="!h-0 !w-0 !border-0 !bg-transparent" />
    </button>
  );
}

function InsertEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const d = data as unknown as InsertEdgeData;
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    borderRadius: 8,
  });

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: "#c9c7c2", strokeWidth: 1.5 }} />
      <EdgeLabelRenderer>
        <button
          type="button"
          onClick={d.onInsert}
          title="Insert step"
          className="nodrag nopan absolute flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-white hover:text-[#6C4BF4] hover:shadow-sm"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <PlusGlyph />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { step: StepNode, adder: AdderNode, start: StartTriggerNode };
const edgeTypes = { insert: InsertEdge };

// ── Builder ────────────────────────────────────────────────────────────────────

function Builder({ flowId }: { flowId: string }) {
  const rf = useReactFlow();
  const router = useRouter();
  const [name, setName] = useState("Untitled Zap");
  const [steps, setSteps] = useState<AutomationStep[]>([]);
  const [saved, setSaved] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [status, setStatus] = useState<AutomationFlow["status"]>("draft");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [chatOpen, setChatOpen] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const refreshRuns = useCallback(() => {
    listRuns(flowId).then(setRuns).catch(() => setRuns([]));
  }, [flowId]);

  useEffect(() => {
    let cancelled = false;
    getFlow(flowId).then((flow) => {
      if (cancelled) return;
      // A found flow loads as-is; an unknown id (e.g. a shared/deep-linked URL
      // with no matching flow) starts as a blank draft — no sample pipeline.
      if (flow) {
        setName(flow.name);
        setSteps(flow.steps);
        setStatus(flow.status);
        setSelectedId(flow.steps[0]?.id ?? null);
      } else {
        setName("Untitled Zap");
        setSteps([]);
        setStatus("draft");
        setSelectedId(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [flowId]);

  useEffect(() => {
    refreshRuns();
  }, [refreshRuns]);

  const insertStep = useCallback((index: number) => {
    // Position 0 on a blank canvas is always the trigger; every other insert
    // (append at the end, or between two existing steps) is an action.
    const step: AutomationStep = {
      id: newStepId(),
      kind: index === 0 ? "trigger" : "action",
      title: "",
      subtitle: "",
      app: "",
      config: {},
    };
    setSteps((prev) => {
      const next = [...prev];
      next.splice(index, 0, step);
      return next;
    });
    setSelectedId(step.id);
    setSaved(false);
  }, []);

  const patchStep = useCallback((id: string, patch: Partial<AutomationStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setSaved(false);
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
    setSaved(false);
  }, []);

  // Latest steps/name for async flows (the chat panel applies ops over several
  // seconds; closures captured at call time would be stale by the save).
  const stepsRef = useRef<AutomationStep[]>(steps);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  /**
   * Applies the builder agent's edit operations to the canvas one at a time,
   * with a beat between each so the user watches the flow assemble/change in
   * real time, then persists the result. onProgress fires as each op lands so
   * the chat panel can tick off what's happening.
   */
  const applyBuilderOps = useCallback(
    async (
      ops: BuilderChatOp[],
      newName: string | undefined,
      onProgress: (icon: "add" | "remove" | "update" | "name", label: string) => void,
    ) => {
      const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
      const stepLabel = (app: string, event: string) => `${appName(app) || app} — ${event}`;

      if (newName?.trim()) {
        setName(newName.trim());
        setSaved(false);
        onProgress("name", `Renamed the flow to “${newName.trim()}”`);
        await sleep(500);
      }

      for (const op of ops) {
        const current = stepsRef.current;
        if (op.op === "add") {
          const existingTrigger = current.find((s) => s.kind === "trigger");
          if (op.kind === "trigger" && existingTrigger) {
            // Single-trigger invariant: a second trigger add becomes an update.
            setSteps((prev) =>
              prev.map((s) =>
                s.id === existingTrigger.id
                  ? { ...s, app: op.app, title: op.event, subtitle: appName(op.app), config: op.config ?? {} }
                  : s,
              ),
            );
            onProgress("update", stepLabel(op.app, op.event));
          } else {
            const step: AutomationStep = {
              id: newStepId(),
              kind: op.kind,
              title: op.event,
              subtitle: appName(op.app),
              app: op.app,
              config: op.config ?? {},
            };
            setSteps((prev) => {
              const next = [...prev];
              const hasTrigger = next.some((s) => s.kind === "trigger");
              const minPos = op.kind === "trigger" ? 0 : hasTrigger ? 1 : 0;
              const rawPos = op.kind === "trigger" ? 0 : (op.position ?? next.length);
              const pos = Math.max(minPos, Math.min(rawPos, next.length));
              next.splice(pos, 0, step);
              return next;
            });
            onProgress("add", stepLabel(op.app, op.event));
          }
          setSaved(false);
        } else if (op.op === "update") {
          const target = current.find((s) => s.id === op.stepId);
          if (!target) continue;
          const nextApp = op.app ?? target.app;
          setSteps((prev) =>
            prev.map((s) =>
              s.id === op.stepId
                ? {
                    ...s,
                    app: nextApp,
                    title: op.event ?? s.title,
                    subtitle: appName(nextApp),
                    ...(op.config ? { config: op.config } : {}),
                  }
                : s,
            ),
          );
          setSaved(false);
          onProgress("update", stepLabel(nextApp, op.event ?? target.title));
        } else if (op.op === "remove") {
          const target = current.find((s) => s.id === op.stepId);
          if (!target) continue;
          setSteps((prev) => prev.filter((s) => s.id !== op.stepId));
          setSelectedId((cur) => (cur === op.stepId ? null : cur));
          setSaved(false);
          onProgress("remove", stepLabel(target.app, target.title || "step"));
        }
        await sleep(550);
      }

      // Persist what's now on the canvas so the built flow survives navigation.
      const flow = await saveFlow({
        id: flowId,
        name: nameRef.current.trim() || "Untitled Zap",
        steps: stepsRef.current.map((s) => ({ ...s, subtitle: appName(s.app) })),
      });
      if (flow) {
        setStatus(flow.status);
        setSaved(true);
      }
    },
    [flowId],
  );

  const built = useMemo(() => {
    if (steps.length === 0) {
      return {
        flowNodes: [
          {
            id: "__start",
            type: "start",
            position: { x: 0, y: 0 },
            draggable: false,
            data: { onAdd: () => insertStep(0) } satisfies AdderNodeData as unknown as Record<string, unknown>,
          },
        ] as Node[],
        flowEdges: [] as Edge[],
      };
    }

    const flowNodes: Node[] = steps.map((step, i) => ({
      id: step.id,
      type: "step",
      position: { x: 0, y: i * NODE_GAP },
      draggable: false,
      data: {
        step,
        index: i,
        selected: step.id === selectedId,
        onOpen: () => setSelectedId(step.id),
        onDelete: step.kind === "trigger" ? undefined : () => removeStep(step.id),
      } satisfies StepNodeData as unknown as Record<string, unknown>,
    }));

    flowNodes.push({
      id: "__adder",
      type: "adder",
      position: { x: 0, y: steps.length * NODE_GAP },
      draggable: false,
      data: { onAdd: () => insertStep(steps.length) } satisfies AdderNodeData as unknown as Record<string, unknown>,
    });

    const flowEdges: Edge[] = [];
    for (let i = 0; i < steps.length - 1; i++) {
      flowEdges.push({
        id: `e-${steps[i].id}-${steps[i + 1].id}`,
        source: steps[i].id,
        target: steps[i + 1].id,
        type: "insert",
        data: { onInsert: () => insertStep(i + 1) } satisfies InsertEdgeData as unknown as Record<string, unknown>,
      });
    }
    if (steps.length > 0) {
      flowEdges.push({
        id: `e-${steps[steps.length - 1].id}-adder`,
        source: steps[steps.length - 1].id,
        target: "__adder",
        type: "smoothstep",
        style: { stroke: "#c9c7c2", strokeWidth: 1.5 },
      });
    }

    return { flowNodes, flowEdges };
  }, [steps, selectedId, insertStep, removeStep]);

  useEffect(() => {
    setNodes(built.flowNodes);
    setEdges(built.flowEdges);
  }, [built, setNodes, setEdges]);

  useEffect(() => {
    const t = setTimeout(() => rf.fitView({ padding: 0.32, duration: 200, maxZoom: 0.9 }), 60);
    return () => clearTimeout(t);
  }, [steps.length, rf]);

  async function handleSave() {
    const flow = await saveFlow({
      id: flowId,
      name: name.trim() || "Untitled Zap",
      steps: steps.map((s) => ({ ...s, subtitle: appName(s.app) })),
    });
    if (flow) setStatus(flow.status);
    setSaved(true);
  }

  async function handleDuplicate() {
    const newId = newFlowId();
    await saveFlow({ id: newId, name: `${name.trim() || "Untitled Zap"} (copy)`, steps });
    router.push(`/dashboard/automations/${newId}`);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    await deleteFlow(flowId);
    router.push("/dashboard/automations");
  }

  const runnable = useMemo(() => isFlowRunnable(steps), [steps]);

  async function handlePublish() {
    setPublishError(null);
    setPublishing(true);
    try {
      // Persist the latest edits first — activation reads the saved flow.
      await saveFlow({ id: flowId, name: name.trim() || "Untitled Zap", steps });
      setSaved(true);
      const result =
        status === "active" ? await pauseFlow(flowId) : await activateFlow(flowId);
      if (!result.ok) {
        setPublishError(
          result.issues?.[0]?.message ??
          (result.error === "flow_not_runnable"
            ? "This flow needs a live trigger and at least one live action before it can run."
            : (result.error ?? "Couldn't update this automation.")),
        );
        return;
      }
      setStatus(status === "active" ? "paused" : "active");
      refreshRuns();
    } finally {
      setPublishing(false);
    }
  }

  const selectedStep = steps.find((s) => s.id === selectedId) ?? null;
  const selectedIndex = steps.findIndex((s) => s.id === selectedId);

  return (
    <main className="fixed inset-0 z-50 flex overflow-hidden bg-[#faf9f7] text-slate-900">
      {/* Far-left icon rail */}
      <LeftRail chatOpen={chatOpen} onToggleChat={() => setChatOpen((v) => !v)} />

      {/* Everything right of the rail */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          name={name}
          setName={setName}
          setSaved={setSaved}
          status={status}
          saved={saved}
          onDuplicate={() => void handleDuplicate()}
          onDelete={() => void handleDelete()}
          onSave={() => void handleSave()}
          runnable={runnable}
          publishing={publishing}
          onPublish={() => void handlePublish()}
        />
        <SubBar publishError={publishError} />
        {/* Canvas area */}
        <div className="relative min-h-0 flex-1">
          <style>{`
            .react-flow__node.selected, .react-flow__node:focus, .react-flow__node:focus-visible { box-shadow: none !important; outline: none !important; }
          `}</style>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            selectNodesOnDrag={false}
            minZoom={0.4}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            fitView
            fitViewOptions={{ padding: 0.32, maxZoom: 0.9 }}
          >
            <Background gap={20} size={1.4} color="#dedcd6" />
          </ReactFlow>

          {/* Chat panel (floating, overlays the left edge) */}
          {chatOpen && (
            <div className="absolute inset-x-2 bottom-2 top-2 sm:inset-y-3 sm:right-auto sm:left-3 sm:w-[min(380px,calc(100vw-1.5rem))]">
              <ChatPanel
                flowId={flowId}
                flowName={name}
                steps={steps}
                onApplyOps={applyBuilderOps}
                onClose={() => setChatOpen(false)}
              />
            </div>
          )}

          {/* Config panel (floating, overlays the right edge) */}
          {selectedStep && (
            <div
              className={`absolute inset-x-2 bottom-2 top-2 transition-[width] duration-200 sm:inset-y-3 sm:left-auto sm:right-3 ${
                configExpanded
                  ? "sm:w-[min(720px,calc(100vw-1.5rem))]"
                  : "sm:w-[min(420px,calc(100vw-1.5rem))]"
              }`}
            >
              <ConfigPanel
                key={selectedStep.id}
                step={selectedStep}
                index={selectedIndex}
                runs={runs}
                expanded={configExpanded}
                onToggleExpand={() => setConfigExpanded((v) => !v)}
                onPatch={(patch) => patchStep(selectedStep.id, patch)}
                onClose={() => {
                  setConfigExpanded(false);
                  setSelectedId(null);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export function FlowBuilderClient({ flowId }: { flowId: string }) {
  return (
    <ReactFlowProvider>
      <Builder flowId={flowId} />
    </ReactFlowProvider>
  );
}

// ── Left rail ──────────────────────────────────────────────────────────────────

function LeftRail({ chatOpen, onToggleChat }: { chatOpen: boolean; onToggleChat: () => void }) {
  // Pared down to Home (below) + Chat only "for now" — other rail entries hidden.
  const railIcons = [ChatGlyph];
  return (
    <div className="flex w-14 shrink-0 flex-col items-center border-r border-slate-200 bg-[#f1f0ec] py-3">
      <Link href="/dashboard" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2b2440] text-white" title="Home">
        <HomeGlyph className="h-4 w-4" />
      </Link>
      <div className="mt-4 flex flex-col items-center gap-3">
        {railIcons.map((G, i) =>
          G === ChatGlyph ? (
            <button
              key={i}
              type="button"
              onClick={onToggleChat}
              title="Chat"
              aria-pressed={chatOpen}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                chatOpen ? "bg-[#6C4BF4]/10 text-[#6C4BF4]" : "text-slate-400 hover:bg-slate-200/70 hover:text-slate-600"
              }`}
            >
              <G className="h-[18px] w-[18px]" />
            </button>
          ) : (
            <span key={i} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-600">
              <G className="h-[18px] w-[18px]" />
            </span>
          ),
        )}
      </div>
    </div>
  );
}

// ── Top bar (row 1) ─────────────────────────────────────────────────────────────

function TopBar({
  name,
  setName,
  setSaved,
  status,
  saved,
  onDuplicate,
  onDelete,
  onSave,
  runnable,
  publishing,
  onPublish,
}: {
  name: string;
  setName: (v: string) => void;
  setSaved: (v: boolean) => void;
  status: AutomationFlow["status"];
  saved: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onSave: () => void;
  runnable: boolean;
  publishing: boolean;
  onPublish: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as globalThis.Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const statusLabel = status === "active" ? "Active" : status === "paused" ? "Paused" : "Draft";
  const statusClasses =
    status === "active"
      ? "bg-emerald-100 text-emerald-700"
      : status === "paused"
        ? "bg-slate-200 text-slate-600"
        : "bg-[#6C4BF4]/10 text-[#6C4BF4]";
  const isActive = status === "active";

  return (
    <div className="flex h-13 shrink-0 items-center gap-2 bg-black/5 px-3 text-slate-900">
      <div className="flex flex-1 items-center gap-2">
        <Link href="/dashboard" title="Home" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5">
          <HomeGlyph className="h-4 w-4" />
        </Link>
        <div className="mx-1 h-5 w-px shrink-0 bg-black/10" />
        <Link href="/dashboard/automations" className="flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-slate-900 hover:opacity-80">
          <FlowGlyph className="h-4 w-4 text-[#6C4BF4]" />
          Automations
        </Link>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-1.5 text-[14px] text-slate-500">
        <FolderGlyph className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="shrink-0 text-slate-400">/</span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6C4BF4] text-[11px] font-semibold text-white">
          {(name.trim()[0] ?? "Z").toUpperCase()}
        </span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          placeholder="Untitled Zap"
          className="w-[220px] max-w-[320px] truncate bg-transparent text-center text-[14px] font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:underline"
        />
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${statusClasses}`}>{statusLabel}</span>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title="More options"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-9 z-20 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-slate-900 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-1">
        {/* Fixed icon slot keeps the toolbar layout stable; the expanded field
            floats absolutely over the bar so nothing else shifts. */}
        <div className="relative mr-1 h-8 w-8 shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            title="Search (Ctrl F)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5"
          >
            <SearchGlyph className="h-4 w-4" />
          </button>
          {searchOpen && (
            <div className="absolute right-0 top-1/2 z-30 flex -translate-y-1/2 items-center gap-2 rounded-lg border border-[#6C4BF4] bg-white px-2.5 py-1 shadow-lg">
              <SearchGlyph className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }
                }}
                onBlur={() => {
                  if (!searchQuery) setSearchOpen(false);
                }}
                placeholder="Search steps…"
                className="w-[180px] bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchOpen(false);
                }}
                className="shrink-0 text-slate-400 hover:text-slate-600"
                aria-label="Close search"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <span className="mr-1 shrink-0 text-[12px] text-slate-400">{saved ? "All changes saved" : "Unsaved changes"}</span>
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-black/5"
        >
          <UndoGlyph className="h-4 w-4" />
          {saved ? "Save" : "Save changes"}
        </button>
        <div className="mx-1 h-5 w-px bg-black/10" />
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing || (!isActive && !runnable)}
          title={!isActive && !runnable ? "Add a live trigger and at least one live action to activate" : undefined}
          className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
            isActive ? "bg-emerald-600 hover:brightness-105" : "bg-[#6C4BF4] hover:brightness-105"
          }`}
        >
          {publishing ? "…" : isActive ? "Active · Pause" : "Publish"}
        </button>
      </div>
    </div>
  );
}

// ── Sub bar (row 2) ─────────────────────────────────────────────────────────────

// Only surfaces when there's a publish error — the search moved up into TopBar,
// so there's no reason to reserve a full row when nothing needs saying.
function SubBar({ publishError }: { publishError: string | null }) {
  if (!publishError) return null;
  return (
    <div className="flex h-11 shrink-0 items-center border-b border-slate-200 bg-white px-3">
      <p className="truncate text-[12px] text-red-500">{publishError}</p>
    </div>
  );
}

// ── Config panel ────────────────────────────────────────────────────────────────

function ConfigPanel({
  step,
  index,
  runs,
  expanded,
  onToggleExpand,
  onPatch,
  onClose,
}: {
  step: AutomationStep;
  index: number;
  runs: AutomationRun[];
  expanded: boolean;
  onToggleExpand: () => void;
  onPatch: (patch: Partial<AutomationStep>) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"setup" | "test">("setup");
  const [changingApp, setChangingApp] = useState(!step.app);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const appFieldRef = useRef<HTMLDivElement>(null);

  // Display name: the user's custom label if set, otherwise the event title.
  const displayName = step.label || step.title || "Select the event";

  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  function startRename() {
    setDraftName(step.label || step.title || "");
    setRenaming(true);
  }
  function commitRename() {
    const trimmed = draftName.trim();
    // Clearing the field (or matching the event title) drops the custom label
    // so the header falls back to the live event name.
    onPatch({ label: trimmed && trimmed !== step.title ? trimmed : undefined });
    setRenaming(false);
  }
  const isTrigger = step.kind === "trigger";
  const def = appDef(step.app);
  const events = def ? (isTrigger ? def.triggers : def.actions) : [];
  const eventLabel = isTrigger ? "Trigger event" : "Action event";
  // All apps are shown in the picker regardless of step kind — one that has
  // no triggers (or no actions) still appears, just disabled with a tooltip
  // explaining why, instead of silently vanishing (see AppPickerDialog).
  const pickableApps = APPS;

  // Auto-heal: a step saved before an app's sole live event was renamed (or
  // loaded with no title yet) gets corrected the moment its panel opens,
  // instead of showing a blank/stale event forever.
  useEffect(() => {
    const sole = soleLiveEvent(step.app, step.kind);
    if (sole && step.title !== sole) onPatch({ title: sole });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.app, step.kind]);

  return (
    <>
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/[0.02]">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
          <AppIcon app={step.app} className="h-[18px] w-[18px]" />
        </span>
        {renaming ? (
          <input
            ref={renameRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            placeholder={step.title || "Step name"}
            className="min-w-0 flex-1 rounded-md border border-[#6C4BF4] bg-white px-2 py-1 text-[15px] font-semibold text-slate-900 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={startRename}
            title="Click to rename"
            className="group/name flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-slate-50"
          >
            <span className="min-w-0 truncate text-[15px] font-semibold text-slate-900">
              {index + 1}. {displayName}
            </span>
            <PencilGlyph className="h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 transition group-hover/name:opacity-100" />
          </button>
        )}
        <button
          type="button"
          onClick={startRename}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          title="Rename"
        >
          <PencilGlyph className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          title={expanded ? "Collapse" : "Expand"}
          aria-pressed={expanded}
        >
          {expanded ? <CollapseGlyph className="h-4 w-4" /> : <ExpandGlyph className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-100 px-4">
        <button
          type="button"
          onClick={() => setTab("setup")}
          className={`-mb-px flex items-center gap-1.5 border-b-2 py-3 text-[13px] font-semibold transition ${
            tab === "setup" ? "border-[#6C4BF4] text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Setup
          {step.title && <CheckGlyph className="h-3.5 w-3.5 text-emerald-500" />}
        </button>
        <button
          type="button"
          onClick={() => setTab("test")}
          className={`-mb-px flex items-center gap-1.5 border-b-2 py-3 text-[13px] font-semibold transition ${
            tab === "test" ? "border-[#6C4BF4] text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Runs
          {runs.length > 0 && (
            <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500">{runs.length}</span>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {tab === "test" ? (
          runs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-[14px] font-medium text-slate-700">No runs yet</p>
              <p className="max-w-[240px] text-[13px] text-slate-400">
                Activate this automation — once its trigger fires, runs will show up here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {runs.map((run) => (
                <div key={run.id} className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[12px] font-semibold ${
                        run.status === "success"
                          ? "text-emerald-600"
                          : run.status === "failed"
                            ? "text-red-500"
                            : "text-slate-400"
                      }`}
                    >
                      {run.status === "running" ? "Running…" : run.status === "success" ? "Success" : "Failed"}
                    </span>
                    <span className="text-[11px] text-slate-400">{new Date(run.startedAt).toLocaleString()}</span>
                  </div>
                  {run.stepResults.some((r) => r.status === "failed") && (
                    <p className="mt-1 text-[12px] text-red-500">
                      {run.stepResults.find((r) => r.status === "failed")?.error ?? "A step failed"}
                    </p>
                  )}
                  {run.stepResults.some((result) => result.evidence) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {run.stepResults
                        .filter((result) => result.evidence)
                        .map((result) => {
                          const receipt = result.evidence!;
                          const label = receipt.resourceId
                            ? `${receipt.provider} · ${receipt.resourceId}`
                            : `${receipt.provider} acknowledged`;
                          return receipt.resourceUrl ? (
                            <a
                              key={result.stepId}
                              href={receipt.resourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                            >
                              {label}
                            </a>
                          ) : (
                            <span
                              key={result.stepId}
                              className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700"
                            >
                              {label}
                            </span>
                          );
                        })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-5">
            {/* App */}
            <Field label="App" required>
              <div ref={appFieldRef} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50">
                    <AppIcon app={step.app} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-[14px] font-medium text-slate-900">{appName(step.app)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setChangingApp(true)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Change
                </button>
              </div>
            </Field>

            {/* Event — skipped entirely when the app has only one possible event */}
            {!soleLiveEvent(step.app, step.kind) && (
              <Field label={eventLabel} required>
                <EventPicker
                  events={events}
                  selected={step.title}
                  appName={appName(step.app)}
                  appId={step.app}
                  kind={step.kind}
                  onSelect={(name) => onPatch({ title: name, config: {} })}
                />
              </Field>
            )}

            {/* Account — the connect UX differs by provider */}
            <AccountField
              app={step.app}
              value={typeof step.config?.account === "string" ? step.config.account : undefined}
              onChange={(account) => onPatch({ config: { ...(step.config ?? {}), account } })}
            />

            {/* Per-app config — only rendered once a live event is chosen */}
            {isEventLive(step.app, step.kind, step.title) && (
              <AutomationConfigFields
                app={step.app}
                kind={step.kind}
                config={step.config ?? {}}
                onChange={(config) => onPatch({ config })}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {tab === "setup" && !changingApp && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-3">
          <button
            type="button"
            onClick={onClose}
            disabled={!step.title}
            className="h-11 w-full rounded-xl text-[14px] font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 enabled:bg-[#6C4BF4] enabled:text-white enabled:shadow-sm enabled:shadow-[#6C4BF4]/30 enabled:hover:brightness-105"
          >
            {step.title ? "Continue" : "To continue, choose an event"}
          </button>
        </div>
      )}
    </aside>
    {changingApp && (
      <AppPickerDialog
        apps={pickableApps}
        currentApp={step.app}
        kind={step.kind}
        subtitle={isTrigger ? "This app's event will start the automation." : "This app will run when the automation fires."}
        onSelect={(a) => {
          if (a.id !== step.app) {
            // Skip the event-picker entirely when there's only one possible
            // event for this app/kind (e.g. Riz Agent, Twilio) — nothing to choose.
            onPatch({ app: a.id, title: soleLiveEvent(a.id, step.kind) ?? "", subtitle: a.name, config: {} });
          }
          setChangingApp(false);
        }}
        onClose={() => (step.app ? setChangingApp(false) : onClose())}
      />
    )}
    </>
  );
}

// ── Chat panel ───────────────────────────────────────────────────────────────
// The flow-builder copilot. Talks to /api/automations/chat — a dedicated
// builder agent, not the general assistant: it receives the steps currently on
// the canvas and returns edit operations, which the panel applies one at a
// time so the flow visibly assembles/changes while the agent explains itself.
// Ephemeral — not saved to the main chat history.

type FlowOpLine = { icon: "add" | "remove" | "update" | "name"; label: string };

type FlowChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** The agent's short first-person reasoning, shown above the reply. */
  thinking?: string;
  /** Canvas edits from this turn, ticked in as each one lands. */
  opLines?: FlowOpLine[];
  /** True while this turn's edits are still being applied to the canvas. */
  building?: boolean;
};

const WORKING_PHRASES = ["Thinking…", "Reading your flow…", "Planning the steps…"];

function ChatPanel({
  flowId,
  flowName,
  steps,
  onApplyOps,
  onClose,
}: {
  flowId: string;
  flowName: string;
  steps: AutomationStep[];
  onApplyOps: (
    ops: BuilderChatOp[],
    name: string | undefined,
    onProgress: (icon: FlowOpLine["icon"], label: string) => void,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<FlowChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  /** Request in flight, nothing to show yet — drives the cycling status bubble. */
  const [waiting, setWaiting] = useState(false);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!waiting) return;
    setPhraseIdx(0);
    const t = setInterval(() => setPhraseIdx((i) => (i + 1) % WORKING_PHRASES.length), 1500);
    return () => clearInterval(t);
  }, [waiting]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput("");
    setError(null);
    setSending(true);
    setWaiting(true);
    const history = messages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    try {
      const res = await builderChat({ flowId, name: flowName, steps, message: trimmed, history });
      setWaiting(false);
      if (res.error || !res.reply) throw new Error(res.error || "The assistant didn't respond.");
      const ops = res.operations ?? [];

      // Reveal the agent's thinking first; the reply lands once the canvas work is done.
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          thinking: res.thinking || undefined,
          opLines: [],
          building: ops.length > 0,
        },
      ]);

      if (ops.length > 0 || res.name) {
        await onApplyOps(ops, res.name, (icon, label) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role !== "assistant") return prev;
            next[next.length - 1] = { ...last, opLines: [...(last.opLines ?? []), { icon, label }] };
            return next;
          });
        });
      }

      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role !== "assistant") return prev;
        next[next.length - 1] = { ...last, content: res.reply ?? "", building: false };
        return next;
      });
    } catch (err) {
      setWaiting(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/[0.02]">
      <div className="flex items-center gap-2 px-4 py-3">
        <ChatGlyph className="h-4 w-4 text-[#6C4BF4]" />
        <p className="flex-1 text-[15px] font-semibold text-slate-900">Chat</p>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto border-t border-slate-100 px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2 text-[13px] text-slate-400">
            <p className="font-medium text-slate-600">Tell me what to automate.</p>
            <p>
              Try &ldquo;when an email from my boss arrives, wait 10 minutes, summarize it and send it to me
              on Telegram&rdquo; — I&apos;ll build it on the canvas while you watch. Click any step afterward
              to link its account and fine-tune it.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-auto max-w-[92%] rounded-xl bg-[#6C4BF4] px-3 py-2 text-[13px] text-white">
                  {m.content}
                </div>
              ) : (
                <div key={i} className="max-w-[95%]">
                  {m.thinking && (
                    <div className="mb-1.5 border-l-2 border-slate-200 pl-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Thinking</p>
                      <p className="mt-0.5 text-[12px] italic leading-relaxed text-slate-500">{m.thinking}</p>
                    </div>
                  )}
                  {(m.opLines?.length ?? 0) > 0 && (
                    <div className="mb-1.5 flex flex-col gap-1 rounded-lg bg-slate-50 px-2.5 py-2">
                      {(m.opLines ?? []).map((line, j) => (
                        <p key={j} className="flex items-center gap-1.5 text-[12px] text-slate-600">
                          <OpGlyph icon={line.icon} />
                          <span className="min-w-0 truncate">{line.label}</span>
                        </p>
                      ))}
                      {m.building && <p className="pl-[22px] text-[11px] text-slate-400">Updating the canvas…</p>}
                    </div>
                  )}
                  {m.content ? (
                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-[13px] text-slate-800">
                      <MarkdownMessage content={m.content} />
                    </div>
                  ) : null}
                </div>
              ),
            )}
            {waiting && (
              <div className="max-w-[92%] rounded-xl bg-slate-100 px-3 py-2 text-[13px] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6C4BF4]" />
                  {WORKING_PHRASES[phraseIdx]}
                </span>
              </div>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}
      </div>

      <div className="p-3">
        <form
          className="rounded-[22px] border border-black/20 bg-white py-3 shadow-[0px_12px_32px_0px_rgba(0,0,0,0.03)] transition focus-within:border-black/30"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            disabled={sending}
            placeholder="Describe what to automate…"
            className="min-h-[46px] max-h-[160px] w-full resize-none bg-transparent px-4 text-[14px] leading-6 text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between gap-2 px-3">
            <Link
              href="/dashboard/connectors"
              title="Connectors"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100"
            >
              <PlugIcon className="h-4 w-4" />
            </Link>
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-white transition hover:opacity-90 disabled:bg-slate-200 disabled:text-slate-400"
              aria-label="Send"
            >
              <ArrowUpIcon className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}

function OpGlyph({ icon }: { icon: FlowOpLine["icon"] }) {
  const cls = "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold";
  if (icon === "add") return <span className={`${cls} bg-emerald-100 text-emerald-600`}>+</span>;
  if (icon === "remove") return <span className={`${cls} bg-red-100 text-red-500`}>−</span>;
  if (icon === "update") return <span className={`${cls} bg-amber-100 text-amber-600`}>✎</span>;
  return <span className={`${cls} bg-slate-200 text-slate-600`}>✦</span>;
}

function AppPickerDialog({
  apps,
  currentApp,
  kind,
  subtitle,
  onSelect,
  onClose,
}: {
  apps: AppDef[];
  currentApp: string;
  kind: AutomationStep["kind"];
  subtitle: string;
  onSelect: (app: AppDef) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isTrigger = kind === "trigger";

  // Left sidebar — every category present in the catalog, "All" pinned first,
  // each with a count against the full (unfiltered) list so it doesn't jitter
  // while searching.
  const categoryList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of apps) {
      const cat = a.category ?? "Other";
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return [
      { name: "All", count: apps.length },
      ...Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, count })),
    ];
  }, [apps]);

  const q = query.trim().toLowerCase();
  const filtered = apps.filter(
    (a) =>
      (activeCategory === "All" || (a.category ?? "Other") === activeCategory) &&
      (!q || a.name.toLowerCase().includes(q) || (a.category ?? "").toLowerCase().includes(q)),
  );
  const groups = useMemo(() => {
    const map = new Map<string, AppDef[]>();
    for (const a of filtered) {
      const cat = a.category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(a);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeCategory, apps]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{ maxHeight: "min(640px, 85vh)" }}
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
      <>
          {/* Search */}
          <div className="shrink-0 border-b border-slate-100 p-2">
            <p className="mb-2 px-1 text-[12px] text-slate-400">{subtitle}</p>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5">
              <SearchGlyph className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                placeholder={`Search ${apps.length}+ apps`}
                className="h-9 w-full bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 outline-none"
              />
            </div>
          </div>

          {/* Category panel (left) + apps panel (right) */}
          <div className="flex min-h-0 flex-1">
            <div className="w-48 shrink-0 overflow-y-auto border-r border-slate-100 bg-slate-50/50 p-1.5">
              {categoryList.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setActiveCategory(c.name)}
                  className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
                    activeCategory === c.name
                      ? "bg-[#6C4BF4]/10 font-medium text-[#6C4BF4]"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="min-w-0 truncate">{c.name}</span>
                  <span className="shrink-0 pl-1.5 text-[11px] text-slate-400">{c.count}</span>
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-2">
              {groups.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-slate-400">No apps match &ldquo;{query}&rdquo;</p>
              ) : (
                groups.map(([category, list]) => (
                  <div key={category} className="mb-3 last:mb-0">
                    {activeCategory === "All" && (
                      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{category}</p>
                    )}
                    <div className="grid grid-cols-2 gap-1">
                      {list.map((a) => {
                        // Does this app even have a trigger/action for the step kind
                        // we're picking? (e.g. AI/Delay/Filter have no triggers — they
                        // can't start a flow.) Checked before live-ness, since "not
                        // applicable to this step" is a different reason than "not
                        // wired up yet".
                        const applicable = isTrigger ? a.triggers.length > 0 : a.actions.length > 0;
                        const live = applicable && isAppLive(a.id, kind);
                        const disabledReason = !applicable
                          ? `${a.name} has no ${isTrigger ? "triggers" : "actions"} — it can only be used as ${isTrigger ? "an action" : "a trigger"} step.`
                          : !live
                            ? `${a.name}'s ${isTrigger ? "trigger" : "action"} isn't wired up yet — coming soon.`
                            : undefined;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            disabled={!live}
                            title={disabledReason}
                            onClick={() => live && onSelect(a)}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                              !live
                                ? "cursor-not-allowed border-transparent opacity-40"
                                : a.id === currentApp
                                  ? "border-[#6C4BF4] bg-[#6C4BF4]/5"
                                  : "border-transparent hover:bg-slate-50"
                            }`}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-slate-200">
                              <AppIcon app={a.id} className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[14px] text-slate-900">{a.name}</span>
                            {!live && (
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                                {applicable ? "Soon" : "N/A"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
        {label} {required && <span className="text-[#6C4BF4]">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Account field (connect UX varies by provider) ─────────────────────────────

type AccountOption = { id: string; label: string; picture?: string };

// One of 6 stable hues, chosen from the label so the same account keeps its color.
const AVATAR_HUES = ["#6C4BF4", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];
function AccountAvatar({ label, picture }: { label: string; picture?: string }) {
  const [broken, setBroken] = useState(false);
  if (picture && !broken) {
    // Loaded via our server-side proxy — Google photo hosts often reject
    // hotlinked <img> requests on referrer policy; the proxy sidesteps that.
    const proxied = `/api/image-proxy?url=${encodeURIComponent(picture)}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={proxied}
        alt=""
        onError={() => setBroken(true)}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = (label.trim()[0] || "?").toUpperCase();
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  const hue = AVATAR_HUES[hash % AVATAR_HUES.length];
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
      style={{ backgroundColor: hue }}
    >
      {initial}
    </span>
  );
}

// Real connection status — checked against the same data the /dashboard/connectors
// page uses (GET /api/connectors for OAuth apps, GET /api/telegram for the bot link).
// Nothing here is simulated: connecting means actually completing the same OAuth
// flow (or Telegram deep-link) as the connectors page, not flipping local state.
function AccountField({
  app,
  value,
  onChange,
}: {
  app: string;
  value?: string;
  onChange?: (accountId: string | undefined) => void;
}) {
  const method = connectMethod(app);
  const name = appName(app);
  const provider = oauthProviderFor(app);
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected">("loading");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // OAuth accounts for this provider — null while loading, [] when none linked.
  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);
  const returnTo = typeof window !== "undefined" ? window.location.pathname : "/dashboard/automations";
  // Connections made from the automation builder request only the scopes a step
  // needs (e.g. Gmail read-only) — see automationOauthScopesByProvider in ai-core.
  const addHref = `/api/connectors/${provider}/start?returnTo=${encodeURIComponent(returnTo)}&scopeProfile=automation`;

  // Legacy combined "google" rows still count as gmail/calendar until reconnect.
  const matchesProvider = useCallback(
    (p?: string) => p === provider || ((provider === "gmail" || provider === "calendar") && p === "google"),
    [provider],
  );

  const refresh = useCallback(() => {
    if (method === "none") return;
    if (method === "bot") {
      setStatus("loading");
      fetch("/api/telegram")
        .then((r) => r.json())
        .then((data: { linked?: boolean }) => setStatus(data.linked ? "connected" : "disconnected"))
        .catch(() => setStatus("disconnected"));
      return;
    }
    setAccounts(null);
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((rows: Array<{ id?: string; provider?: string; label?: string; metadata?: Record<string, unknown> }>) => {
        const list: AccountOption[] = Array.isArray(rows)
          ? rows
              .filter((a) => matchesProvider(a.provider))
              .map((a) => {
                const email = typeof a.metadata?.accountEmail === "string" ? a.metadata.accountEmail : undefined;
                const picture = typeof a.metadata?.picture === "string" ? a.metadata.picture : undefined;
                return {
                  id: a.id ?? "",
                  // Prefer the bare email; fall back to the connector label.
                  label: email || a.label || `${name} account`,
                  picture,
                };
              })
              .filter((a) => a.id)
          : [];
        setAccounts(list);
      })
      .catch(() => setAccounts([]));
  }, [method, matchesProvider, name]);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as globalThis.Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-select the (only) account so the step is usable without an extra click.
  useEffect(() => {
    if (method !== "oauth" && method !== "secret") return;
    if (!accounts || accounts.length === 0) return;
    if (!value || !accounts.some((a) => a.id === value)) {
      onChange?.(accounts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, method]);

  if (method === "none") {
    return (
      <Field label="Account">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-500">
          No account needed — this runs on Rizly&apos;s built-in schedule.
        </div>
      </Field>
    );
  }

  // ── OAuth: account dropdown (Google/Gmail/Calendar/etc.) ────────────────────
  if (method === "oauth") {
    if (accounts === null) {
      return (
        <Field label="Account" required>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-400">
            Checking connection…
          </div>
        </Field>
      );
    }
    if (accounts.length === 0) {
      return (
        <Field label="Account" required>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <span className="text-[14px] text-slate-400">No account connected</span>
            <a
              href={addHref}
              className="rounded-lg bg-[#6C4BF4] px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm shadow-[#6C4BF4]/25 transition hover:brightness-105"
            >
              Sign in with {name}
            </a>
          </div>
          <p className="mt-2.5 text-[12px] leading-relaxed text-slate-400">
            Connects securely — your credentials are encrypted and removable anytime.
          </p>
        </Field>
      );
    }
    const selectedId = value && accounts.some((a) => a.id === value) ? value : accounts[0].id;
    const selectedAcc = accounts.find((a) => a.id === selectedId) ?? accounts[0];
    return (
      <Field label="Account" required>
        <div ref={dropdownRef} className="relative">
          {/* Selected account (dropdown trigger) */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`flex h-12 w-full items-center gap-2.5 rounded-xl border bg-white px-3 text-left transition ${
              open ? "border-[#6C4BF4]" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <AccountAvatar label={selectedAcc.label} picture={selectedAcc.picture} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-slate-900">{selectedAcc.label}</span>
            <SelectChevrons className="h-4 w-4 shrink-0 text-slate-400" />
          </button>

          {/* Menu */}
          {open && (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25)]">
              {accounts.map((a) => {
                const isSel = a.id === selectedId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      onChange?.(a.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                      isSel ? "bg-[#6C4BF4]/8" : "hover:bg-slate-50"
                    }`}
                  >
                    <AccountAvatar label={a.label} picture={a.picture} />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-slate-900">{a.label}</span>
                    {isSel && <CheckGlyph className="h-4 w-4 shrink-0 text-[#6C4BF4]" />}
                  </button>
                );
              })}
              <div className="my-1 h-px bg-slate-100" />
              <a
                href={addHref}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400">
                  <PlusGlyph />
                </span>
                <span className="text-[14px] font-medium text-[#6C4BF4]">Add account</span>
              </a>
            </div>
          )}
        </div>
      </Field>
    );
  }

  if (status === "connected") {
    return (
      <Field label="Account" required>
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <span className="flex items-center gap-2 text-[14px] text-emerald-800">
            <CheckGlyph className="h-4 w-4 text-emerald-600" />
            {`${name} · @rizly_bot`}
          </span>
          <Link
            href="/dashboard/connectors"
            className="text-[13px] font-medium text-slate-500 underline hover:text-slate-700"
          >
            Manage
          </Link>
        </div>
        <p className="mt-2 text-[12px] text-emerald-700">Connected. Ready to use in this step.</p>
      </Field>
    );
  }

  if (method === "bot") {
    if (status === "loading") {
      return (
        <Field label="Account" required>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-400">
            Checking connection…
          </div>
        </Field>
      );
    }
    return (
      <Field label="Account" required>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <span className="text-[14px] text-slate-400">Connect {name}</span>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="rounded-md bg-[#6C4BF4] px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:brightness-105"
          >
            Connect {name}
          </button>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
          {name} connects through the Rizly bot, not a password. Scan the QR (desktop) or tap <b>Open {name}</b>{" "}
          (mobile), then send <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">/start</code> to the bot.
        </p>
        {dialogOpen && (
          <TelegramConnectDialog
            appName={name}
            onClose={() => setDialogOpen(false)}
            onConnected={() => {
              setDialogOpen(false);
              refresh();
            }}
          />
        )}
      </Field>
    );
  }

  if (method === "secret") {
    const secretKind = app === "postgres" ? "a connection string" : app === "discord" ? "a webhook URL" : "an API key";
    return (
      <Field label="Account" required>
        <Link
          href="/dashboard/connectors"
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:border-slate-300"
        >
          <span className="text-[14px] text-slate-400">Connect {name}</span>
          <span className="rounded-md bg-[#6C4BF4] px-3.5 py-1.5 text-[13px] font-medium text-white">Connect</span>
        </Link>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
          {name} connects with {secretKind} from the{" "}
          <span className="text-[#6C4BF4] underline">connectors page</span>.
        </p>
      </Field>
    );
  }

  return null;
}

// ── Per-app config fields — only the live app/event combos reach here ──────────

function AutomationConfigFields({
  app,
  kind,
  config,
  onChange,
}: {
  app: string;
  kind: AutomationStep["kind"];
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  function set(patch: Record<string, unknown>) {
    onChange({ ...config, ...patch });
  }

  if (app === "schedule") {
    return (
      <Field label="Run every" required>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={typeof config.everyMinutes === "number" ? config.everyMinutes : 60}
            onChange={(e) => set({ everyMinutes: Math.max(1, Number(e.target.value) || 1) })}
            className="h-11 w-24 rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
          />
          <span className="text-[14px] text-slate-500">minutes</span>
        </div>
      </Field>
    );
  }

  if (app === "gmail") {
    const subject = typeof config.subject === "string" ? config.subject : "";
    const from = typeof config.from === "string" ? config.from : "";
    const hasAttachment = config.hasAttachment === true;
    const unread = config.unread === true;
    const query = typeof config.query === "string" ? config.query : "";
    const hasStructured = Boolean(subject || from || hasAttachment || unread);
    // Pre-existing flows with a raw query (and no structured fields) open in
    // advanced mode; new ones default to the simple builder.
    const advanced = config.advanced === true || (config.advanced !== false && !!query && !hasStructured);

    // Compile the simple filters into one Gmail search string (what the backend
    // actually runs). Kept in config.query so nothing downstream has to change.
    const buildQuery = (next: { subject: string; from: string; hasAttachment: boolean; unread: boolean }) => {
      const parts: string[] = [];
      if (next.subject.trim()) parts.push(`subject:(${next.subject.trim()})`);
      if (next.from.trim()) parts.push(`from:${next.from.trim()}`);
      if (next.hasAttachment) parts.push("has:attachment");
      if (next.unread) parts.push("is:unread");
      return parts.join(" ");
    };
    const updateSimple = (patch: Partial<{ subject: string; from: string; hasAttachment: boolean; unread: boolean }>) => {
      const nextVals = { subject, from, hasAttachment, unread, ...patch };
      set({ ...nextVals, query: buildQuery(nextVals) });
    };

    if (advanced) {
      return (
        <>
          <Field label="Gmail search" required>
            <input
              value={query}
              onChange={(e) => set({ query: e.target.value, advanced: true })}
              placeholder="from:stripe.com subject:invoice has:attachment"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
            />
            <p className="mt-2 text-[12px] text-slate-400">Full Gmail search syntax — the same you&apos;d type in the Gmail search bar.</p>
          </Field>
          <button
            type="button"
            onClick={() => set({ advanced: false })}
            className="self-start text-[13px] font-medium text-[#6C4BF4] hover:underline"
          >
            ← Use simple filters
          </button>
        </>
      );
    }

    return (
      <>
        <Field label="Subject contains">
          <input
            value={subject}
            onChange={(e) => updateSimple({ subject: e.target.value })}
            placeholder="invoice"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="From">
          <input
            value={from}
            onChange={(e) => updateSimple({ from: e.target.value })}
            placeholder="stripe.com or billing@acme.com"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <div className="flex flex-col gap-2.5">
          <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-slate-700">
            <input
              type="checkbox"
              checked={hasAttachment}
              onChange={(e) => updateSimple({ hasAttachment: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-[#6C4BF4] accent-[#6C4BF4]"
            />
            Has an attachment
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-slate-700">
            <input
              type="checkbox"
              checked={unread}
              onChange={(e) => updateSimple({ unread: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-[#6C4BF4] accent-[#6C4BF4]"
            />
            Only unread emails
          </label>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
          Matches: <span className="font-medium text-slate-700">{query || "every new email"}</span>
        </div>
        <button
          type="button"
          onClick={() => set({ advanced: true })}
          className="self-start text-[13px] font-medium text-[#6C4BF4] hover:underline"
        >
          Advanced: raw Gmail search →
        </button>
      </>
    );
  }

  if (app === "calendar") {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-500">
        Checks your primary calendar for new events on the next 24 hours, every poll.
      </div>
    );
  }

  if (app === "slack" || app === "telegram") {
    return (
      <Field label="Message" required>
        <textarea
          value={typeof config.message === "string" ? config.message : ""}
          onChange={(e) => set({ message: e.target.value })}
          rows={4}
          placeholder="e.g. New email from {{from}}: {{subject}}"
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
        />
        <p className="mt-2 text-[12px] text-slate-400">
          Sent to your linked {appName(app)} {app === "slack" ? "DM" : "chat"}. Use <code className="rounded bg-slate-100 px-1 py-0.5">{"{{field}}"}</code> to
          insert data from the trigger (e.g. <code className="rounded bg-slate-100 px-1 py-0.5">{"{{subject}}"}</code>).
        </p>
      </Field>
    );
  }

  if (app === "calcom") {
    return <CalComBookingFields config={config} onChange={onChange} />;
  }

  if (app === "google-drive") {
    return (
      <>
        <Field label="File name" required>
          <input
            value={typeof config.name === "string" ? config.name : ""}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. {{subject}}.txt"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Content" required>
          <textarea
            value={typeof config.content === "string" ? config.content : ""}
            onChange={(e) => set({ content: e.target.value })}
            rows={4}
            placeholder="Use {{field}} to insert data from the trigger."
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <p className="text-[12px] text-slate-400">Uploaded as a plain text file, visible only to files Rizly itself creates in your Drive.</p>
      </>
    );
  }

  if (app === "google-sheets") {
    const isTrigger = kind === "trigger";
    return (
      <>
        <Field label="Spreadsheet ID" required>
          <input
            value={typeof config.spreadsheetId === "string" ? config.spreadsheetId : ""}
            onChange={(e) => set({ spreadsheetId: e.target.value })}
            placeholder="From the sheet's URL: /spreadsheets/d/<id>/edit"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Sheet / range" required>
          <input
            value={typeof config.range === "string" ? config.range : "Sheet1"}
            onChange={(e) => set({ range: e.target.value })}
            placeholder="Sheet1"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        {isTrigger ? (
          <label className="flex items-center gap-2 text-[13px] text-slate-600">
            <input
              type="checkbox"
              checked={config.hasHeaderRow !== false}
              onChange={(e) => set({ hasHeaderRow: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            First row is a header (skip it)
          </label>
        ) : (
          <Field label="Values" required>
            <input
              value={typeof config.values === "string" ? config.values : ""}
              onChange={(e) => set({ values: e.target.value })}
              placeholder="e.g. {{from}}, {{subject}}, {{snippet}}"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
            />
            <p className="mt-2 text-[12px] text-slate-400">Comma-separated — one value per column, left to right.</p>
          </Field>
        )}
      </>
    );
  }

  if (app === "google-forms") {
    return (
      <>
        <Field label="Response spreadsheet ID" required>
          <input
            value={typeof config.spreadsheetId === "string" ? config.spreadsheetId : ""}
            onChange={(e) => set({ spreadsheetId: e.target.value })}
            placeholder="From Forms → Responses → the linked sheet's URL"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Sheet / range" required>
          <input
            value={typeof config.range === "string" ? config.range : "Form Responses 1"}
            onChange={(e) => set({ range: e.target.value })}
            placeholder="Form Responses 1"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <p className="text-[12px] text-slate-400">
          Google Forms has no direct submission trigger — this watches the response spreadsheet the form is already linked to.
        </p>
      </>
    );
  }

  if (app === "google-docs") {
    return (
      <>
        <Field label="Title" required>
          <input
            value={typeof config.title === "string" ? config.title : ""}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. {{subject}}"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Content">
          <textarea
            value={typeof config.content === "string" ? config.content : ""}
            onChange={(e) => set({ content: e.target.value })}
            rows={4}
            placeholder="Use {{field}} to insert data from the trigger."
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
      </>
    );
  }

  if (app === "postgres") {
    return (
      <>
        <Field label="SQL query" required>
          <textarea
            value={typeof config.query === "string" ? config.query : ""}
            onChange={(e) => set({ query: e.target.value })}
            rows={4}
            placeholder="e.g. select * from leads where email = $1"
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[13px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
          <p className="mt-2 text-[12px] text-slate-400">
            Read-only — a single SELECT. Use <code className="rounded bg-slate-100 px-1 py-0.5">$1</code>,{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">$2</code>… for parameters, never paste trigger data directly into the query text.
          </p>
        </Field>
        <Field label="Parameters">
          <input
            value={typeof config.paramsCsv === "string" ? config.paramsCsv : ""}
            onChange={(e) => set({ paramsCsv: e.target.value })}
            placeholder="e.g. {{from}}, {{subject}} — fills $1, $2 in order"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Save result as">
          <input
            value={typeof config.outputField === "string" ? config.outputField : ""}
            onChange={(e) => set({ outputField: e.target.value })}
            placeholder="query_result (default)"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
          <p className="mt-2 text-[12px] text-slate-400">
            Also sets <code className="rounded bg-slate-100 px-1 py-0.5">{"{{" + (typeof config.outputField === "string" && config.outputField ? config.outputField : "query_result") + "_count}}"}</code>{" "}
            — handy for a Filter step right after this one.
          </p>
        </Field>
      </>
    );
  }

  if (app === "mongodb") {
    return (
      <>
        <Field label="Collection" required>
          <input
            value={typeof config.collection === "string" ? config.collection : ""}
            onChange={(e) => set({ collection: e.target.value })}
            placeholder="e.g. leads"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Filter (JSON)">
          <textarea
            value={typeof config.filter === "string" ? config.filter : ""}
            onChange={(e) => set({ filter: e.target.value })}
            rows={3}
            placeholder={'{ "email": "{{from}}" }'}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[13px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
          <p className="mt-2 text-[12px] text-slate-400">
            Only the values inside the JSON are filled from <code className="rounded bg-slate-100 px-1 py-0.5">{"{{field}}"}</code> — leave blank to match everything.
          </p>
        </Field>
        <Field label="Save result as">
          <input
            value={typeof config.outputField === "string" ? config.outputField : ""}
            onChange={(e) => set({ outputField: e.target.value })}
            placeholder="query_result (default)"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
      </>
    );
  }

  if (app === "jira") {
    return (
      <>
        <Field label="Project key" required>
          <input
            value={typeof config.projectKey === "string" ? config.projectKey : ""}
            onChange={(e) => set({ projectKey: e.target.value })}
            placeholder="e.g. OPS"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Summary" required>
          <input
            value={typeof config.summary === "string" ? config.summary : ""}
            onChange={(e) => set({ summary: e.target.value })}
            placeholder="e.g. Follow up with {{from}}"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={typeof config.description === "string" ? config.description : ""}
            onChange={(e) => set({ description: e.target.value })}
            rows={3}
            placeholder="Use {{field}} to insert data from the trigger."
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Issue type">
          <input
            value={typeof config.issueType === "string" ? config.issueType : ""}
            onChange={(e) => set({ issueType: e.target.value })}
            placeholder="Task (default)"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
      </>
    );
  }

  if (app === "pagerduty") {
    return (
      <>
        <Field label="Service ID" required>
          <input
            value={typeof config.serviceId === "string" ? config.serviceId : ""}
            onChange={(e) => set({ serviceId: e.target.value })}
            placeholder="From the service's PagerDuty URL"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Title" required>
          <input
            value={typeof config.title === "string" ? config.title : ""}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. {{subject}}"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Urgency" required>
          <select
            value={config.urgency === "low" ? "low" : "high"}
            onChange={(e) => set({ urgency: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
          >
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </Field>
        <Field label="Details">
          <textarea
            value={typeof config.details === "string" ? config.details : ""}
            onChange={(e) => set({ details: e.target.value })}
            rows={3}
            placeholder="Use {{field}} to insert data from the trigger."
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
      </>
    );
  }

  if (app === "trello") {
    return (
      <>
        <Field label="List ID" required>
          <input
            value={typeof config.listId === "string" ? config.listId : ""}
            onChange={(e) => set({ listId: e.target.value })}
            placeholder="From the list's Trello share link"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Card name" required>
          <input
            value={typeof config.name === "string" ? config.name : ""}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. {{subject}}"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={typeof config.description === "string" ? config.description : ""}
            onChange={(e) => set({ description: e.target.value })}
            rows={3}
            placeholder="Use {{field}} to insert data from the trigger."
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
      </>
    );
  }

  if (app === "airtable") {
    const isTrigger = kind === "trigger";
    return (
      <>
        <Field label="Base ID" required>
          <input
            value={typeof config.baseId === "string" ? config.baseId : ""}
            onChange={(e) => set({ baseId: e.target.value })}
            placeholder="From the base's API docs URL (starts with app...)"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Table" required>
          <input
            value={typeof config.table === "string" ? config.table : ""}
            onChange={(e) => set({ table: e.target.value })}
            placeholder="e.g. Leads"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        {!isTrigger && (
          <Field label="Fields (JSON)" required>
            <textarea
              value={typeof config.fields === "string" ? config.fields : ""}
              onChange={(e) => set({ fields: e.target.value })}
              rows={4}
              placeholder={'{ "Name": "{{from}}", "Status": "New" }'}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[13px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
            />
            <p className="mt-2 text-[12px] text-slate-400">
              Only the values inside the JSON are filled from <code className="rounded bg-slate-100 px-1 py-0.5">{"{{field}}"}</code>.
            </p>
          </Field>
        )}
      </>
    );
  }

  if (app === "twilio") {
    return (
      <>
        <Field label="To" required>
          <input
            value={typeof config.to === "string" ? config.to : ""}
            onChange={(e) => set({ to: e.target.value })}
            placeholder="+1 555 123 4567"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Message" required>
          <textarea
            value={typeof config.body === "string" ? config.body : ""}
            onChange={(e) => set({ body: e.target.value })}
            rows={3}
            placeholder="e.g. New email from {{from}}: {{subject}}"
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
      </>
    );
  }

  if (app === "google-meet") {
    return (
      <>
        <Field label="Title" required>
          <input
            value={typeof config.summary === "string" ? config.summary : ""}
            onChange={(e) => set({ summary: e.target.value })}
            placeholder="e.g. Intro call with {{from}}"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Start time" required>
          <input
            type="datetime-local"
            value={typeof config.start === "string" ? config.start : ""}
            onChange={(e) => set({ start: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Duration" required>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              value={typeof config.durationMinutes === "number" ? config.durationMinutes : 30}
              onChange={(e) => set({ durationMinutes: Math.max(5, Number(e.target.value) || 30) })}
              className="h-11 w-24 rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
            />
            <span className="text-[14px] text-slate-500">minutes</span>
          </div>
        </Field>
        <Field label="Attendees">
          <input
            value={typeof config.attendees === "string" ? config.attendees : ""}
            onChange={(e) => set({ attendees: e.target.value })}
            placeholder="Comma-separated emails, e.g. {{from}}"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
      </>
    );
  }

  if (app === "discord") {
    return (
      <Field label="Message" required>
        <textarea
          value={typeof config.message === "string" ? config.message : ""}
          onChange={(e) => set({ message: e.target.value })}
          rows={4}
          placeholder="e.g. New email from {{from}}: {{subject}}"
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
        />
        <p className="mt-2 text-[12px] text-slate-400">
          Posted to the channel your webhook is set up for. Use{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">{"{{field}}"}</code> to insert data from the trigger.
        </p>
      </Field>
    );
  }

  if (app === "github") {
    return (
      <>
        <Field label="Repository" required>
          <input
            value={typeof config.repo === "string" ? config.repo : ""}
            onChange={(e) => set({ repo: e.target.value })}
            placeholder="owner/repo"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Title" required>
          <input
            value={typeof config.title === "string" ? config.title : ""}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. Follow up with {{from}}"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Body">
          <textarea
            value={typeof config.body === "string" ? config.body : ""}
            onChange={(e) => set({ body: e.target.value })}
            rows={4}
            placeholder="Use {{field}} to insert data from the trigger."
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
      </>
    );
  }

  if (app === "notion") {
    return (
      <>
        <Field label="Parent type" required>
          <select
            value={typeof config.parentType === "string" ? config.parentType : "database_id"}
            onChange={(e) => set({ parentType: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
          >
            <option value="database_id">Database</option>
            <option value="page_id">Page</option>
          </select>
        </Field>
        <Field label={typeof config.parentType === "string" && config.parentType === "page_id" ? "Parent page ID" : "Database ID"} required>
          <input
            value={typeof config.parentId === "string" ? config.parentId : ""}
            onChange={(e) => set({ parentId: e.target.value })}
            placeholder="From the Notion page/database URL"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Title" required>
          <input
            value={typeof config.title === "string" ? config.title : ""}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. {{subject}}"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Content">
          <textarea
            value={typeof config.content === "string" ? config.content : ""}
            onChange={(e) => set({ content: e.target.value })}
            rows={4}
            placeholder="Use {{field}} to insert data from the trigger."
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
      </>
    );
  }

  if (app === "stripe") {
    return (
      <>
        <Field label="Email" required>
          <input
            value={typeof config.email === "string" ? config.email : ""}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="e.g. {{from}}"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Name">
          <input
            value={typeof config.name === "string" ? config.name : ""}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. {{fromName}}"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
      </>
    );
  }

  if (app === "delay") {
    return (
      <Field label="Wait for" required>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={typeof config.delayMinutes === "number" ? config.delayMinutes : 5}
            onChange={(e) => set({ delayMinutes: Math.max(1, Number(e.target.value) || 1) })}
            className="h-11 w-24 rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
          />
          <span className="text-[14px] text-slate-500">minutes, then continue</span>
        </div>
      </Field>
    );
  }

  if (app === "filter") {
    return (
      <Field label="Only continue if" required>
        <div className="flex flex-col gap-2">
          <input
            value={typeof config.field === "string" ? config.field : ""}
            onChange={(e) => set({ field: e.target.value })}
            placeholder="Field from the trigger, e.g. subject"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
          <div className="flex gap-2">
            <select
              value={typeof config.operator === "string" ? config.operator : "contains"}
              onChange={(e) => set({ operator: e.target.value })}
              className="h-11 rounded-lg border border-slate-200 bg-white px-2.5 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
            >
              <option value="contains">contains</option>
              <option value="not_contains">does not contain</option>
              <option value="equals">equals</option>
            </select>
            <input
              value={typeof config.value === "string" ? config.value : ""}
              onChange={(e) => set({ value: e.target.value })}
              placeholder="value"
              className="h-11 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
            />
          </div>
        </div>
        <p className="mt-2 text-[12px] text-slate-400">
          For a Gmail trigger, common fields are <code className="rounded bg-slate-100 px-1 py-0.5">subject</code>,{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">from</code>, or{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">snippet</code>. If this doesn&apos;t match, every step after it is skipped.
        </p>
      </Field>
    );
  }

  if (app === "ai") {
    return (
      <>
        <Field label="Prompt" required>
          <textarea
            value={typeof config.prompt === "string" ? config.prompt : ""}
            onChange={(e) => set({ prompt: e.target.value })}
            rows={3}
            placeholder="e.g. Extract the sender's name, company, and what they're asking for."
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
          <EnhancePromptButton
            prompt={typeof config.prompt === "string" ? config.prompt : ""}
            onEnhanced={(next) => set({ prompt: next })}
          />
        </Field>
        <Field label="Read from field">
          <input
            value={typeof config.sourceField === "string" ? config.sourceField : ""}
            onChange={(e) => set({ sourceField: e.target.value })}
            placeholder="e.g. snippet — leave blank to read the whole trigger"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
        </Field>
        <Field label="Quality">
          <select
            value={config.quality === "advanced" ? "advanced" : "fast"}
            onChange={(e) => set({ quality: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
          >
            <option value="fast">Fast (default — cheap, good for extraction)</option>
            <option value="advanced">Advanced (slower, better reasoning, uses more AI credits)</option>
          </select>
        </Field>
        <Field label="Result type">
          <select
            value={
              config.outputType === "json" ||
              config.outputType === "boolean" ||
              config.outputType === "number"
                ? config.outputType
                : "text"
            }
            onChange={(e) => set({ outputType: e.target.value })}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
          >
            <option value="text">Text</option>
            <option value="boolean">True / false decision</option>
            <option value="number">Number</option>
            <option value="json">Structured JSON</option>
          </select>
          <p className="mt-2 text-[12px] text-slate-400">
            The run fails if Riz returns anything outside this type. Use true / false plus a following filter to gate consequential actions.
          </p>
        </Field>
        <Field label="User context">
          <div className="flex flex-col gap-2">
            {[
              ["preferences", "Saved preferences"],
              ["memory", "Relevant memory"],
              ["decisions", "Recorded decisions"],
            ].map(([scope, label]) => {
              const scopes = Array.isArray(config.contextScopes)
                ? config.contextScopes.filter((value): value is string => typeof value === "string")
                : [];
              return (
                <label key={scope} className="flex items-center gap-2 text-[13px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={(e) =>
                      set({
                        contextScopes: e.target.checked
                          ? [...new Set([...scopes, scope])]
                          : scopes.filter((value) => value !== scope),
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {label}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-slate-400">
            Off by default. Select only the context this decision genuinely needs; connector content is never added automatically.
          </p>
        </Field>
        <Field label="Save result as">
          <input
            value={typeof config.outputField === "string" ? config.outputField : ""}
            onChange={(e) => set({ outputField: e.target.value })}
            placeholder="ai_output (default)"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
          <p className="mt-2 text-[12px] text-slate-400">
            Use <code className="rounded bg-slate-100 px-1 py-0.5">{"{{" + (typeof config.outputField === "string" && config.outputField ? config.outputField : "ai_output") + "}}"}</code> in
            a later step to insert the result. This step uses your plan&apos;s AI credits — it&apos;s skipped (marked failed) if your AI budget is exhausted.
          </p>
        </Field>
      </>
    );
  }

  return null;
}

type CalComEventType = { id: number; title: string };

// "Enhance with AI" — rewrites the user's rough instruction into a precise
// prompt via a real LLM call (see gateway's /api/automations/enhance-prompt),
// without running it against any data.
function EnhancePromptButton({
  prompt,
  onEnhanced,
}: {
  prompt: string;
  onEnhanced: (next: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enhance() {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/automations/enhance-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = (await res.json().catch(() => null)) as { prompt?: string; error?: string } | null;
      if (!res.ok || !data?.prompt) {
        setError(data?.error || "Couldn't enhance that prompt — try again.");
        return;
      }
      onEnhanced(data.prompt);
    } catch {
      setError("Couldn't reach Riz — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={enhance}
        disabled={!prompt.trim() || loading}
        className="flex items-center gap-1.5 rounded-md border border-[#6C4BF4]/30 bg-[#6C4BF4]/5 px-2.5 py-1.5 text-[12px] font-medium text-[#6C4BF4] transition hover:border-[#6C4BF4]/50 hover:bg-[#6C4BF4]/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
      >
        <WandIcon className="h-3.5 w-3.5" />
        {loading ? "Enhancing…" : "Enhance with AI"}
      </button>
      {error && <p className="mt-1.5 text-[12px] text-red-500">{error}</p>}
    </div>
  );
}

function CalComBookingFields({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const [eventTypes, setEventTypes] = useState<CalComEventType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/automations/calcom-event-types")
      .then((r) => r.json())
      .then((data: { eventTypes?: CalComEventType[] }) => setEventTypes(data.eventTypes ?? []))
      .catch(() => setEventTypes([]))
      .finally(() => setLoading(false));
  }, []);

  function set(patch: Record<string, unknown>) {
    onChange({ ...config, ...patch });
  }

  return (
    <>
      <Field label="Event type" required>
        <select
          value={typeof config.eventTypeId === "number" ? config.eventTypeId : ""}
          onChange={(e) => set({ eventTypeId: Number(e.target.value) })}
          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
        >
          <option value="" disabled>
            {loading ? "Loading event types…" : eventTypes.length === 0 ? "No Cal.com event types found" : "Choose an event type"}
          </option>
          {eventTypes.map((et) => (
            <option key={et.id} value={et.id}>
              {et.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Attendee name" required>
        <input
          value={typeof config.attendeeName === "string" ? config.attendeeName : ""}
          onChange={(e) => set({ attendeeName: e.target.value })}
          placeholder="e.g. {{from}}"
          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
        />
      </Field>
      <Field label="Attendee email" required>
        <input
          value={typeof config.attendeeEmail === "string" ? config.attendeeEmail : ""}
          onChange={(e) => set({ attendeeEmail: e.target.value })}
          placeholder="name@example.com"
          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
        />
      </Field>
      <Field label="Start time" required>
        <input
          type="datetime-local"
          value={typeof config.start === "string" ? config.start : ""}
          onChange={(e) => set({ start: e.target.value })}
          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
        />
      </Field>
    </>
  );
}

// ── Telegram connect dialog — real deep-link token + real link-status polling ──

function TelegramConnectDialog({
  appName,
  onClose,
  onConnected,
}: {
  appName: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [status, setStatus] = useState<"waiting" | "linking" | "done">("waiting");
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [qrSeed, setQrSeed] = useState("");

  useEffect(() => {
    fetch("/api/onboarding/telegram/token", { method: "POST" })
      .then((r) => r.json())
      .then((data: { deepLink?: string }) => {
        if (data.deepLink) {
          setDeepLink(data.deepLink);
          setQrSeed(data.deepLink);
        }
      })
      .catch(() => null);
  }, []);

  // Real link-status polling — matches /dashboard/telegram's own loop.
  useEffect(() => {
    if (status !== "linking") return;
    const interval = setInterval(() => {
      fetch("/api/telegram")
        .then((r) => r.json())
        .then((data: { linked?: boolean }) => {
          if (data.linked) {
            clearInterval(interval);
            setStatus("done");
            setTimeout(onConnected, 700);
          }
        })
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(interval);
  }, [status, onConnected]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <span className="flex items-center gap-2">
            <AppIcon app="telegram" className="h-5 w-5" />
            <span className="text-[15px] font-semibold text-slate-900">Connect {appName}</span>
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center px-5 py-6">
          {status === "done" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckGlyph className="h-7 w-7 text-emerald-600" />
              </span>
              <p className="text-[15px] font-semibold text-slate-900">Connected!</p>
              <p className="text-[13px] text-slate-500">Your Telegram chat is now linked to Rizly.</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <FakeQr seed={qrSeed || appName} className={`h-[200px] w-[200px] rounded-xl border border-slate-200 p-3 ${status === "linking" ? "opacity-40" : ""}`} />
                {status === "linking" && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#6C4BF4]" />
                  </span>
                )}
              </div>

              <a
                href={deepLink ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => deepLink && setStatus("linking")}
                aria-disabled={!deepLink}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#6C4BF4] px-4 py-2.5 text-[14px] font-medium text-white transition hover:brightness-105 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              >
                <AppIcon app="telegram" className="h-4 w-4 [&_*]:fill-white" />
                Open {appName}
              </a>

              <p className="mt-3 text-center text-[12px] leading-relaxed text-slate-500">
                {status === "linking"
                  ? "Waiting for you to message the bot…"
                  : <>Scan the QR, or tap <b>Open {appName}</b>, then send <code className="rounded bg-slate-100 px-1 py-0.5">/start</code> to the bot.</>}
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// A decorative, deterministic QR-like graphic for the demo (not a real code).
function FakeQr({ seed, className }: { seed: string; className?: string }) {
  const N = 21;
  const cells = useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    const rand = () => {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      return h / 0xffffffff;
    };
    const inFinder = (x: number, y: number) =>
      (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
    const grid: boolean[] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        grid[y * N + x] = inFinder(x, y) ? false : rand() > 0.5;
      }
    }
    return grid;
  }, [seed]);

  const finder = (ox: number, oy: number) => (
    <>
      <rect x={ox} y={oy} width={7} height={7} fill="#0f172a" />
      <rect x={ox + 1} y={oy + 1} width={5} height={5} fill="#fff" />
      <rect x={ox + 2} y={oy + 2} width={3} height={3} fill="#0f172a" />
    </>
  );

  return (
    <svg viewBox={`0 0 ${N} ${N}`} className={className} shapeRendering="crispEdges" aria-label="Telegram link QR (demo)">
      <rect x={0} y={0} width={N} height={N} fill="#fff" />
      {cells.map((on, i) =>
        on ? <rect key={i} x={i % N} y={Math.floor(i / N)} width={1} height={1} fill="#0f172a" /> : null,
      )}
      {finder(0, 0)}
      {finder(N - 7, 0)}
      {finder(0, N - 7)}
    </svg>
  );
}

// ── Event picker (Zapier-style searchable floating menu) ───────────────────────

function EventPicker({
  events,
  selected,
  appName,
  appId,
  kind,
  onSelect,
}: {
  events: AppEvent[];
  selected: string;
  appName: string;
  appId: string;
  kind: AutomationStep["kind"];
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxHeight: number; drop: "down" | "up" } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const desired = 340;
    const below = window.innerHeight - r.bottom - gap - 8;
    const above = r.top - gap - 8;
    const drop = below < Math.min(desired, 220) && above > below ? "up" : "down";
    const maxHeight = Math.min(desired, drop === "down" ? below : above);
    setPos({
      left: r.left,
      top: drop === "down" ? r.bottom + gap : r.top - gap,
      width: r.width,
      maxHeight: Math.max(maxHeight, 160),
      drop,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    function onDocClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReflow() {
      place();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, place]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? events.filter((ev) => ev.name.toLowerCase().includes(q) || ev.description.toLowerCase().includes(q))
    : events;
  // Pinned events float to the top, preserving original order within groups.
  const ordered = [...filtered].sort((a, b) => Number(pinned.has(b.name)) - Number(pinned.has(a.name)));

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-11 w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-[14px] outline-none transition ${
          open ? "border-[#6C4BF4]" : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <span className={selected ? "text-slate-900" : "text-slate-400"}>{selected || "Choose an event"}</span>
        <SelectChevrons className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {/* Floating menu (portaled so panel overflow can't clip it) */}
      {open && pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              width: pos.width,
              maxHeight: pos.maxHeight,
              transform: pos.drop === "up" ? "translateY(-100%)" : undefined,
            }}
            className="z-[100] flex flex-col overflow-hidden rounded-xl border border-[#d7d3c9] bg-[#fffefb] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25)]"
          >
          {/* Search */}
          <div className="shrink-0 p-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5">
              <SearchGlyph className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                placeholder="Search events"
                className="h-9 w-full bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 outline-none"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} title="Clear" className="text-slate-400 hover:text-slate-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2 pb-1">
            {ordered.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-slate-400">No matching events</p>
            ) : (
              ordered.map((ev) => {
                const isSel = ev.name === selected;
                const isPinned = pinned.has(ev.name);
                const live = isEventLive(appId, kind, ev.name);
                return (
                  <div
                    key={ev.name}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={!live}
                    tabIndex={0}
                    onClick={() => {
                      if (!live) return;
                      onSelect(ev.name);
                      setOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (!live) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(ev.name);
                        setOpen(false);
                      }
                    }}
                    className={`group px-3 py-2 outline-none transition ${
                      !live
                        ? "cursor-not-allowed opacity-40"
                        : isSel
                          ? "cursor-pointer bg-[#6C4BF4]/8"
                          : "cursor-pointer hover:bg-slate-50 focus:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-[#201515]">{ev.name}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#d5d7fc] px-1.5 py-0.5 text-[11px] font-medium text-[#413735]">
                          <KindGlyph kind={ev.kind} className="h-3 w-3" />
                          {ev.kind}
                        </span>
                        {!live && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                            Soon
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={isPinned ? "Unpin event" : "Pin event"}
                        title={isPinned ? "Unpin event" : "Pin event"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinned((prev) => {
                            const next = new Set(prev);
                            if (next.has(ev.name)) next.delete(ev.name);
                            else next.add(ev.name);
                            return next;
                          });
                        }}
                        className={`shrink-0 transition ${
                          isPinned ? "text-[#6C4BF4]" : "text-slate-300 opacity-0 hover:text-slate-500 group-hover:opacity-100"
                        }`}
                      >
                        <PinGlyph className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{ev.description}</p>
                  </div>
                );
              })
            )}
          </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ── Glyphs ──────────────────────────────────────────────────────────────────────

type G = { className?: string };

function Icon({ children, className, w = 1.8 }: { children: React.ReactNode; className?: string; w?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function PlusGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ChevronDown({ className }: G) {
  return <Icon className={className}><path d="m6 9 6 6 6-6" /></Icon>;
}
function ChevronRight({ className }: G) {
  return <Icon className={className}><path d="m9 6 6 6-6 6" /></Icon>;
}
function SelectChevrons({ className }: G) {
  return <Icon className={className}><path d="m8 9 4-4 4 4" /><path d="m16 15-4 4-4-4" /></Icon>;
}
function KebabGlyph({ className }: G) {
  return <Icon className={className} w={2.2}><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></Icon>;
}
function GearGlyph({ className }: G) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  );
}
function BoltGlyph({ className }: G) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
    </svg>
  );
}
function HomeGlyph({ className }: G) {
  return <Icon className={className}><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Icon>;
}
function GridGlyph({ className }: G) {
  return (
    <Icon className={className} w={2}>
      <circle cx="5" cy="5" r="1.4" /><circle cx="12" cy="5" r="1.4" /><circle cx="19" cy="5" r="1.4" />
      <circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" />
      <circle cx="5" cy="19" r="1.4" /><circle cx="12" cy="19" r="1.4" /><circle cx="19" cy="19" r="1.4" />
    </Icon>
  );
}
function DocGlyph({ className }: G) {
  return <Icon className={className}><path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" /><path d="M14 2v6h6" /></Icon>;
}
function ChatGlyph({ className }: G) {
  return <Icon className={className}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" /></Icon>;
}
function CalGlyph({ className }: G) {
  return <Icon className={className}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></Icon>;
}
function ClockGlyph({ className }: G) {
  return <Icon className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
}
function FlowGlyph({ className }: G) {
  return <Icon className={className}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.5 6H15a3 3 0 0 1 3 3v6.5" /></Icon>;
}
function DrawerGlyph({ className }: G) {
  return <Icon className={className}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 15h6" /></Icon>;
}
function TargetGlyph({ className }: G) {
  return <Icon className={className}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></Icon>;
}
function FolderGlyph({ className }: G) {
  return <Icon className={className}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Icon>;
}
function HelpGlyph({ className }: G) {
  return <Icon className={className}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.3-2.4 3.8" /><path d="M12 17h.01" /></Icon>;
}
function SearchGlyph({ className }: G) {
  return <Icon className={className}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>;
}
function UndoGlyph({ className }: G) {
  return <Icon className={className}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></Icon>;
}
function HistoryGlyph({ className }: G) {
  return <Icon className={className}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 8v4l3 2" /></Icon>;
}
function PlayGlyph({ className }: G) {
  return <Icon className={className}><path d="M7 4v16l13-8z" /></Icon>;
}
function PencilGlyph({ className }: G) {
  return <Icon className={className}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Icon>;
}
function ExpandGlyph({ className }: G) {
  return <Icon className={className}><path d="M15 3h6v6M9 21H3v-6" /><path d="M21 3 14 10M3 21l7-7" /></Icon>;
}
function CollapseGlyph({ className }: G) {
  return <Icon className={className}><path d="M4 14h6v6M20 10h-6V4" /><path d="M14 10l7-7M3 21l7-7" /></Icon>;
}
function CircleGlyph({ className }: G) {
  return <Icon className={className}><circle cx="12" cy="12" r="8" /></Icon>;
}
function CheckGlyph({ className }: G) {
  return <Icon className={className} w={2.2}><path d="M20 6 9 17l-5-5" /></Icon>;
}
function PinGlyph({ className }: G) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.92.81 10.94 7.2l-5.21.46-1.67 1.67 10.61 10.61 1.67-1.67.46-5.21 6.39-2.98zM7.57 15.01 2.29 20.29l1.42 1.42 5.28-5.28z" />
    </svg>
  );
}
function KindGlyph({ kind, className }: G & { kind: EventKind }) {
  if (kind === "Instant") {
    return <BoltGlyph className={className} />;
  }
  if (kind === "Action") {
    return <Icon className={className}><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></Icon>;
  }
  return <ClockGlyph className={className} />;
}
function LibraryGlyph({ className }: G) {
  return <Icon className={className}><path d="M4 4h6v16H4zM14 4h6v16h-6z" /></Icon>;
}
function BranchGlyph({ className }: G) {
  return <Icon className={className}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="9" r="2.5" /><path d="M6 8.5v7M6 12h6a3 3 0 0 0 3-3" /></Icon>;
}
function CopilotGlyph({ className }: G) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="m12 2 2.2 5.6L20 9l-4.6 3.4L17 18l-5-3.2L7 18l1.6-5.6L4 9l5.8-1.4z" />
    </svg>
  );
}
