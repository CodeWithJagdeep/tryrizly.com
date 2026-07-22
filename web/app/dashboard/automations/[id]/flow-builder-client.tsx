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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalComIcon,
  CalendarIcon,
  DiscordIcon,
  GitHubIcon,
  GmailIcon,
  MongoDbIcon,
  NotionIcon,
  PayPalIcon,
  PostgresIcon,
  RazorpayIcon,
  SlackIcon,
  StripeIcon,
  TelegramIcon,
} from "../../../components/ConnectorIcons";
import { ClockIcon, PlugIcon } from "../../components/icons";
import {
  type AutomationFlow,
  type AutomationStep,
  getFlow,
  newStepId,
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
  color?: string;
  category?: string;
};

// The 9 flagship apps have hand-written events and real SVG logos.
const DETAILED_APPS: AppDef[] = [
  {
    id: "gmail",
    name: "Gmail",
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
    triggers: [{ name: "New Message", description: "Triggers when a new message is received by your bot.", kind: "Instant" }],
    actions: [
      { name: "Notify Me", description: "Sends you a Telegram notification.", kind: "Action" },
      { name: "Send Message", description: "Sends a message to a chat or user.", kind: "Action" },
    ],
  },
  {
    id: "github",
    name: "GitHub",
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
    triggers: [{ name: "New Row", description: "Triggers when a new row is added to a table.", kind: "Polling" }],
    actions: [
      { name: "Run a Query", description: "Runs a raw SQL query.", kind: "Action" },
      { name: "Insert Row", description: "Inserts a new row into a table.", kind: "Action" },
    ],
  },
  {
    id: "schedule",
    name: "Schedule",
    triggers: [
      { name: "Every Day", description: "Triggers every day at a time you choose.", kind: "Polling" },
      { name: "Every Hour", description: "Triggers once every hour.", kind: "Polling" },
      { name: "Every Week", description: "Triggers on the days of the week you choose.", kind: "Polling" },
    ],
    actions: [],
  },
];

// ── Extended app directory (Zapier-scale) ─────────────────────────────────────
// The rest of the catalog is generated: each app is tagged with a category, and
// the category supplies a believable set of triggers/actions. Icons fall back to
// a colored monogram tile (see AppIcon). Descriptions are templated per app.

type EventTpl = { name: string; kind: EventKind; desc: (app: string) => string };

