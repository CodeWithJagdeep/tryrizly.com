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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { ConnectorLogo } from "../../../components/ConnectorLogo";
import { ArrowUpIcon, ClockIcon, PlugIcon, WandIcon } from "../../components/icons";
import { MarkdownMessage } from "../../components/MarkdownMessage";
import {
  activateFlow,
  type AutomationFlow,
  type AutomationRun,
  type AutomationRunAuditEvent,
  type AutomationRunPlanStep,
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
      { name: "New Comment on Issue/PR", description: "Triggers when someone comments on an issue or pull request.", kind: "Instant" },
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
      // Push-only, fed by the Notion webhook receiver — see
      // AiCoreService.notionWebhookEvent. The only Notion trigger that
      // actually runs; the two below are cosmetic ("New Database Item" has
      // no cheap poll endpoint to back it, "Updated" has the same problem).
      { name: "New Comment", description: "Triggers when someone comments on a page in your workspace.", kind: "Instant" },
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
    triggers: [
      { name: "New Booking", description: "Triggers when a new booking is made in Cal.com.", kind: "Instant" },
      { name: "Booking Cancelled", description: "Triggers when a booking is cancelled in Cal.com.", kind: "Instant" },
      { name: "Booking Rescheduled", description: "Triggers when a booking is rescheduled in Cal.com.", kind: "Instant" },
      { name: "Meeting Started", description: "Triggers when a Cal.com meeting is about to start.", kind: "Instant" },
      { name: "Meeting Ended", description: "Triggers when a Cal.com meeting has just ended.", kind: "Instant" },
      { name: "Out of Office Created", description: "Triggers when you mark yourself out of office in Cal.com.", kind: "Instant" },
    ],
    actions: [],
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
    actions: [
      { name: "Send Message", description: "Sends a DM — to yourself, or to another Discord user by ID.", kind: "Action" },
      { name: "Send Channel Message", description: "Sends a message to a channel in one of your connected servers.", kind: "Action" },
    ],
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
  // Everything below is push-only (or, for BambooHR, poll-only) — trigger-only,
  // no live actions yet. Titles must match shared/automations/types.ts's
  // LIVE_TRIGGER_EVENTS exactly (isEventLive checks against that list).
  {
    id: "shopify",
    name: "Shopify",
    category: "E-commerce",
    triggers: [
      { name: "New Order", description: "Triggers when a new order is placed in your Shopify store.", kind: "Instant" },
      { name: "Low Inventory", description: "Triggers when a product's inventory drops.", kind: "Instant" },
    ],
    actions: [],
  },
  {
    id: "calendly",
    name: "Calendly",
    category: "Scheduling",
    triggers: [
      { name: "Booking Created", description: "Triggers when someone books a new event on your Calendly.", kind: "Instant" },
      { name: "Booking Cancelled", description: "Triggers when a Calendly booking is cancelled.", kind: "Instant" },
    ],
    actions: [],
  },
  {
    id: "typeform",
    name: "Typeform",
    category: "Productivity & Files",
    triggers: [{ name: "New Submission", description: "Triggers when someone submits your Typeform.", kind: "Instant" }],
    actions: [],
  },
  {
    id: "gumroad",
    name: "Gumroad",
    category: "E-commerce",
    triggers: [{ name: "New Sale", description: "Triggers when you make a new sale on Gumroad.", kind: "Instant" }],
    actions: [],
  },
  {
    id: "lemonsqueezy",
    name: "Lemon Squeezy",
    category: "E-commerce",
    triggers: [{ name: "New Sale", description: "Triggers when you make a new sale on Lemon Squeezy.", kind: "Instant" }],
    actions: [],
  },
  {
    id: "dropbox",
    name: "Dropbox",
    category: "Productivity & Files",
    triggers: [
      { name: "File Changed", description: "Triggers when any file changes anywhere in your Dropbox.", kind: "Instant" },
      { name: "New File in Folder", description: "Triggers when a new file is added to a specific folder.", kind: "Instant" },
      { name: "New or Updated File in Folder", description: "Triggers when a file is added or edited in a specific folder.", kind: "Instant" },
      { name: "New Shared File", description: "Triggers when a new file is shared with you.", kind: "Polling" },
    ],
    actions: [],
  },
  {
    id: "figma",
    name: "Figma",
    category: "Design",
    triggers: [{ name: "New Comment", description: "Triggers when someone comments on a Figma file.", kind: "Instant" }],
    actions: [],
  },
  {
    id: "uptimerobot",
    name: "UptimeRobot",
    category: "Developer & IT Tools",
    triggers: [
      { name: "Monitor Down", description: "Triggers when a monitored site or service goes down.", kind: "Instant" },
      { name: "Monitor Up", description: "Triggers when a monitored site or service comes back up.", kind: "Instant" },
    ],
    actions: [],
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "Finance & Accounting",
    triggers: [
      { name: "New Invoice", description: "Triggers when a new invoice is created in QuickBooks.", kind: "Instant" },
      { name: "Invoice Paid", description: "Triggers when an invoice is paid in QuickBooks.", kind: "Instant" },
    ],
    actions: [],
  },
  {
    id: "xero",
    name: "Xero",
    category: "Finance & Accounting",
    triggers: [{ name: "New Invoice", description: "Triggers when a new invoice is created in Xero.", kind: "Instant" }],
    actions: [],
  },
  {
    id: "wise",
    name: "Wise",
    category: "Finance & Accounting",
    triggers: [{ name: "New Transaction", description: "Triggers when a new transaction hits your Wise balance.", kind: "Instant" }],
    actions: [],
  },
  {
    id: "bamboohr",
    name: "BambooHR",
    category: "HR",
    triggers: [
      { name: "New Time Off Request", description: "Triggers when an employee submits a time-off request.", kind: "Polling" },
      { name: "New Hire", description: "Triggers when a new employee is added in BambooHR.", kind: "Polling" },
    ],
    actions: [],
  },
  {
    id: "deel",
    name: "Deel",
    category: "HR",
    triggers: [
      { name: "New Contract", description: "Triggers when a new contract is created in Deel.", kind: "Instant" },
      { name: "Payment Completed", description: "Triggers when a Deel payment completes.", kind: "Instant" },
    ],
    actions: [],
  },
  {
    id: "box",
    name: "Box",
    category: "Productivity & Files",
    triggers: [{ name: "File Changed", description: "Triggers when a file changes in your connected Box folder.", kind: "Instant" }],
    actions: [],
  },
  {
    id: "statuspage",
    name: "Statuspage",
    category: "Developer & IT Tools",
    triggers: [
      { name: "New Incident", description: "Triggers when a new incident is reported on your status page.", kind: "Instant" },
      { name: "Incident Update", description: "Triggers when an incident is updated on your status page.", kind: "Instant" },
    ],
    actions: [],
  },
  {
    id: "betterstack",
    name: "Better Stack",
    category: "Developer & IT Tools",
    triggers: [
      { name: "Incident Started", description: "Triggers when a Better Stack incident starts.", kind: "Instant" },
      { name: "Incident Resolved", description: "Triggers when a Better Stack incident is resolved.", kind: "Instant" },
    ],
    actions: [],
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
  // Apps with no hand-drawn icon component fall back to the real downloaded
  // logo (see ConnectorLogo.tsx / connector-logo-manifest.ts), not a bare
  // plug glyph — every app added after the icon-set batch lands here.
  return (
    <ConnectorLogo
      provider={app}
      alt={appName(app)}
      className={className}
      fallback={<PlugIcon className={className} />}
    />
  );
}

const appDef = (id: string) => APPS.find((a) => a.id === id);
const appName = (id: string) => appDef(id)?.name ?? "";

// How each app is actually connected in Rizly — the "Account" step differs a lot
// by provider, so the config panel branches on this instead of always showing an
// OAuth "Sign in" button.
type ConnectMethod = "oauth" | "bot" | "slack_bot" | "discord_bot" | "secret" | "none";

function connectMethod(appId: string): ConnectMethod {
  if (appId === "telegram") return "bot"; // deep-link / QR to the Rizly bot
  // Slack installs via its own "Add to Slack" OAuth flow on /dashboard/slack,
  // not the generic /api/connectors/[provider]/start route (which 400s with
  // "Unsupported OAuth provider: slack" — that route only handles the plain
  // single-token OAuth apps, Slack's install grant isn't one of those).
  if (appId === "slack") return "slack_bot";
  // Discord installs per-server via its own "Add to Discord" bot-install flow
  // (not the generic OAuth start route, and — unlike Slack — resolved right
  // here in the dialog instead of bouncing out to a separate dashboard page).
  if (appId === "discord") return "discord_bot";
  if (appId === "schedule" || appId === "delay" || appId === "filter" || appId === "ai") return "none"; // built-in, no account
  if (
    appId === "stripe" ||
    appId === "postgres" ||
    appId === "jira" ||
    appId === "pagerduty" ||
    appId === "trello" ||
    appId === "twilio" ||
    // Manual API-key/token connectors added later -- none of these have a
    // real OAuth exchange on the backend, so they must not fall through to
    // the "oauth" default below (that's what broke Calendly's connected-
    // account detection: it silently rendered a Sign-in flow instead of
    // recognizing the already-connected manual account).
    appId === "calendly" ||
    appId === "typeform" ||
    appId === "gumroad" ||
    appId === "lemonsqueezy" ||
    appId === "uptimerobot" ||
    appId === "bamboohr" ||
    appId === "statuspage" ||
    appId === "betterstack" ||
    appId === "wise"
  ) {
    return "secret";
  }
  // Google Sheets is OAuth (bundled under google_workspace), despite sharing
  // the "Databases" category label with Postgres/MongoDB below. Airtable is
  // real OAuth too (PKCE), despite sharing that same category label.
  if (
    appId === "google-sheets" ||
    appId === "google-drive" ||
    appId === "google-docs" ||
    appId === "google-meet" ||
    appId === "airtable"
  ) {
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
  // "New Label" only detects a label being freshly *applied* to a message
  // (there's no cheap "label object was just created" event to poll) — see
  // SchedulerService.pollOneAutomation's gmail branch for the exact caveat.
  gmail: [
    "New Email Matching Search",
    "New Email",
    "New Attachment",
    "New Conversation",
    "New Starred Email",
    "New Label",
    "New Labeled Email",
    "New Labeled Conversation",
  ],
  // "Event Cancelled" and "New or Updated Event" are approximate: Calendar's
  // list API doesn't push deletions/updates separately, so both are derived
  // by diffing successive polls against flow.cursor — see SchedulerService.
  calendar: ["New Event", "Event Start", "Event Cancelled", "New or Updated Event"],
  calcom: [
    "New Booking",
    "Booking Cancelled",
    "Booking Rescheduled",
    "Meeting Started",
    "Meeting Ended",
    "Out of Office Created",
  ],
  jira: ["New Issue"],
  pagerduty: ["New Incident"],
  trello: ["New Card"],
  // Polled (not a webhook — the GitHub connector is a plain PAT with no
  // webhook-registration flow) via SchedulerService's "github" branches.
  github: ["New Pull Request", "New Issue", "New Push", "New Comment on Issue/PR"],
  mongodb: ["New Document"],
  "google-drive": ["New File"],
  "google-sheets": ["New Row"],
  "google-forms": ["New Submission"],
  "google-meet": ["Meeting Started"],
  airtable: ["New Record"],
  notion: ["New Comment"],
  discord: ["New Message"],
  telegram: ["New Message"],
  slack: ["New Message Posted to Channel", "New Mention", "New Reaction Added"],
  shopify: ["New Order", "Low Inventory"],
  calendly: ["Booking Created", "Booking Cancelled"],
  typeform: ["New Submission"],
  gumroad: ["New Sale"],
  lemonsqueezy: ["New Sale"],
  dropbox: ["File Changed", "New File in Folder", "New or Updated File in Folder", "New Shared File"],
  figma: ["New Comment"],
  uptimerobot: ["Monitor Down", "Monitor Up"],
  quickbooks: ["New Invoice", "Invoice Paid"],
  xero: ["New Invoice"],
  wise: ["New Transaction"],
  deel: ["New Contract", "Payment Completed"],
  box: ["File Changed"],
  statuspage: ["New Incident", "Incident Update"],
  betterstack: ["Incident Started", "Incident Resolved"],
  stripe: ["New Payment", "New Subscription", "Failed Charge"],
  razorpay: ["New Payment", "Failed Payment"],
  paypal: ["New Payment", "New Refund"],
  bamboohr: ["New Time Off Request", "New Hire"],
};

const LIVE_ACTION_EVENTS: Record<string, string[]> = {
  // "Send Channel Message" is deliberately excluded — it silently sends to
  // the linked Slack DM, not the actual channel (see the matching comment
  // in shared/src/automations/types.ts). Keep this list in sync with that
  // file since web can't import it directly (nested, separately-deployed repo).
  slack: ["Send Direct Message"],
  telegram: ["Send Message", "Notify Me"],
  discord: ["Send Message", "Send Channel Message"],
  github: ["Create Issue"],
  notion: ["Create Page"],
  stripe: ["Create Customer"],
  razorpay: ["Create Invoice"],
  paypal: ["Create Invoice"],
  gmail: ["Send Email", "Create Draft", "Reply to Email", "Add Label to Email"],
  // "Find Availability" is read-only (Calendar's freeBusy endpoint) but still
  // an "action" step in the catalog, not a trigger.
  calendar: ["Create Detailed Event", "Update Event", "Find Availability"],
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
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const refreshRuns = useCallback(async () => {
    setRunsLoading(true);
    setRunsError(null);
    try {
      setRuns(await listRuns(flowId));
    } catch {
      setRunsError("Run history could not be loaded.");
    } finally {
      setRunsLoading(false);
    }
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
      const { flow, error } = await saveFlow({
        id: flowId,
        name: nameRef.current.trim() || "Untitled Zap",
        steps: stepsRef.current.map((s) => ({ ...s, subtitle: appName(s.app) })),
      });
      if (error) {
        setPublishError(error);
      } else if (flow) {
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
    const { flow, error } = await saveFlow({
      id: flowId,
      name: name.trim() || "Untitled Zap",
      steps: steps.map((s) => ({ ...s, subtitle: appName(s.app) })),
    });
    if (error) {
      setPublishError(error);
      return;
    }
    if (flow) setStatus(flow.status);
    setPublishError(null);
    setSaved(true);
  }

  async function handleDuplicate() {
    const newId = newFlowId();
    const { error } = await saveFlow({ id: newId, name: `${name.trim() || "Untitled Zap"} (copy)`, steps });
    if (error) {
      setPublishError(error);
      return;
    }
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
      const { error: saveError } = await saveFlow({ id: flowId, name: name.trim() || "Untitled Zap", steps });
      if (saveError) {
        setPublishError(saveError);
        return;
      }
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
                triggerApp={steps[0]?.app}
                runs={runs}
                runsLoading={runsLoading}
                runsError={runsError}
                onRefreshRuns={() => void refreshRuns()}
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
  triggerApp,
  runs,
  runsLoading,
  runsError,
  onRefreshRuns,
  expanded,
  onToggleExpand,
  onPatch,
  onClose,
}: {
  step: AutomationStep;
  index: number;
  triggerApp?: string;
  runs: AutomationRun[];
  runsLoading: boolean;
  runsError: string | null;
  onRefreshRuns: () => void;
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
          <RunHistory
            runs={runs}
            loading={runsLoading}
            error={runsError}
            onRetry={onRefreshRuns}
          />
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
              title={step.title}
              value={typeof step.config?.account === "string" ? step.config.account : undefined}
              onChange={(account) => onPatch({ config: { ...(step.config ?? {}), account } })}
            />

            {/* Per-app config — only rendered once a live event is chosen */}
            {isEventLive(step.app, step.kind, step.title) && (
              <AutomationConfigFields
                app={step.app}
                kind={step.kind}
                title={step.title}
                config={step.config ?? {}}
                onChange={(config) => onPatch({ config })}
                triggerApp={triggerApp}
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

// ── Run audit trail ──────────────────────────────────────────────────────────

function RunHistory({
  runs,
  loading,
  error,
  onRetry,
}: {
  runs: AutomationRun[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading && runs.length === 0) {
    return (
      <div className="space-y-3" aria-label="Loading run history">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-xl border border-slate-200 p-4">
            <div className="h-3 w-24 rounded bg-slate-100" />
            <div className="mt-3 h-2.5 w-3/4 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (error && runs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
          <HistoryGlyph className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-slate-800">Run history unavailable</p>
          <p className="mt-1 text-[13px] text-slate-500">{error}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 active:bg-slate-100"
        >
          Try again
        </button>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <HistoryGlyph className="h-5 w-5" />
        </span>
        <p className="mt-1 text-[14px] font-semibold text-slate-800">No runs yet</p>
        <p className="max-w-[260px] text-[13px] leading-5 text-slate-500">
          Activate this automation. Its original plan, decisions, evidence, and final verification will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-slate-900">Run history</p>
          <p className="mt-1 text-[12px] leading-5 text-slate-500">
            An inspectable record of what Rizly planned, changed, and proved.
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          aria-label="Refresh run history"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200 disabled:opacity-40"
        >
          <HistoryGlyph className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          Refresh failed. Showing the last loaded history.
        </p>
      )}
      <div className="space-y-3">
        {runs.map((run, index) => (
          <RunAuditDisclosure
            key={run.id}
            run={run}
            defaultOpen={index === 0}
          />
        ))}
      </div>
    </div>
  );
}

function RunAuditDisclosure({
  run,
  defaultOpen,
}: {
  run: AutomationRun;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const revisions = run.auditTrail?.filter((event) => event.type === "plan_revised") ?? [];
  const eventCount = run.auditTrail?.length ?? run.stepResults.length;
  const duration = formatRunDuration(run.startedAt, run.finishedAt);
  const statusLabel =
    run.status === "running" ? "Running" : run.status === "success" ? "Completed" : "Failed";
  const statusTone =
    run.status === "running"
      ? "bg-blue-50 text-blue-700"
      : run.status === "success"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-red-50 text-red-700";

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white open:border-slate-300"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3.5 transition-colors duration-150 hover:bg-slate-50 active:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            run.status === "running"
              ? "bg-blue-500"
              : run.status === "success"
                ? "bg-emerald-500"
                : "bg-red-500"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${statusTone}`}>
              {statusLabel}
            </span>
            {revisions.length > 0 && (
              <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                Recovered {revisions.length}×
              </span>
            )}
          </span>
          <span className="mt-1.5 block truncate text-[11px] text-slate-500">
            {formatRunDate(run.startedAt)}
            {duration ? ` · ${duration}` : ""}
            {` · ${eventCount} ${eventCount === 1 ? "event" : "events"}`}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 group-open:rotate-90" />
      </summary>
      <div className="border-t border-slate-100 px-3.5 pb-5 pt-4">
        <RunAuditDetails run={run} />
      </div>
    </details>
  );
}

function RunAuditDetails({
  run,
}: {
  run: AutomationRun;
}) {
  const auditTrail = run.auditTrail ?? legacyAuditEvents(run);
  const revisions = auditTrail.filter(
    (event): event is Extract<AutomationRunAuditEvent, { type: "plan_revised" }> =>
      event.type === "plan_revised",
  );
  const originalPlan = run.originalPlan;
  const allPlanSteps = [
    ...(originalPlan ?? []),
    ...revisions.flatMap((event) => event.replacementSteps),
  ];
  const stepMap = new Map<string, AutomationRunPlanStep | AutomationStep>();
  for (const result of run.stepResults) {
    stepMap.set(result.stepId, {
      id: result.stepId,
      kind: "action",
      app: result.app,
      title: readableAppName(result.app),
    });
  }
  for (const step of allPlanSteps) stepMap.set(step.id, step);
  const supersededAt = new Map<string, number>();
  for (const event of revisions) {
    for (const stepId of event.supersededStepIds) {
      supersededAt.set(stepId, event.revision);
    }
  }
  const headline =
    run.status === "running"
      ? "Execution is still in progress"
      : run.status === "failed"
        ? "Execution stopped without claiming success"
        : revisions.length > 0
          ? `Completed after ${revisions.length} supervised ${revisions.length === 1 ? "recovery" : "recoveries"}`
          : "Completed as planned";

  return (
    <div>
      <div className="rounded-lg bg-slate-950 px-3.5 py-3 text-white">
        <p className="text-[12px] font-semibold">{headline}</p>
        <p className="mt-1 text-[10px] font-medium text-slate-400">
          Run <span className="font-mono text-slate-300">{shortRunId(run.id)}</span>
        </p>
      </div>

      <section className="mt-5" aria-labelledby={`${run.id}-original-plan`}>
        <AuditSectionHeading
          id={`${run.id}-original-plan`}
          eyebrow="Revision 1"
          title="Original plan"
        />
        {originalPlan?.length ? (
          <ol className="mt-3 space-y-1">
            {originalPlan.map((step, index) => {
              const supersededRevision = supersededAt.get(step.id);
              return (
                <li
                  key={step.id}
                  className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
                    {index + 1}
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
                    <AppIcon app={step.app} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[12px] font-semibold ${
                        supersededRevision ? "text-slate-400 line-through" : "text-slate-800"
                      }`}
                    >
                      {step.label || step.title || readableAppName(step.app)}
                    </span>
                    <span className="block truncate text-[10px] text-slate-400">
                      {readableAppName(step.app)}
                    </span>
                  </span>
                  {supersededRevision && (
                    <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-amber-700">
                      Superseded R{supersededRevision}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-3">
            <p className="text-[12px] font-medium text-slate-600">Original plan snapshot unavailable</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">
              This run predates audit snapshots. The recorded outcomes below are preserved, but Rizly will not infer the old plan from today&apos;s flow.
            </p>
          </div>
        )}
      </section>

      <section className="mt-6" aria-labelledby={`${run.id}-timeline`}>
        <AuditSectionHeading
          id={`${run.id}-timeline`}
          eyebrow={`${auditTrail.length} ${auditTrail.length === 1 ? "event" : "events"}`}
          title="Execution timeline"
        />
        {!run.auditTrail && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
            Legacy run: exact event timing and plan revisions were not captured.
          </p>
        )}
        <ol className="relative mt-4 space-y-0">
          {auditTrail.map((event, index) => (
            <AuditTimelineEvent
              key={event.id}
              event={event}
              stepMap={stepMap}
              isLast={index === auditTrail.length - 1}
            />
          ))}
        </ol>
      </section>
    </div>
  );
}

function AuditSectionHeading({
  id,
  eyebrow,
  title,
}: {
  id: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h3 id={id} className="text-[12px] font-bold text-slate-900">{title}</h3>
      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{eyebrow}</span>
    </div>
  );
}

function AuditTimelineEvent({
  event,
  stepMap,
  isLast,
}: {
  event: AutomationRunAuditEvent;
  stepMap: Map<string, AutomationRunPlanStep | AutomationStep>;
  isLast: boolean;
}) {
  const tone =
    event.type === "step_failed" ||
    (event.type === "final_verification" && event.result === "failed")
      ? "red"
      : event.type === "plan_revised"
        ? "violet"
        : event.type === "step_succeeded" ||
            (event.type === "final_verification" && event.result === "passed")
          ? "emerald"
          : "slate";
  const step =
    "stepId" in event && typeof event.stepId === "string"
      ? stepMap.get(event.stepId)
      : undefined;
  const stepTitle = step?.label || step?.title || (
    step?.app ? readableAppName(step.app) : "Unknown step"
  );

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast && <span className="absolute left-[5px] top-3 h-full w-px bg-slate-200" />}
      <span
        className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-white ring-1 ${
          tone === "red"
            ? "bg-red-500 ring-red-200"
            : tone === "violet"
              ? "bg-violet-500 ring-violet-200"
              : tone === "emerald"
                ? "bg-emerald-500 ring-emerald-200"
                : "bg-slate-400 ring-slate-200"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-semibold leading-5 text-slate-800">
            {auditEventTitle(event, stepTitle)}
          </p>
          <time
            dateTime={event.at}
            className="shrink-0 pt-0.5 text-[9px] font-medium tabular-nums text-slate-400"
          >
            {formatAuditTime(event.at)}
          </time>
        </div>
        <AuditEventBody event={event} stepMap={stepMap} />
      </div>
    </li>
  );
}

function AuditEventBody({
  event,
  stepMap,
}: {
  event: AutomationRunAuditEvent;
  stepMap: Map<string, AutomationRunPlanStep | AutomationStep>;
}) {
  if (event.type === "plan_created") {
    return (
      <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
        Revision 1 locked with {event.stepIds.length} {event.stepIds.length === 1 ? "step" : "steps"}.
      </p>
    );
  }
  if (event.type === "step_succeeded") {
    return <EvidenceReceipt evidence={event.evidence} />;
  }
  if (event.type === "step_failed") {
    return (
      <div className="mt-1.5">
        <p className="break-words rounded-md bg-red-50 px-2.5 py-2 text-[11px] leading-4 text-red-800">
          {event.error}
        </p>
        {event.code && (
          <span className="mt-1.5 inline-block font-mono text-[9px] text-red-500">{event.code}</span>
        )}
      </div>
    );
  }
  if (event.type === "step_skipped") {
    return <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{event.reason}</p>;
  }
  if (event.type === "plan_revised") {
    const superseded = event.supersededStepIds
      .map((id) => stepMap.get(id))
      .filter(Boolean) as Array<AutomationRunPlanStep | AutomationStep>;
    return (
      <div className="mt-1.5">
        <p className="rounded-md bg-violet-50 px-2.5 py-2 text-[11px] leading-4 text-violet-900">
          {event.reason}
        </p>
        <div className="mt-2 grid gap-2">
          {superseded.length > 0 && (
            <AuditStepGroup label="Superseded" steps={superseded} tone="amber" />
          )}
          {event.replacementSteps.length > 0 && (
            <AuditStepGroup label="Replacement" steps={event.replacementSteps} tone="violet" />
          )}
        </div>
        {event.preservedStepIds.length > 0 && (
          <p className="mt-2 text-[10px] leading-4 text-slate-500">
            {event.preservedStepIds.length} completed {event.preservedStepIds.length === 1 ? "step was" : "steps were"} preserved with existing evidence.
          </p>
        )}
      </div>
    );
  }
  const methodLabel =
    event.method === "semantic_goal" ? "Semantic goal check" : "Deterministic evidence check";
  return (
    <div className={`mt-1.5 rounded-md px-2.5 py-2 ${
      event.result === "passed" ? "bg-emerald-50" : "bg-red-50"
    }`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.07em] ${
        event.result === "passed" ? "text-emerald-700" : "text-red-700"
      }`}>
        {methodLabel} {event.result}
      </p>
      <p className={`mt-1 text-[11px] leading-4 ${
        event.result === "passed" ? "text-emerald-900" : "text-red-900"
      }`}>
        {event.summary}
      </p>
    </div>
  );
}

function EvidenceReceipt({
  evidence,
}: {
  evidence: NonNullable<AutomationRun["stepResults"][number]["evidence"]>;
}) {
  const metadata = Object.entries(evidence.metadata ?? {}).slice(0, 3);
  const receipt = (
    <span className="flex min-w-0 items-center gap-1.5">
      <CheckGlyph className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {evidence.resourceId
          ? `${evidence.provider} receipt ${evidence.resourceId}`
          : `${evidence.provider} acknowledged`}
      </span>
    </span>
  );
  const href = safeExternalUrl(evidence.resourceUrl);

  return (
    <div className="mt-1.5">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="block max-w-full rounded-md bg-emerald-50 px-2.5 py-2 text-[10px] font-semibold text-emerald-800 transition-colors duration-150 hover:bg-emerald-100"
        >
          {receipt}
        </a>
      ) : (
        <div className="max-w-full rounded-md bg-emerald-50 px-2.5 py-2 text-[10px] font-semibold text-emerald-800">
          {receipt}
        </div>
      )}
      {metadata.length > 0 && (
        <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
          {metadata.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="truncate text-[9px] font-medium text-slate-400">{humanizeAuditKey(key)}</dt>
              <dd className="truncate text-[10px] font-medium text-slate-600">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function AuditStepGroup({
  label,
  steps,
  tone,
}: {
  label: string;
  steps: Array<AutomationRunPlanStep | AutomationStep>;
  tone: "amber" | "violet";
}) {
  return (
    <div>
      <p className={`text-[9px] font-bold uppercase tracking-[0.08em] ${
        tone === "amber" ? "text-amber-700" : "text-violet-700"
      }`}>
        {label}
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {steps.map((step) => (
          <span
            key={step.id}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold ${
              tone === "amber"
                ? "bg-amber-50 text-amber-800"
                : "bg-violet-50 text-violet-800"
            }`}
          >
            <AppIcon app={step.app} className="h-3 w-3" />
            {step.label || step.title || readableAppName(step.app)}
          </span>
        ))}
      </div>
    </div>
  );
}

function auditEventTitle(event: AutomationRunAuditEvent, stepTitle: string): string {
  if (event.type === "plan_created") return "Original plan captured";
  if (event.type === "step_succeeded") return `${stepTitle} completed`;
  if (event.type === "step_failed") return `${stepTitle} failed`;
  if (event.type === "step_skipped") return `${stepTitle} skipped`;
  if (event.type === "plan_revised") return `Supervisor revised the plan to revision ${event.revision}`;
  return event.result === "passed" ? "Final verification passed" : "Final verification failed";
}

function legacyAuditEvents(run: AutomationRun): AutomationRunAuditEvent[] {
  const at = run.finishedAt ?? run.startedAt;
  return run.stepResults.map((result, index) => {
    const base = {
      id: `${run.id}:legacy:${index}`,
      at,
      revision: 1,
      stepId: result.stepId,
    };
    if (result.status === "success" && result.evidence) {
      return { ...base, type: "step_succeeded" as const, evidence: result.evidence };
    }
    if (result.status === "failed") {
      return {
        ...base,
        type: "step_failed" as const,
        error: result.error ?? "A step failed without a recorded error.",
      };
    }
    return {
      ...base,
      type: "step_skipped" as const,
      reason: "This step was recorded as skipped. Older runs did not retain the reason.",
    };
  });
}

function formatRunDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown start time"
    : date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function formatAuditTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "time unavailable"
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function formatRunDuration(startedAt: string, finishedAt?: string): string | null {
  if (!finishedAt) return null;
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) return null;
  if (durationMs < 1_000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${Math.round(durationMs / 1_000)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
}

function shortRunId(id: string): string {
  return id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
}

function readableAppName(app: string): string {
  return appName(app) || app.split("-").map((part) => (
    part ? `${part[0].toUpperCase()}${part.slice(1)}` : part
  )).join(" ");
}

function humanizeAuditKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function safeExternalUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
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
  title,
  value,
  onChange,
}: {
  app: string;
  title?: string;
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
  // Discord's "Add to Discord" install link — null while loading/unconfigured.
  const [discordInstallUrl, setDiscordInstallUrl] = useState<string | null>(null);
  const returnTo = typeof window !== "undefined" ? window.location.pathname : "/dashboard/automations";

  useEffect(() => {
    if (method !== "discord_bot") return;
    fetch("/api/onboarding/discord/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ returnTo }),
    })
      .then((r) => r.json())
      .then((data: { installUrl?: string | null }) => setDiscordInstallUrl(data.installUrl ?? null))
      .catch(() => setDiscordInstallUrl(null));
  }, [method, returnTo]);
  // Connections made from the automation builder request only the scopes a step
  // needs (e.g. Gmail read-only) — see automationOauthScopesByProvider in ai-core.
  const addHref = `/api/connectors/${provider}/start?returnTo=${encodeURIComponent(returnTo)}&scopeProfile=automation`;

  // Legacy combined "google" rows still count as gmail/calendar until reconnect.
  // Discord's real bot connection saves under "discord_surface" (kept distinct
  // so linking it can never clobber the legacy manual "discord" webhook
  // connector's own row) -- count that as a match too.
  const matchesProvider = useCallback(
    (p?: string) =>
      p === provider ||
      ((provider === "gmail" || provider === "calendar") && p === "google") ||
      (provider === "discord" && p === "discord_surface"),
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
    if (method === "slack_bot") {
      setStatus("loading");
      fetch("/api/slack")
        .then((r) => r.json())
        .then((data: { linked?: boolean }) => setStatus(data.linked ? "connected" : "disconnected"))
        .catch(() => setStatus("disconnected"));
      return;
    }
    if (method === "discord_bot") {
      setAccounts(null);
      fetch("/api/discord/channels")
        .then((r) => r.json())
        .then((rows: unknown) => {
          const list: AccountOption[] = Array.isArray(rows)
            ? (rows as Array<{ guildId?: string; guildName?: string }>)
                .filter((g): g is { guildId: string; guildName: string } => Boolean(g.guildId && g.guildName))
                .map((g) => ({ id: g.guildId, label: g.guildName }))
            : [];
          setAccounts(list);
        })
        .catch(() => setAccounts([]));
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
    if (method !== "oauth" && method !== "secret" && method !== "discord_bot") return;
    if (!accounts || accounts.length === 0) return;
    if (!value || !accounts.some((a) => a.id === value)) {
      onChange?.(accounts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, method]);

  // Discord's DM action ("Send Message") never needs a server — it targets
  // yourself or a specific user id, resolved entirely in AutomationConfigFields'
  // own "Send to" control below. Only the channel-based steps (the trigger,
  // and "Send Channel Message") need a server picked here. This must come
  // after every hook above so hook order never changes across renders.
  if (app === "discord" && title === "Send Message") return null;

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
    if (status === "connected") {
      // Same dropdown chrome as Gmail's oauth accounts list, so a connected
      // bot-style app (Telegram) doesn't look like a second-class integration
      // -- just with one account and "Reconnect" in place of "Add account",
      // since a single Rizly account only ever links one Telegram chat.
      return (
        <Field label="Account" required>
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={`flex h-12 w-full items-center gap-2.5 rounded-xl border bg-white px-3 text-left transition ${
                open ? "border-[#6C4BF4]" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <AccountAvatar label={name} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-slate-900">{name}</span>
              <SelectChevrons className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
            {open && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25)]">
                <div className="flex w-full items-center gap-2.5 rounded-lg bg-[#6C4BF4]/8 px-2.5 py-2 text-left">
                  <AccountAvatar label={name} />
                  <span className="min-w-0 flex-1 truncate text-[14px] text-slate-900">{name}</span>
                  <CheckGlyph className="h-4 w-4 shrink-0 text-[#6C4BF4]" />
                </div>
                <div className="my-1 h-px bg-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setDialogOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400">
                    <PlusGlyph />
                  </span>
                  <span className="text-[14px] font-medium text-[#6C4BF4]">Reconnect / switch chat</span>
                </button>
              </div>
            )}
          </div>
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

  if (method === "slack_bot") {
    if (status === "loading") {
      return (
        <Field label="Account" required>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-400">
            Checking connection…
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
              {name}
            </span>
            <Link href="/dashboard/slack" className="text-[13px] font-medium text-slate-500 underline hover:text-slate-700">
              Manage
            </Link>
          </div>
          <p className="mt-2 text-[12px] text-emerald-700">Connected. Ready to use in this step.</p>
        </Field>
      );
    }
    return (
      <Field label="Account" required>
        <Link
          href="/dashboard/slack"
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:border-slate-300"
        >
          <span className="text-[14px] text-slate-400">Connect {name}</span>
          <span className="rounded-md bg-[#6C4BF4] px-3.5 py-1.5 text-[13px] font-medium text-white">Connect</span>
        </Link>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
          {name} connects through the &quot;Add to Slack&quot; install flow on its own dashboard page, not a plain OAuth sign-in.
        </p>
      </Field>
    );
  }

  // ── Discord: same dropdown chrome as the oauth branch, but backed by the
  // servers the bot's installed into instead of a generic connectors list —
  // resolved right here in the dialog, never bouncing out to another page.
  if (method === "discord_bot") {
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
            <span className="text-[14px] text-slate-400">No server connected</span>
            {discordInstallUrl ? (
              <a
                href={discordInstallUrl}
                className="rounded-lg bg-[#6C4BF4] px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm shadow-[#6C4BF4]/25 transition hover:brightness-105"
              >
                Add to Discord
              </a>
            ) : (
              <span className="text-[13px] text-slate-400">Loading…</span>
            )}
          </div>
          <p className="mt-2.5 text-[12px] leading-relaxed text-slate-400">
            Installs the Rizly bot into a server you pick on Discord, then brings you right back here.
          </p>
        </Field>
      );
    }
    const selectedId = value && accounts.some((a) => a.id === value) ? value : accounts[0].id;
    const selectedAcc = accounts.find((a) => a.id === selectedId) ?? accounts[0];
    return (
      <Field label="Server" required>
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`flex h-12 w-full items-center gap-2.5 rounded-xl border bg-white px-3 text-left transition ${
              open ? "border-[#6C4BF4]" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <AccountAvatar label={selectedAcc.label} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-slate-900">{selectedAcc.label}</span>
            <SelectChevrons className="h-4 w-4 shrink-0 text-slate-400" />
          </button>

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
                    <AccountAvatar label={a.label} />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-slate-900">{a.label}</span>
                    {isSel && <CheckGlyph className="h-4 w-4 shrink-0 text-[#6C4BF4]" />}
                  </button>
                );
              })}
              <div className="my-1 h-px bg-slate-100" />
              {discordInstallUrl && (
                <a
                  href={discordInstallUrl}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400">
                    <PlusGlyph />
                  </span>
                  <span className="text-[14px] font-medium text-[#6C4BF4]">Add another server</span>
                </a>
              )}
            </div>
          )}
        </div>
        <p className="mt-2.5 text-[12px] leading-relaxed text-slate-400">
          Pick which channel below — this just narrows it to one server&apos;s channels.
        </p>
      </Field>
    );
  }

  if (method === "secret") {
    // "Secret"-method apps never had their connected state checked here before
    // -- `status` above is only ever set for "bot" (Telegram), so this branch
    // always rendered "Connect" regardless of whether the app was genuinely
    // connected. Use the accounts list (already fetched by refresh() for every
    // non-bot method) as the real source of truth instead.
    if (accounts === null) {
      return (
        <Field label="Account" required>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-400">
            Checking connection…
          </div>
        </Field>
      );
    }
    // Deep-links straight to this app's setup dialog on the connectors page
    // (?setup=) and back to this exact automation once saved (?returnTo=) --
    // same round-trip the oauth branch above gets from /api/connectors/[provider]/start.
    const connectorsHref = `/dashboard/connectors?setup=${encodeURIComponent(app)}&returnTo=${encodeURIComponent(returnTo)}`;
    if (accounts.length > 0) {
      const acc = accounts[0];
      return (
        <Field label="Account" required>
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <span className="flex items-center gap-2 text-[14px] text-emerald-800">
              <CheckGlyph className="h-4 w-4 text-emerald-600" />
              {acc.label}
            </span>
            <Link href="/dashboard/connectors" className="text-[13px] font-medium text-slate-500 underline hover:text-slate-700">
              Manage
            </Link>
          </div>
          <p className="mt-2 text-[12px] text-emerald-700">Connected. Ready to use in this step.</p>
        </Field>
      );
    }
    const secretKind = app === "postgres" ? "a connection string" : "an API key";
    return (
      <Field label="Account" required>
        <Link
          href={connectorsHref}
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

// Per-trigger variable hints shown under downstream message fields, so users
// know what {{field}} placeholders are actually available from that trigger
// instead of guessing. Keep in sync with the payload each trigger's poll
// branch in SchedulerService actually builds.
const TRIGGER_VARIABLE_HINTS: Record<string, string> = {
  calcom: "{{title}}, {{attendeeName}}, {{attendeeEmail}}, {{startTime}}",
  gmail: "{{from}}, {{subject}}",
};

function AutomationConfigFields({
  app,
  kind,
  title,
  config,
  onChange,
  triggerApp,
}: {
  app: string;
  kind: AutomationStep["kind"];
  title?: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  triggerApp?: string;
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

  if (app === "calcom") {
    const attendeeEmail = typeof config.attendeeEmail === "string" ? config.attendeeEmail : "";
    return (
      <>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-500">
          Checks your Cal.com account for bookings matching this event, every poll.
        </div>
        <Field label="Attendee email (optional)">
          <input
            value={attendeeEmail}
            onChange={(e) => set({ attendeeEmail: e.target.value })}
            placeholder="name@example.com — leave blank to match every booking"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
          <p className="mt-2 text-[12px] text-slate-400">
            Optional filter — only fires for bookings with this attendee. Leave blank to match every booking.
          </p>
        </Field>
      </>
    );
  }

  if (app === "slack") {
    // "New Message Posted to Channel" is the only Slack trigger that takes a
    // channel — the workspace-wide ones (New Mention / New Reaction Added)
    // have an empty config and must fall through to the message branch below
    // rendering nothing, not a channel picker they'd ignore.
    if (kind === "trigger") {
      if (title !== "New Message Posted to Channel") return null;
      return (
        <Field label="Channel" required>
          <SlackChannelPicker
            channelId={typeof config.channelId === "string" ? config.channelId : ""}
            onSelect={(channelId, channelName) => set({ channelId, channelName })}
          />
          <p className="mt-2 text-[12px] text-slate-400">
            Fires when a new message is posted in this channel of your linked workspace.
          </p>
        </Field>
      );
    }

    if (title === "Send Channel Message") {
      const hint = TRIGGER_VARIABLE_HINTS[triggerApp ?? ""];
      return (
        <>
          <Field label="Channel" required>
            <SlackChannelPicker
              channelId={typeof config.channelId === "string" ? config.channelId : ""}
              onSelect={(channelId, channelName) => set({ channelId, channelName })}
            />
            <p className="mt-2 text-[12px] text-slate-400">
              Rizly posts to public channels without being invited. Private channels still need the bot added.
            </p>
          </Field>
          <Field label="Message" required>
            <textarea
              value={typeof config.message === "string" ? config.message : ""}
              onChange={(e) => set({ message: e.target.value })}
              rows={4}
              placeholder={hint ? `Use variables like ${hint}` : "e.g. New email from {{from}}: {{subject}}"}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
            />
            <p className="mt-2 text-[12px] text-slate-400">
              Use <code className="rounded bg-slate-100 px-1 py-0.5">{"{{field}}"}</code> to insert data from the trigger.
            </p>
          </Field>
        </>
      );
    }
    // "Send Direct Message" falls through to the shared DM branch below.
  }

  if (app === "slack" || app === "telegram") {
    const hint = TRIGGER_VARIABLE_HINTS[triggerApp ?? ""];
    return (
      <Field label="Message" required>
        <textarea
          value={typeof config.message === "string" ? config.message : ""}
          onChange={(e) => set({ message: e.target.value })}
          rows={4}
          placeholder={hint ? `Use variables like ${hint}` : "e.g. New email from {{from}}: {{subject}}"}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
        />
        <p className="mt-2 text-[12px] text-slate-400">
          Sent to your linked {appName(app)} {app === "slack" ? "DM" : "chat"}. Use <code className="rounded bg-slate-100 px-1 py-0.5">{"{{field}}"}</code> to
          insert data from the trigger{hint ? <> — available here: <code className="rounded bg-slate-100 px-1 py-0.5">{hint}</code></> : <> (e.g. <code className="rounded bg-slate-100 px-1 py-0.5">{"{{subject}}"}</code>)</>}.
        </p>
      </Field>
    );
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
      <AirtableConfigFields
        baseId={typeof config.baseId === "string" ? config.baseId : ""}
        table={typeof config.table === "string" ? config.table : ""}
        onSelectBase={(baseId) => set({ baseId, table: "" })}
        onSelectTable={(table) => set({ table })}
      >
        {!isTrigger && (
          <Field label="Fields (JSON)" required>
            <textarea
              value={typeof config.fields === "string" ? config.fields : ""}
              onChange={(e) => set({ fields: e.target.value })}
              rows={4}
              placeholder={'{ "Name": "{{from}}", "Status": "New" }'}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[13px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
            />
          </Field>
        )}
      </AirtableConfigFields>
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
    const guildId = typeof config.account === "string" ? config.account : undefined;
    if (kind === "trigger") {
      return (
        <Field label="Channel" required>
          <DiscordChannelPicker
            guildId={guildId}
            channelId={typeof config.channelId === "string" ? config.channelId : ""}
            onSelect={(channelId, channelName) => set({ channelId, channelName })}
          />
          <p className="mt-2 text-[12px] text-slate-400">
            Fires when a new message is posted in this channel, in one of your own connected servers.
          </p>
        </Field>
      );
    }

    if (title === "Send Channel Message") {
      return (
        <>
          <Field label="Channel" required>
            <DiscordChannelPicker
              guildId={guildId}
              channelId={typeof config.channelId === "string" ? config.channelId : ""}
              onSelect={(channelId, channelName) => set({ channelId, channelName })}
            />
            <p className="mt-2 text-[12px] text-slate-400">
              Narrowed to the server selected above. Use &quot;Add another server&quot; there to connect more.
            </p>
          </Field>
          <Field label="Message" required>
            <textarea
              value={typeof config.message === "string" ? config.message : ""}
              onChange={(e) => set({ message: e.target.value })}
              rows={4}
              placeholder="e.g. New email from {{from}}: {{subject}}"
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
            />
            <p className="mt-2 text-[12px] text-slate-400">
              Use <code className="rounded bg-slate-100 px-1 py-0.5">{"{{field}}"}</code> to insert data from the trigger.
            </p>
          </Field>
        </>
      );
    }

    // "Send Message" — a DM, either to yourself or to another Discord user by id.
    const target = config.target === "user" ? "user" : "self";
    return (
      <>
        <Field label="Send to">
          <select
            value={target}
            onChange={(e) => set({ target: e.target.value === "user" ? "user" : "self" })}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
          >
            <option value="self">Myself (the account you linked)</option>
            <option value="user">A specific Discord user</option>
          </select>
        </Field>
        {target === "user" && (
          <Field label="Discord user ID" required>
            <input
              value={typeof config.targetUserId === "string" ? config.targetUserId : ""}
              onChange={(e) => set({ targetUserId: e.target.value })}
              placeholder="e.g. 123456789012345678"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
            />
            <p className="mt-2 text-[12px] text-slate-400">
              The numeric Discord user ID (right-click their name in Discord with Developer Mode on → Copy User ID).
              The Rizly bot must share a server with them to DM them.
            </p>
          </Field>
        )}
        <Field label="Message" required>
          <textarea
            value={typeof config.message === "string" ? config.message : ""}
            onChange={(e) => set({ message: e.target.value })}
            rows={4}
            placeholder="e.g. New email from {{from}}: {{subject}}"
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
          />
          <p className="mt-2 text-[12px] text-slate-400">
            Use <code className="rounded bg-slate-100 px-1 py-0.5">{"{{field}}"}</code> to insert data from the trigger.
          </p>
        </Field>
      </>
    );
  }

  if (app === "dropbox" && (title === "New File in Folder" || title === "New or Updated File in Folder")) {
    return (
      <Field label="Folder path" required>
        <input
          value={typeof config.folderPath === "string" ? config.folderPath : ""}
          onChange={(e) => set({ folderPath: e.target.value })}
          placeholder="/Projects/Reports"
          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
        />
        <p className="mt-2 text-[12px] text-slate-400">
          Matches this folder and everything inside it — e.g. /Projects/Reports.
        </p>
      </Field>
    );
  }

  if (app === "github") {
    if (kind === "trigger") {
      return (
        <GitHubRepoConfigFields
          repo={typeof config.repo === "string" ? config.repo : ""}
          branch={typeof config.branch === "string" ? config.branch : ""}
          showBranch={title === "New Push"}
          onSelectRepo={(repo) => set({ repo })}
          onSelectBranch={(branch) => set({ branch })}
        />
      );
    }
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

type GitHubRepo = { fullName: string; private: boolean };

/** Repo picker for every GitHub trigger, with an optional branch picker (only "New Push" needs one — GitHub defaults to the repo's default branch otherwise). */
function GitHubRepoConfigFields({
  repo,
  branch,
  showBranch,
  onSelectRepo,
  onSelectBranch,
}: {
  repo: string;
  branch: string;
  showBranch: boolean;
  onSelectRepo: (repo: string) => void;
  onSelectBranch: (branch: string) => void;
}) {
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [branches, setBranches] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/automations/github-repos")
      .then((r) => r.json())
      .then((data: { connected?: boolean; repos?: GitHubRepo[] }) => {
        if (cancelled) return;
        if (!data.connected) {
          setError("GitHub isn't connected yet.");
          return;
        }
        setRepos(data.repos ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load GitHub repositories");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showBranch || !repo) {
      setBranches(null);
      return;
    }
    let cancelled = false;
    setBranches(null);
    fetch(`/api/automations/github-branches?repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((data: { connected?: boolean; branches?: string[] }) => {
        if (cancelled) return;
        setBranches(data.connected ? (data.branches ?? []) : []);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [repo, showBranch]);

  if (error) {
    return <p className="text-[12px] text-red-500">{error}</p>;
  }

  return (
    <>
      <Field label="Repository" required>
        {repos === null ? (
          <p className="text-[13px] text-slate-400">Loading repositories…</p>
        ) : (
          <select
            value={repo}
            onChange={(e) => onSelectRepo(e.target.value)}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
          >
            <option value="" disabled>
              {repos.length === 0 ? "No repositories found" : "Choose a repository"}
            </option>
            {repos.map((r) => (
              <option key={r.fullName} value={r.fullName}>
                {r.fullName}
              </option>
            ))}
          </select>
        )}
      </Field>
      {showBranch && (
        <Field label="Branch">
          {!repo ? (
            <p className="text-[13px] text-slate-400">Pick a repository first.</p>
          ) : branches === null ? (
            <p className="text-[13px] text-slate-400">Loading branches…</p>
          ) : (
            <select
              value={branch}
              onChange={(e) => onSelectBranch(e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
            >
              <option value="">Default branch</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
    </>
  );
}

type AirtableBase = { id: string; name: string };
type AirtableField = { id: string; name: string; type: string };
type AirtableTable = { id: string; name: string; fields: AirtableField[] };

/** Base + table pickers shared by the "New Record" trigger and "Create Record" action, plus a field-name hint for the latter's Fields JSON (passed as children). */
function AirtableConfigFields({
  baseId,
  table,
  onSelectBase,
  onSelectTable,
  children,
}: {
  baseId: string;
  table: string;
  onSelectBase: (baseId: string) => void;
  onSelectTable: (table: string) => void;
  children?: ReactNode;
}) {
  const [bases, setBases] = useState<AirtableBase[] | null>(null);
  const [tables, setTables] = useState<AirtableTable[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/automations/airtable-bases")
      .then((r) => r.json())
      .then((data: { connected?: boolean; bases?: AirtableBase[]; error?: string }) => {
        if (cancelled) return;
        if (!data.connected) {
          setError("Airtable isn't connected yet.");
          return;
        }
        if (data.error) {
          setError(
            data.error === "airtable_invalid_credentials"
              ? "Airtable rejected the connection — reconnect it above to grant base access."
              : `Couldn't load Airtable bases (${data.error}).`,
          );
          return;
        }
        setBases(data.bases ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load Airtable bases");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!baseId) {
      setTables(null);
      return;
    }
    let cancelled = false;
    setTables(null);
    fetch(`/api/automations/airtable-tables?baseId=${encodeURIComponent(baseId)}`)
      .then((r) => r.json())
      .then((data: { connected?: boolean; tables?: AirtableTable[] }) => {
        if (cancelled) return;
        setTables(data.connected ? (data.tables ?? []) : []);
      })
      .catch(() => {
        if (!cancelled) setTables([]);
      });
    return () => {
      cancelled = true;
    };
  }, [baseId]);

  const selectedTable = tables?.find((t) => t.name === table || t.id === table);

  if (error) {
    return <p className="text-[12px] text-red-500">{error}</p>;
  }

  return (
    <>
      <Field label="Base" required>
        {bases === null ? (
          <p className="text-[13px] text-slate-400">Loading bases…</p>
        ) : (
          <select
            value={baseId}
            onChange={(e) => onSelectBase(e.target.value)}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
          >
            <option value="" disabled>
              {bases.length === 0 ? "No bases found" : "Choose a base"}
            </option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Table" required>
        {!baseId ? (
          <p className="text-[13px] text-slate-400">Pick a base first.</p>
        ) : tables === null ? (
          <p className="text-[13px] text-slate-400">Loading tables…</p>
        ) : (
          <select
            value={selectedTable?.name ?? ""}
            onChange={(e) => onSelectTable(e.target.value)}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
          >
            <option value="" disabled>
              {tables.length === 0 ? "No tables found" : "Choose a table"}
            </option>
            {tables.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      {children}
      {selectedTable && selectedTable.fields.length > 0 && (
        <p className="text-[12px] text-slate-400">
          Fields in {selectedTable.name}:{" "}
          {selectedTable.fields.map((f, i) => (
            <span key={f.id}>
              <code className="rounded bg-slate-100 px-1 py-0.5">{f.name}</code>
              {i < selectedTable.fields.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}
    </>
  );
}

type DiscordGuildChannels = {
  guildId: string;
  guildName: string;
  channels: Array<{ channelId: string; name: string }>;
};

/** Native grouped <select> — a searchable combobox is overkill for what's usually a handful of channels. */
function DiscordChannelPicker({
  guildId,
  channelId,
  onSelect,
}: {
  guildId?: string;
  channelId: string;
  onSelect: (channelId: string, channelName: string) => void;
}) {
  const [allGuilds, setAllGuilds] = useState<DiscordGuildChannels[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/discord/channels")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        if (Array.isArray(data)) setAllGuilds(data as DiscordGuildChannels[]);
        else setError("Could not load Discord channels");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load Discord channels");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-[12px] text-red-500">{error}</p>;
  }

  if (!allGuilds) {
    return <p className="text-[13px] text-slate-400">Loading channels…</p>;
  }

  // Narrow to the server picked in the "Server" field above, if any.
  const guilds = guildId ? allGuilds.filter((g) => g.guildId === guildId) : allGuilds;

  if (guilds.length === 0 || guilds.every((g) => g.channels.length === 0)) {
    return (
      <p className="text-[13px] text-slate-400">
        No channels yet — use &quot;Add another server&quot; above to install the bot somewhere first.
      </p>
    );
  }

  return (
    <select
      value={channelId}
      onChange={(e) => {
        const selected = e.target.value;
        const name = guilds.flatMap((g) => g.channels).find((c) => c.channelId === selected)?.name ?? "";
        onSelect(selected, name);
      }}
      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
    >
      <option value="" disabled>
        Choose a channel
      </option>
      {guilds.map((guild) =>
        guild.channels.length === 0 ? null : (
          <optgroup key={guild.guildId} label={guild.guildName}>
            {guild.channels.map((c) => (
              <option key={c.channelId} value={c.channelId}>
                #{c.name}
              </option>
            ))}
          </optgroup>
        ),
      )}
    </select>
  );
}

/** Slack's channel picker. Flat, unlike Discord's — a Rizly account links exactly one Slack workspace, so there's no server tier to group by. */
function SlackChannelPicker({
  channelId,
  onSelect,
}: {
  channelId: string;
  onSelect: (channelId: string, channelName: string) => void;
}) {
  const [channels, setChannels] = useState<Array<{ channelId: string; name: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/slack/channels")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        if (Array.isArray(data)) setChannels(data as Array<{ channelId: string; name: string }>);
        else setError("Could not load Slack channels");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load Slack channels");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-[12px] text-red-500">{error}</p>;
  }

  if (!channels) {
    return <p className="text-[13px] text-slate-400">Loading channels…</p>;
  }

  if (channels.length === 0) {
    // Most often an older install predating the channels:read scope — the
    // workspace has to go through "Add to Slack" again before this fills in.
    return (
      <p className="text-[13px] text-slate-400">
        No channels found — reconnect Slack from the Slack page to grant channel access.
      </p>
    );
  }

  return (
    <select
      value={channelId}
      onChange={(e) => {
        const selected = e.target.value;
        const name = channels.find((c) => c.channelId === selected)?.name ?? "";
        onSelect(selected, name);
      }}
      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-[#6C4BF4]"
    >
      <option value="" disabled>
        Choose a channel
      </option>
      {channels.map((c) => (
        <option key={c.channelId} value={c.channelId}>
          #{c.name}
        </option>
      ))}
    </select>
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