const CATEGORY_EVENTS: Record<string, { triggers: EventTpl[]; actions: EventTpl[] }> = {
  Communication: {
    triggers: [
      { name: "New Message", kind: "Instant", desc: (a) => `Triggers when a new message is posted in ${a}.` },
      { name: "New Mention", kind: "Instant", desc: (a) => `Triggers when you are mentioned in ${a}.` },
    ],
    actions: [
      { name: "Send Message", kind: "Action", desc: (a) => `Sends a message in ${a}.` },
      { name: "Send Direct Message", kind: "Action", desc: (a) => `Sends a direct message via ${a}.` },
    ],
  },
  CRM: {
    triggers: [
      { name: "New Contact", kind: "Polling", desc: (a) => `Triggers when a new contact is created in ${a}.` },
      { name: "New Deal", kind: "Polling", desc: (a) => `Triggers when a new deal is added in ${a}.` },
      { name: "Updated Deal Stage", kind: "Polling", desc: (a) => `Triggers when a deal changes stage in ${a}.` },
    ],
    actions: [
      { name: "Create Contact", kind: "Action", desc: (a) => `Creates a new contact in ${a}.` },
      { name: "Update Contact", kind: "Action", desc: (a) => `Updates an existing contact in ${a}.` },
      { name: "Create Deal", kind: "Action", desc: (a) => `Creates a new deal in ${a}.` },
    ],
  },
  "Email Marketing": {
    triggers: [
      { name: "New Subscriber", kind: "Polling", desc: (a) => `Triggers when someone subscribes in ${a}.` },
      { name: "New Campaign Sent", kind: "Polling", desc: (a) => `Triggers when a campaign is sent from ${a}.` },
    ],
    actions: [
      { name: "Add Subscriber", kind: "Action", desc: (a) => `Adds a subscriber to a list in ${a}.` },
      { name: "Send Campaign", kind: "Action", desc: (a) => `Sends a campaign via ${a}.` },
      { name: "Add Tag", kind: "Action", desc: (a) => `Tags a subscriber in ${a}.` },
    ],
  },
  Email: {
    triggers: [{ name: "New Email", kind: "Polling", desc: (a) => `Triggers when a new email arrives in ${a}.` }],
    actions: [
      { name: "Send Email", kind: "Action", desc: (a) => `Sends an email from ${a}.` },
      { name: "Create Draft", kind: "Action", desc: (a) => `Creates a draft in ${a}.` },
    ],
  },
  Payments: {
    triggers: [
      { name: "New Payment", kind: "Instant", desc: (a) => `Triggers when a payment succeeds in ${a}.` },
      { name: "New Refund", kind: "Instant", desc: (a) => `Triggers when a refund is issued in ${a}.` },
      { name: "Failed Payment", kind: "Instant", desc: (a) => `Triggers when a payment fails in ${a}.` },
    ],
    actions: [
      { name: "Create Customer", kind: "Action", desc: (a) => `Creates a customer in ${a}.` },
      { name: "Create Invoice", kind: "Action", desc: (a) => `Creates an invoice in ${a}.` },
    ],
  },
  "Project Management": {
    triggers: [
      { name: "New Task", kind: "Polling", desc: (a) => `Triggers when a new task is created in ${a}.` },
      { name: "Task Completed", kind: "Polling", desc: (a) => `Triggers when a task is marked complete in ${a}.` },
    ],
    actions: [
      { name: "Create Task", kind: "Action", desc: (a) => `Creates a task in ${a}.` },
      { name: "Update Task", kind: "Action", desc: (a) => `Updates a task in ${a}.` },
      { name: "Add Comment", kind: "Action", desc: (a) => `Adds a comment to a task in ${a}.` },
    ],
  },
  "Forms & Surveys": {
    triggers: [{ name: "New Submission", kind: "Instant", desc: (a) => `Triggers on a new form submission in ${a}.` }],
    actions: [{ name: "Create Entry", kind: "Action", desc: (a) => `Creates an entry in ${a}.` }],
  },
  Databases: {
    triggers: [
      { name: "New Row", kind: "Polling", desc: (a) => `Triggers when a new row is added in ${a}.` },
      { name: "Updated Row", kind: "Polling", desc: (a) => `Triggers when a row is updated in ${a}.` },
    ],
    actions: [
      { name: "Create Row", kind: "Action", desc: (a) => `Creates a new row in ${a}.` },
      { name: "Update Row", kind: "Action", desc: (a) => `Updates a row in ${a}.` },
      { name: "Find Row", kind: "Action", desc: (a) => `Finds a row in ${a}.` },
    ],
  },
  "File Storage": {
    triggers: [{ name: "New File", kind: "Polling", desc: (a) => `Triggers when a new file is added in ${a}.` }],
    actions: [
      { name: "Upload File", kind: "Action", desc: (a) => `Uploads a file to ${a}.` },
      { name: "Create Folder", kind: "Action", desc: (a) => `Creates a folder in ${a}.` },
    ],
  },
  "Social Media": {
    triggers: [
      { name: "New Post", kind: "Polling", desc: (a) => `Triggers when a new post is published on ${a}.` },
      { name: "New Follower", kind: "Polling", desc: (a) => `Triggers when you gain a follower on ${a}.` },
    ],
    actions: [{ name: "Create Post", kind: "Action", desc: (a) => `Publishes a post to ${a}.` }],
  },
  "Developer Tools": {
    triggers: [
      { name: "New Event", kind: "Instant", desc: (a) => `Triggers on a new event in ${a}.` },
      { name: "New Deployment", kind: "Instant", desc: (a) => `Triggers when a deployment finishes in ${a}.` },
    ],
    actions: [
      { name: "Create Item", kind: "Action", desc: (a) => `Creates an item in ${a}.` },
      { name: "Trigger Build", kind: "Action", desc: (a) => `Triggers a build in ${a}.` },
    ],
  },
  Support: {
    triggers: [
      { name: "New Ticket", kind: "Instant", desc: (a) => `Triggers when a new ticket is created in ${a}.` },
      { name: "Ticket Updated", kind: "Instant", desc: (a) => `Triggers when a ticket is updated in ${a}.` },
    ],
    actions: [
      { name: "Create Ticket", kind: "Action", desc: (a) => `Creates a ticket in ${a}.` },
      { name: "Add Reply", kind: "Action", desc: (a) => `Adds a reply to a ticket in ${a}.` },
    ],
  },
  Scheduling: {
    triggers: [{ name: "New Booking", kind: "Instant", desc: (a) => `Triggers when a new booking is made in ${a}.` }],
    actions: [{ name: "Create Booking", kind: "Action", desc: (a) => `Creates a booking in ${a}.` }],
  },
  eCommerce: {
    triggers: [
      { name: "New Order", kind: "Instant", desc: (a) => `Triggers when a new order is placed in ${a}.` },
      { name: "New Customer", kind: "Polling", desc: (a) => `Triggers when a new customer signs up in ${a}.` },
    ],
    actions: [
      { name: "Create Order", kind: "Action", desc: (a) => `Creates an order in ${a}.` },
      { name: "Update Inventory", kind: "Action", desc: (a) => `Updates inventory in ${a}.` },
    ],
  },
  AI: {
    triggers: [],
    actions: [
      { name: "Generate Text", kind: "Action", desc: (a) => `Generates text with ${a}.` },
      { name: "Summarize", kind: "Action", desc: (a) => `Summarizes content with ${a}.` },
      { name: "Classify", kind: "Action", desc: (a) => `Classifies content with ${a}.` },
    ],
  },
  Productivity: {
    triggers: [{ name: "New Item", kind: "Polling", desc: (a) => `Triggers when a new item is created in ${a}.` }],
    actions: [
      { name: "Create Item", kind: "Action", desc: (a) => `Creates an item in ${a}.` },
      { name: "Update Item", kind: "Action", desc: (a) => `Updates an item in ${a}.` },
    ],
  },
  Analytics: {
    triggers: [{ name: "New Event Tracked", kind: "Polling", desc: (a) => `Triggers when a new event is tracked in ${a}.` }],
    actions: [{ name: "Track Event", kind: "Action", desc: (a) => `Sends an event to ${a}.` }],
  },
};

// [id, name, category, brand color]
const CATALOG: [string, string, string, string][] = [
  // Communication
  ["msteams", "Microsoft Teams", "Communication", "#5059C9"],
  ["discord", "Discord", "Communication", "#5865F2"],
  ["zoom", "Zoom", "Communication", "#2D8CFF"],
  ["google-chat", "Google Chat", "Communication", "#00897B"],
  ["twilio", "Twilio", "Communication", "#F22F46"],
  ["whatsapp", "WhatsApp", "Communication", "#25D366"],
  ["intercom", "Intercom", "Communication", "#1F8DED"],
  ["front", "Front", "Communication", "#A857F8"],
  ["ringcentral", "RingCentral", "Communication", "#FF7A00"],
  // CRM
  ["salesforce", "Salesforce", "CRM", "#00A1E0"],
  ["hubspot", "HubSpot", "CRM", "#FF7A59"],
  ["pipedrive", "Pipedrive", "CRM", "#017737"],
  ["zoho-crm", "Zoho CRM", "CRM", "#E42527"],
  ["copper", "Copper", "CRM", "#FF6F61"],
  ["close", "Close", "CRM", "#101828"],
  ["freshsales", "Freshsales", "CRM", "#22B573"],
  ["attio", "Attio", "CRM", "#4E5BF2"],
  ["keap", "Keap", "CRM", "#4CAF50"],
  // Email Marketing
  ["mailchimp", "Mailchimp", "Email Marketing", "#FFE01B"],
  ["sendgrid", "SendGrid", "Email Marketing", "#1A82E2"],
  ["klaviyo", "Klaviyo", "Email Marketing", "#111827"],
  ["activecampaign", "ActiveCampaign", "Email Marketing", "#356AE6"],
  ["convertkit", "ConvertKit", "Email Marketing", "#FB6970"],
  ["brevo", "Brevo", "Email Marketing", "#0B996E"],
  ["constant-contact", "Constant Contact", "Email Marketing", "#1856ED"],
  ["customerio", "Customer.io", "Email Marketing", "#7131FF"],
  ["mailgun", "Mailgun", "Email Marketing", "#C02126"],
  // Email
  ["outlook", "Microsoft Outlook", "Email", "#0078D4"],
  ["yahoo-mail", "Yahoo Mail", "Email", "#6001D2"],
  ["imap", "Email by Rizly", "Email", "#6C4BF4"],
  // Payments
  ["paypal", "PayPal", "Payments", "#003087"],
  ["square", "Square", "Payments", "#3E4348"],
  ["razorpay", "Razorpay", "Payments", "#0C2451"],
  ["chargebee", "Chargebee", "Payments", "#FF7846"],
  ["paddle", "Paddle", "Payments", "#0B0A28"],
  ["quickbooks", "QuickBooks", "Payments", "#2CA01C"],
  ["xero", "Xero", "Payments", "#13B5EA"],
  ["wise", "Wise", "Payments", "#9FE870"],
  // Project Management
  ["asana", "Asana", "Project Management", "#F06A6A"],
  ["trello", "Trello", "Project Management", "#0079BF"],
  ["jira", "Jira", "Project Management", "#0052CC"],
  ["clickup", "ClickUp", "Project Management", "#7B68EE"],
  ["monday", "monday.com", "Project Management", "#FF3D57"],
  ["basecamp", "Basecamp", "Project Management", "#1D2D35"],
  ["linear", "Linear", "Project Management", "#5E6AD2"],
  ["todoist", "Todoist", "Project Management", "#E44332"],
  ["wrike", "Wrike", "Project Management", "#08CF65"],
  ["height", "Height", "Project Management", "#5C4DFF"],
  ["shortcut", "Shortcut", "Project Management", "#5B4CFF"],
  // Forms & Surveys
  ["typeform", "Typeform", "Forms & Surveys", "#262627"],
  ["google-forms", "Google Forms", "Forms & Surveys", "#7248B9"],
  ["jotform", "Jotform", "Forms & Surveys", "#FF6100"],
  ["gravity-forms", "Gravity Forms", "Forms & Surveys", "#134DA5"],
  ["surveymonkey", "SurveyMonkey", "Forms & Surveys", "#00BF6F"],
  ["tally", "Tally", "Forms & Surveys", "#101010"],
  ["formstack", "Formstack", "Forms & Surveys", "#21B573"],
  // Databases
  ["airtable", "Airtable", "Databases", "#18BFFF"],
  ["mysql", "MySQL", "Databases", "#00758F"],
  ["mongodb", "MongoDB", "Databases", "#47A248"],
  ["google-sheets", "Google Sheets", "Databases", "#0F9D58"],
  ["excel", "Microsoft Excel", "Databases", "#217346"],
  ["coda", "Coda", "Databases", "#F46A54"],
  ["baserow", "Baserow", "Databases", "#5190EF"],
  ["supabase", "Supabase", "Databases", "#3ECF8E"],
  // File Storage
  ["google-drive", "Google Drive", "File Storage", "#1FA463"],
  ["dropbox", "Dropbox", "File Storage", "#0061FF"],
  ["box", "Box", "File Storage", "#0061D5"],
  ["onedrive", "OneDrive", "File Storage", "#0364B8"],
  ["s3", "AWS S3", "File Storage", "#569A31"],
  // Social Media
  ["twitter", "X (Twitter)", "Social Media", "#000000"],
  ["linkedin", "LinkedIn", "Social Media", "#0A66C2"],
  ["facebook-pages", "Facebook Pages", "Social Media", "#1877F2"],
  ["instagram", "Instagram", "Social Media", "#E4405F"],
  ["youtube", "YouTube", "Social Media", "#FF0000"],
  ["reddit", "Reddit", "Social Media", "#FF4500"],
  ["buffer", "Buffer", "Social Media", "#231F20"],
  ["tiktok", "TikTok", "Social Media", "#010101"],
  ["pinterest", "Pinterest", "Social Media", "#E60023"],
  // Developer Tools
  ["gitlab", "GitLab", "Developer Tools", "#FC6D26"],
  ["bitbucket", "Bitbucket", "Developer Tools", "#0052CC"],
  ["vercel", "Vercel", "Developer Tools", "#000000"],
  ["netlify", "Netlify", "Developer Tools", "#00C7B7"],
  ["circleci", "CircleCI", "Developer Tools", "#343434"],
  ["sentry", "Sentry", "Developer Tools", "#362D59"],
  ["pagerduty", "PagerDuty", "Developer Tools", "#06AC38"],
  ["datadog", "Datadog", "Developer Tools", "#632CA6"],
  ["dockerhub", "Docker Hub", "Developer Tools", "#2496ED"],
  // Support
  ["zendesk", "Zendesk", "Support", "#03363D"],
  ["freshdesk", "Freshdesk", "Support", "#25C16F"],
  ["helpscout", "Help Scout", "Support", "#1292EE"],
  ["gorgias", "Gorgias", "Support", "#2C2C2C"],
  // Scheduling
  ["calendly", "Calendly", "Scheduling", "#006BFF"],
  ["calcom", "Cal.com", "Scheduling", "#111827"],
  ["outlook-calendar", "Outlook Calendar", "Scheduling", "#0078D4"],
  ["acuity", "Acuity Scheduling", "Scheduling", "#5B4E9E"],
  // eCommerce
  ["shopify", "Shopify", "eCommerce", "#95BF47"],
  ["woocommerce", "WooCommerce", "eCommerce", "#96588A"],
  ["bigcommerce", "BigCommerce", "eCommerce", "#121118"],
  ["magento", "Magento", "eCommerce", "#EE672F"],
  ["etsy", "Etsy", "eCommerce", "#F45800"],
  ["squarespace", "Squarespace", "eCommerce", "#000000"],
  // AI
  ["openai", "OpenAI", "AI", "#10A37F"],
  ["anthropic", "Anthropic Claude", "AI", "#D4A27F"],
  ["gemini", "Google Gemini", "AI", "#1A73E8"],
  ["huggingface", "Hugging Face", "AI", "#FFD21E"],
  ["perplexity", "Perplexity", "AI", "#1FB8CD"],
  // Productivity
  ["google-docs", "Google Docs", "Productivity", "#4285F4"],
  ["confluence", "Confluence", "Productivity", "#172B4D"],
  ["evernote", "Evernote", "Productivity", "#00A82D"],
  ["miro", "Miro", "Productivity", "#FFD02F"],
  ["loom", "Loom", "Productivity", "#625DF5"],
  ["clickup-docs", "Coda Docs", "Productivity", "#F46A54"],
  // Analytics
  ["google-analytics", "Google Analytics", "Analytics", "#E37400"],
  ["mixpanel", "Mixpanel", "Analytics", "#7856FF"],
  ["amplitude", "Amplitude", "Analytics", "#1E61F0"],
  ["segment", "Segment", "Analytics", "#52BD94"],
];

function generatedApps(): AppDef[] {
  const taken = new Set(DETAILED_APPS.map((a) => a.id));
  return CATALOG.filter(([id]) => !taken.has(id)).map(([id, name, category, color]) => {
    const tpl = CATEGORY_EVENTS[category] ?? CATEGORY_EVENTS.Productivity;
    const expand = (list: EventTpl[]): AppEvent[] =>
      list.map((e) => ({ name: e.name, kind: e.kind, description: e.desc(name) }));
    return { id, name, category, color, triggers: expand(tpl.triggers), actions: expand(tpl.actions) };
  });
}

const APPS: AppDef[] = [...DETAILED_APPS, ...generatedApps()];

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
};

// Two-letter monogram for apps without a bundled logo: first letters of the
// first two words, else the first two characters.
function monogram(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase();
}

function AppIcon({ app, className }: { app: string; className?: string }) {
  const Icon = APP_ICONS[app];
  if (Icon) return <Icon className={className} />;
  if (app === "schedule") return <ClockIcon className={className} />;
  const def = appDef(app);
  if (def?.color) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[5px] font-bold leading-none text-white ${className ?? ""}`}
        style={{ backgroundColor: def.color, fontSize: "9px", letterSpacing: "-0.5px" }}
        aria-label={def.name}
      >
        {monogram(def.name)}
      </span>
    );
  }
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
  if (appId === "schedule") return "none"; // built-in, no account
  if (appId === "stripe" || appId === "postgres") return "secret";
  // Databases and AI models connect with a connection string / API key.
  const cat = appDef(appId)?.category;
  if (cat === "Databases" || cat === "AI" || cat === "Analytics") return "secret";
  // Everything else is OAuth "Sign in".
  return "oauth";
}

// ── Demo seed ─────────────────────────────────────────────────────────────────
// A long, realistic "inbound lead → onboarding" pipeline used when a flow id
// isn't in localStorage yet (e.g. a shared/deep-linked builder URL). Every step
// maps to a real catalog event so the config panel stays consistent.

const DEMO_FLOW_NAME = "Inbound lead → onboarding pipeline";

const DEMO_STEPS: { kind: AutomationStep["kind"]; app: string; title: string }[] = [
  { kind: "trigger", app: "gmail", title: "New Email Matching Search" }, // to sales@
  { kind: "action", app: "postgres", title: "Run a Query" }, // does this lead already exist?
  { kind: "action", app: "notion", title: "Create Page" }, // new lead record in CRM
  { kind: "action", app: "slack", title: "Send Channel Message" }, // announce in #sales
  { kind: "action", app: "telegram", title: "Notify Me" }, // ping the founder
  { kind: "action", app: "gmail", title: "Send Email" }, // instant welcome reply
  { kind: "action", app: "calendar", title: "Find Availability" }, // open intro-call slots
  { kind: "action", app: "calendar", title: "Create Detailed Event" }, // book the intro call
  { kind: "action", app: "gmail", title: "Create Draft" }, // follow-up draft for later
  { kind: "action", app: "stripe", title: "Create Customer" }, // provision billing profile
  { kind: "action", app: "stripe", title: "Create Invoice" }, // draft proposal invoice
  { kind: "action", app: "notion", title: "Update Page" }, // move stage → Proposal
  { kind: "action", app: "slack", title: "Send Direct Message" }, // notify account owner
  { kind: "action", app: "postgres", title: "Insert Row" }, // log the activity
  { kind: "action", app: "github", title: "Create Issue" }, // onboarding checklist task
];

function buildDemoSteps(): AutomationStep[] {
  return DEMO_STEPS.map((s) => ({
    id: newStepId(),
    kind: s.kind,
    title: s.title,
    subtitle: appName(s.app),
    app: s.app,
  }));
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
          {hasEvent ? step.title : isTrigger ? "Select the event" : "Select the event for your Zap to run"}
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

const nodeTypes = { step: StepNode, adder: AdderNode };
const edgeTypes = { insert: InsertEdge };

// ── Builder ────────────────────────────────────────────────────────────────────

function Builder({ flowId }: { flowId: string }) {
  const rf = useReactFlow();
  const [name, setName] = useState("Untitled Zap");
  const [steps, setSteps] = useState<AutomationStep[]>([]);
  const [saved, setSaved] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const flow = getFlow(flowId);
    // Seed the demo when the id isn't saved yet, OR when it's still the pristine
    // default (every step untitled and app-less) — so a deep-linked builder URL
    // always lands on the long pipeline instead of an empty canvas.
    const isPristine = flow ? flow.steps.every((s) => !s.title && !s.app) : true;
    if (flow && !isPristine) {
      setName(flow.name);
      setSteps(flow.steps);
      setSelectedId(flow.steps[0]?.id ?? null);
    } else {
      const demo = buildDemoSteps();
      setName(DEMO_FLOW_NAME);
      setSteps(demo);
      setSelectedId(demo[0]?.id ?? null);
    }
  }, [flowId]);

  const insertStep = useCallback((index: number) => {
    const step: AutomationStep = { id: newStepId(), kind: "action", title: "", subtitle: "", app: "" };
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

  const built = useMemo(() => {
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

  function handleSave() {
    const flow: AutomationFlow = {
      id: flowId,
      name: name.trim() || "Untitled Zap",
      steps: steps.map((s) => ({ ...s, subtitle: appName(s.app) })),
      updatedAt: new Date().toISOString(),
    };
    saveFlow(flow);
    setSaved(true);
  }

  function loadDemo() {
    const demo = buildDemoSteps();
    setName(DEMO_FLOW_NAME);
    setSteps(demo);
    setSelectedId(demo[0]?.id ?? null);
    setSaved(false);
  }

  const selectedStep = steps.find((s) => s.id === selectedId) ?? null;
  const selectedIndex = steps.findIndex((s) => s.id === selectedId);

  return (
    <main className="fixed inset-0 z-50 flex overflow-hidden bg-[#faf9f7] text-slate-900">
      {/* Far-left icon rail */}
      <LeftRail />

      {/* Everything right of the rail */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top chrome row 1 */}
        <TopBar name={name} setName={setName} setSaved={setSaved} />

        {/* Top chrome row 2 */}
        <SubBar saved={saved} onSave={handleSave} onLoadSample={loadDemo} />

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

          {/* Copilot banner */}
          <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="flex items-center gap-2 text-[13px] text-slate-700">
              <CopilotGlyph className="h-4 w-4 text-[#FF4F00]" />
              Copilot can fully configure your workflow
            </span>
            <button
              type="button"
              onClick={loadDemo}
              className="rounded-md bg-[#6C4BF4] px-2.5 py-1 text-[13px] font-medium text-white transition hover:brightness-105"
            >
              Build it
            </button>
            <button type="button" className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Bottom-left mini toolbar */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <button type="button" className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <LibraryGlyph className="h-4 w-4 text-slate-500" />
              Library
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1 shadow-sm">
              {[GridGlyph, BoltGlyph, BranchGlyph, SearchGlyph].map((G, i) => (
                <span key={i} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">
                  <G className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>

          {/* Bottom-right chat bubble */}
          <button type="button" className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#2b2440] text-white shadow-lg hover:brightness-110">
            <ChatGlyph className="h-5 w-5" />
          </button>

          {/* Version tag */}
          <p className="pointer-events-none absolute bottom-1 right-4 text-[10px] text-slate-400">ver. v2026-07-20t23:05-46fc7b76</p>

          {/* Config panel (floating, overlays the right edge) */}
          {selectedStep && (
            <div className="absolute inset-x-2 bottom-2 top-2 sm:inset-y-3 sm:left-auto sm:right-3 sm:w-[min(420px,calc(100vw-1.5rem))]">
              <ConfigPanel
                key={selectedStep.id}
                step={selectedStep}
                index={selectedIndex}
                onPatch={(patch) => patchStep(selectedStep.id, patch)}
                onClose={() => setSelectedId(null)}
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

function LeftRail() {
  return (
    <div className="flex w-14 shrink-0 flex-col items-center border-r border-slate-200 bg-[#f1f0ec] py-3">
      <Link href="/dashboard" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2b2440] text-white" title="Home">
        <HomeGlyph className="h-4 w-4" />
      </Link>
      <div className="mt-4 flex flex-col items-center gap-3">
        {[GridGlyph, DocGlyph, ChatGlyph, CalGlyph, ClockGlyph, FlowGlyph, GearGlyph, DrawerGlyph].map((G, i) => (
          <span key={i} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-600">
            <G className="h-[18px] w-[18px]" />
          </span>
        ))}
      </div>
      <span className="mt-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#FF4F00]/10 text-[#FF4F00]">
        <TargetGlyph className="h-4 w-4" />
      </span>
    </div>
  );
}

// ── Top bar (row 1) ─────────────────────────────────────────────────────────────

function TopBar({
  name,
  setName,
  setSaved,
}: {
  name: string;
  setName: (v: string) => void;
  setSaved: (v: boolean) => void;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-[#faf9f7] px-3">
      {/* Left cluster */}
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60">
          <GridGlyph className="h-[18px] w-[18px]" />
        </span>
        <BoltGlyph className="h-5 w-5 text-[#FF4F00]" />
        <span className="text-[15px] font-semibold text-slate-800">Zaps</span>
      </div>

      {/* Center cluster */}
      <div className="flex items-center gap-2 text-[13px] text-slate-600">
        <FolderGlyph className="h-4 w-4 text-slate-400" />
        <span className="max-w-[130px] truncate">Jagdeep Sing…</span>
        <span className="text-slate-300">/</span>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6C4BF4] text-[10px] font-semibold text-white">J</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          className="w-[110px] bg-transparent text-[14px] font-medium text-slate-800 outline-none focus:underline"
        />
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">Draft</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-4 text-[13px] text-slate-600">
        <span className="flex items-center gap-1">82% <ChevronDown className="h-3.5 w-3.5 text-slate-400" /></span>
        <span className="flex items-center gap-1">
          <HelpGlyph className="h-4 w-4 text-slate-400" /> Help <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </span>
      </div>
    </div>
  );
}

// ── Sub bar (row 2) ─────────────────────────────────────────────────────────────

function SubBar({ saved, onSave, onLoadSample }: { saved: boolean; onSave: () => void; onLoadSample: () => void }) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 bg-[#faf9f7] px-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[13px] text-slate-500">
          <SearchGlyph className="h-4 w-4 text-slate-400" />
          Search
          <kbd className="rounded bg-slate-100 px-1 text-[11px] text-slate-400">Ctrl</kbd>
          <kbd className="rounded bg-slate-100 px-1 text-[11px] text-slate-400">⇧</kbd>
          <kbd className="rounded bg-slate-100 px-1 text-[11px] text-slate-400">F</kbd>
          <span className="ml-1 flex h-4 w-7 items-center rounded-full bg-slate-200 px-0.5">
            <span className="h-3 w-3 rounded-full bg-white shadow" />
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onLoadSample}
          title="Replace the canvas with a sample 15-step pipeline"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[13px] text-slate-600 hover:bg-slate-50"
        >
          <CopilotGlyph className="h-4 w-4 text-[#FF4F00]" />
          Load sample
        </button>
        <button type="button" className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[13px] text-slate-600 hover:bg-slate-50">
          <UndoGlyph className="h-4 w-4 text-slate-400" />
          Undo
        </button>
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
          <HistoryGlyph className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
        >
          <PlayGlyph className="h-4 w-4" />
          {saved ? "Test run" : "Save & test"}
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rounded-lg bg-[#eadfc8] px-4 py-1.5 text-[13px] font-medium text-[#8a7a52] hover:brightness-105"
        >
          Publish
        </button>
      </div>
    </div>
  );
}

// ── Config panel ────────────────────────────────────────────────────────────────

function ConfigPanel({
  step,
  index,
  onPatch,
  onClose,
}: {
  step: AutomationStep;
  index: number;
  onPatch: (patch: Partial<AutomationStep>) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"setup" | "test">("setup");
  const [changingApp, setChangingApp] = useState(!step.app);
  const [appQuery, setAppQuery] = useState("");
  const isTrigger = step.kind === "trigger";
  const def = appDef(step.app);
  const events = def ? (isTrigger ? def.triggers : def.actions) : [];
  const eventLabel = isTrigger ? "Trigger event" : "Action event";
  const aq = appQuery.trim().toLowerCase();
  const relevantApps = APPS.filter((a) => (isTrigger ? a.triggers.length : a.actions.length))
    .filter((a) => !aq || a.name.toLowerCase().includes(aq) || (a.category ?? "").toLowerCase().includes(aq));

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-xl border-2 border-[#6C4BF4] bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <AppIcon app={step.app} className="h-5 w-5 shrink-0" />
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900">
          {index + 1}. {step.title || "Select the event"}
        </p>
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Rename">
          <PencilGlyph className="h-4 w-4" />
        </button>
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Expand">
          <ExpandGlyph className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4">
        <button
          type="button"
          onClick={() => setTab("setup")}
          className={`-mb-px flex items-center gap-1.5 border-b-2 py-2.5 text-[14px] font-medium transition ${
            tab === "setup" ? "border-[#6C4BF4] text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Setup <CircleGlyph className="h-3.5 w-3.5 text-slate-300" />
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <button
          type="button"
          onClick={() => setTab("test")}
          className={`-mb-px flex items-center gap-1.5 border-b-2 py-2.5 text-[14px] font-medium transition ${
            tab === "test" ? "border-[#6C4BF4] text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Test <ClockGlyph className="h-3.5 w-3.5 text-slate-300" />
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {tab === "test" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-[14px] font-medium text-slate-700">Nothing to test yet</p>
            <p className="max-w-[240px] text-[13px] text-slate-400">Finish the setup, then testing will replay this step against your connected account.</p>
          </div>
        ) : changingApp ? (
          <div>
            <p className="mb-1 text-[14px] font-semibold text-slate-800">Choose an app</p>
            <p className="mb-3 text-[12px] text-slate-400">
              {isTrigger ? "This app's event will start the automation." : "This app will run when the automation fires."}
            </p>
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5">
              <SearchGlyph className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={appQuery}
                onChange={(e) => setAppQuery(e.target.value)}
                autoFocus
                placeholder={`Search ${APPS.length}+ apps`}
                className="h-9 w-full bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 outline-none"
              />
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {relevantApps.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-slate-400">No apps match &ldquo;{appQuery}&rdquo;</p>
              ) : (
                relevantApps.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      if (a.id !== step.app) onPatch({ app: a.id, title: "", subtitle: a.name });
                      setChangingApp(false);
                    }}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                      a.id === step.app ? "border-[#6C4BF4] bg-[#6C4BF4]/5" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-slate-200">
                      <AppIcon app={a.id} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-slate-900">{a.name}</span>
                      {a.category && <span className="block truncate text-[11px] text-slate-400">{a.category}</span>}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* App */}
            <Field label="App" required>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <span className="flex items-center gap-2">
                  <AppIcon app={step.app} className="h-[18px] w-[18px]" />
                  <span className="text-[14px] text-slate-900">{appName(step.app)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setChangingApp(true)}
                  className="rounded-md bg-[#6C4BF4] px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:brightness-105"
                >
                  Change
                </button>
              </div>
            </Field>

            {/* Event */}
            <Field label={eventLabel} required>
              <EventPicker
                events={events}
                selected={step.title}
                onSelect={(name) => onPatch({ title: name })}
              />
            </Field>

            {/* Account — the connect UX differs by provider */}
            <AccountField app={step.app} />
          </div>
        )}
      </div>

      {/* Footer */}
      {tab === "setup" && !changingApp && (
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={onClose}
            disabled={!step.title}
            className="h-11 w-full rounded-lg text-[14px] font-medium transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 enabled:bg-[#6C4BF4] enabled:text-white enabled:hover:brightness-105"
          >
            {step.title ? "Continue" : "To continue, choose an event"}
          </button>
        </div>
      )}
    </aside>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
        {label} {required && <span className="text-[#6C4BF4]">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Account field (connect UX varies by provider) ─────────────────────────────

function AccountField({ app }: { app: string }) {
  const method = connectMethod(app);
  const name = appName(app);
  // Demo-only connection state (no backend yet): idle → connecting → connected.
  const [connected, setConnected] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (method === "none") {
    return (
      <Field label="Account">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-500">
          No account needed — this runs on Rizly&apos;s built-in schedule.
        </div>
      </Field>
    );
  }

  if (connected) {
    return (
      <Field label="Account" required>
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <span className="flex items-center gap-2 text-[14px] text-emerald-800">
            <CheckGlyph className="h-4 w-4 text-emerald-600" />
            {method === "bot" ? `${name} · @rizly_bot` : `${name} account`}
          </span>
          <button
            type="button"
            onClick={() => setConnected(false)}
            className="text-[13px] font-medium text-slate-500 underline hover:text-slate-700"
          >
            Disconnect
          </button>
        </div>
        <p className="mt-2 text-[12px] text-emerald-700">Connected (demo). Ready to use in this step.</p>
      </Field>
    );
  }

  if (method === "bot") {
    // Telegram isn't OAuth: you open the Rizly bot and message it. Demo dialog
    // simulates the deep-link / QR + link-status polling handshake.
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
              setConnected(true);
              setDialogOpen(false);
            }}
          />
        )}
      </Field>
    );
  }

  if (method === "secret") {
    const isDb = app === "postgres";
    return (
      <Field label="Account" required>
        <input
          type="password"
          placeholder={isDb ? "postgresql://user:password@host:5432/db" : `${name} API key (sk_live_…)`}
          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#6C4BF4]"
        />
        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
          {name} connects with {isDb ? "a connection string" : "an API key"}, not sign-in.{" "}
          <span className="text-[#6C4BF4] underline">Your credentials are encrypted and can be removed at any time</span>.
        </p>
      </Field>
    );
  }

  // OAuth default (demo: click "Sign in" → connected)
  return (
    <Field label="Account" required>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        <span className="text-[14px] text-slate-400">Connect {name}</span>
        <button
          type="button"
          onClick={() => setConnected(true)}
          className="rounded-md bg-[#6C4BF4] px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:brightness-105"
        >
          Sign in
        </button>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
        {name} is a secure partner with Rizly.{" "}
        <span className="text-[#6C4BF4] underline">Your credentials are encrypted and can be removed at any time</span>. You can{" "}
        <span className="text-[#6C4BF4] underline">manage all of your connected accounts here</span>.
      </p>
    </Field>
  );
}

// ── Telegram connect dialog (demo: simulates QR → message bot → linked) ────────

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
  // Demo deep link + one-time token (would come from POST /api/onboarding/telegram/token).
  const [token, setToken] = useState("demo");
  useEffect(() => {
    setToken(Math.random().toString(36).slice(2, 10));
  }, []);
  const deepLink = `https://t.me/rizly_bot?start=${token}`;

  // Auto-advance to "done" a moment after "linking" begins (simulated poll).
  useEffect(() => {
    if (status !== "linking") return;
    const t = setTimeout(() => {
      setStatus("done");
      setTimeout(onConnected, 700);
    }, 1400);
    return () => clearTimeout(t);
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
                <FakeQr seed={token} className={`h-[200px] w-[200px] rounded-xl border border-slate-200 p-3 ${status === "linking" ? "opacity-40" : ""}`} />
                {status === "linking" && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#6C4BF4]" />
                  </span>
                )}
              </div>

              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setStatus("linking")}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#6C4BF4] px-4 py-2.5 text-[14px] font-medium text-white transition hover:brightness-105"
              >
                <AppIcon app="telegram" className="h-4 w-4 [&_*]:fill-white" />
                Open {appName}
              </a>

              <p className="mt-3 text-center text-[12px] leading-relaxed text-slate-500">
                {status === "linking"
                  ? "Waiting for you to message the bot…"
                  : <>Scan the QR, or tap <b>Open {appName}</b>, then send <code className="rounded bg-slate-100 px-1 py-0.5">/start</code> to the bot.</>}
              </p>

              {/* Demo shortcut so the flow is testable without a real device */}
              <button
                type="button"
                onClick={() => setStatus("linking")}
                className="mt-4 text-[12px] font-medium text-[#6C4BF4] underline"
              >
                Simulate messaging the bot (demo)
              </button>
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
  onSelect,
}: {
  events: AppEvent[];
  selected: string;
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
          <div role="listbox" className="min-h-0 flex-1 overflow-y-auto pb-1">
            {ordered.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-slate-400">No matching events</p>
            ) : (
              ordered.map((ev) => {
                const isSel = ev.name === selected;
                const isPinned = pinned.has(ev.name);
                return (
                  <div
                    key={ev.name}
                    role="option"
                    aria-selected={isSel}
                    tabIndex={0}
                    onClick={() => {
                      onSelect(ev.name);
                      setOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(ev.name);
                        setOpen(false);
                      }
                    }}
                    className={`group cursor-pointer px-3 py-2 outline-none transition ${
                      isSel ? "bg-[#6C4BF4]/8" : "hover:bg-slate-50 focus:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-[#201515]">{ev.name}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#d5d7fc] px-1.5 py-0.5 text-[11px] font-medium text-[#413735]">
                          <KindGlyph kind={ev.kind} className="h-3 w-3" />
                          {ev.kind}
                        </span>
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
