"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConnectorLogo } from "../components/ConnectorLogo";
import {
  AirtableIcon,
  BambooHrIcon,
  BetterStackIcon,
  BoxIcon,
  CalComIcon,
  CalendarIcon,
  CalendlyIcon,
  DeelIcon,
  DiscordIcon,
  DropboxIcon,
  FigmaIcon,
  GitHubIcon,
  GmailIcon,
  GoogleDriveIcon,
  GumroadIcon,
  JiraIcon,
  LemonSqueezyIcon,
  MongoDbIcon,
  MpesaIcon,
  NotionIcon,
  PagerDutyIcon,
  PostgresIcon,
  QuickBooksIcon,
  RazorpayIcon,
  SlackIcon,
  StatuspageIcon,
  StripeIcon,
  TelegramIcon,
  TrelloIcon,
  TwilioIcon,
  TypeformIcon,
  UptimeRobotIcon,
  WiseIcon,
  XeroIcon,
} from "../components/ConnectorIcons";

type OnboardingState = {
  source?: string;
  googleConnected?: boolean;
  telegramLinked?: boolean;
  slackLinked?: boolean;
  profileCompleted?: boolean;
  completedAt?: string;
};

type ConnectorSummary = { provider: string; status: string };

type ConnectorField = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
};

type ConnectorItem = {
  provider: string;
  title: string;
  description: string;
  category: "Google" | "Scheduling" | "Payments" | "Databases" | "Team" | "APIs";
  authType: "oauth" | "manual";
  icon: React.ComponentType<{ className?: string }>;
  fields?: ConnectorField[];
  prompts: string[];
  website?: string;
  privacy?: string;
};

const CONNECTOR_CATALOG: ConnectorItem[] = [
  {
    provider: "gmail",
    title: "Gmail",
    description:
      "rizly watches your inbox, surfaces important emails, triages by priority, and drafts approved replies — all without you lifting a finger.",
    category: "Google",
    authType: "oauth",
    icon: GmailIcon,
    prompts: [
      "Find unread emails that need a reply and draft brief responses for each.",
      "Summarize investor and customer emails from this week.",
      "Which emails have payment or invoice details I should action?",
      "Flag any follow-ups I haven't replied to in the last 7 days.",
    ],
    website: "https://mail.google.com",
    privacy: "https://policies.google.com/privacy",
  },
  {
    provider: "calendar",
    title: "Google Calendar",
    description:
      "rizly checks your calendar for conflicts, creates and reschedules events with your approval, and sends reminders before meetings.",
    category: "Google",
    authType: "oauth",
    icon: CalendarIcon,
    prompts: [
      "What's on my calendar today and tomorrow?",
      "Find a free 1-hour slot this week for a team sync.",
      "Move my 3pm meeting to tomorrow morning and notify the attendee.",
      "Create a calendar event for Tuesday at 10am with Naman.",
    ],
    website: "https://calendar.google.com",
    privacy: "https://policies.google.com/privacy",
  },
  {
    provider: "google_workspace",
    title: "Google Drive, Sheets & Docs",
    description:
      "Upload files, append sheet rows, and create documents from an automation. A separate grant from Gmail/Calendar.",
    category: "Google",
    authType: "oauth",
    icon: GoogleDriveIcon,
    prompts: [
      "Create a new Google Doc summarizing this week's investor updates.",
      "Append today's signups to my tracking spreadsheet.",
      "Upload this report to my Drive folder.",
      "Find the sales spreadsheet and tell me the latest totals.",
    ],
    website: "https://drive.google.com",
    privacy: "https://policies.google.com/privacy",
  },
  {
    provider: "calcom",
    title: "Cal.com",
    description:
      "rizly views your bookings, creates meetings, and sends scheduling notifications through Cal.com.",
    category: "Scheduling",
    authType: "oauth",
    icon: CalComIcon,
    prompts: [
      "What meetings do I have booked through Cal.com this week?",
      "Create a 30-minute Cal.com booking link for tomorrow.",
      "Any new bookings I haven't confirmed yet?",
      "Cancel my 4pm Cal.com meeting and notify the attendee.",
    ],
    website: "https://cal.com",
    privacy: "https://cal.com/privacy",
  },
  {
    provider: "razorpay",
    title: "Razorpay",
    description:
      "Read-only revenue snapshots, failed payment alerts, and settlement checks — so you always know where your cash stands.",
    category: "Payments",
    authType: "manual",
    icon: RazorpayIcon,
    fields: [
      { name: "keyId", label: "Key ID", placeholder: "rzp_live_..." },
      { name: "keySecret", label: "Key Secret", type: "password" },
    ],
    prompts: [
      "What's my revenue this month vs last month?",
      "Show failed payments from the last 7 days.",
      "How much did we collect in settlements last week?",
      "List my top customers by payment amount.",
    ],
    website: "https://razorpay.com",
    privacy: "https://razorpay.com/privacy/",
  },
  {
    provider: "stripe",
    title: "Stripe",
    description:
      "Read-only subscription, MRR, invoices, and failed payment checks surfaced in your morning brief.",
    category: "Payments",
    authType: "oauth",
    icon: StripeIcon,
    // Manual fallback: a restricted secret key works for users who'd rather
    // not grant OAuth Connect access to their full account.
    fields: [
      { name: "secretKey", label: "Secret Key", type: "password", placeholder: "sk_live_..." },
      { name: "stripeAccountId", label: "Stripe Account ID (optional)", placeholder: "acct_...", required: false },
    ],
    prompts: [
      "What's our current MRR and how has it changed this month?",
      "Show subscriptions that churned this week.",
      "List overdue invoices and their amounts.",
      "How many new paying customers did we add today?",
    ],
    website: "https://stripe.com",
    privacy: "https://stripe.com/privacy",
  },
  {
    provider: "mpesa",
    title: "M-Pesa",
    description:
      "Safaricom Daraja business credentials — connection checks now, balance and transaction pulls coming next.",
    category: "Payments",
    authType: "manual",
    icon: MpesaIcon,
    fields: [
      { name: "consumerKey", label: "Consumer Key", type: "password" },
      { name: "consumerSecret", label: "Consumer Secret", type: "password" },
      { name: "shortcode", label: "Business Shortcode", placeholder: "e.g. 174379" },
      { name: "environment", label: "Environment", placeholder: "production or sandbox" },
    ],
    prompts: [
      "Did the M-Pesa connection check pass?",
      "What's our business shortcode set to?",
      "Confirm my Daraja credentials are still valid.",
      "Let me know when M-Pesa balance pulls are available.",
    ],
    website: "https://developer.safaricom.co.ke",
    privacy: "https://www.safaricom.co.ke/privacy-policy",
  },
  {
    provider: "github",
    title: "GitHub",
    description:
      "Open PRs, issues, and review requests involving you — briefed on demand so nothing sits waiting.",
    category: "Team",
    authType: "oauth",
    icon: GitHubIcon,
    prompts: [
      "What PRs are waiting on my review right now?",
      "Summarize open issues assigned to me.",
      "Any PRs I opened that have been sitting without comments?",
      "What merged into main today?",
    ],
    website: "https://github.com",
    privacy: "https://docs.github.com/en/site-policy/privacy-policies",
  },
  {
    provider: "jira",
    title: "Jira",
    description: "Search issues and create issues in a project from an automation.",
    category: "Team",
    authType: "oauth",
    icon: JiraIcon,
    // Manual fallback: an API token still works for users who'd rather not
    // grant OAuth access, or whose site isn't reachable via Atlassian OAuth.
    fields: [
      { name: "siteUrl", label: "Site URL (if OAuth doesn't work for your account)", placeholder: "https://yourteam.atlassian.net" },
      { name: "email", label: "Account Email", placeholder: "you@company.com" },
      { name: "apiToken", label: "API Token", type: "password", placeholder: "Create one at id.atlassian.com/manage-profile/security/api-tokens" },
    ],
    prompts: [
      "What Jira issues are still open and assigned to me?",
      "Create a Jira ticket for this bug report.",
      "Open an issue in the Engineering project for the deploy failure.",
      "Log a new task in Jira for the onboarding fix.",
    ],
    website: "https://www.atlassian.com/software/jira",
    privacy: "https://www.atlassian.com/legal/privacy-policy",
  },
  {
    provider: "trello",
    title: "Trello",
    description: "Create cards on a board from an automation.",
    category: "Team",
    authType: "manual",
    icon: TrelloIcon,
    fields: [
      { name: "apiKey", label: "API Key", placeholder: "From trello.com/app-key" },
      { name: "token", label: "Token", type: "password" },
    ],
    prompts: [
      "Add a card to my Trello board for this follow-up.",
      "Create a Trello card summarizing this request.",
      "Log this feedback as a card on the Bugs list.",
    ],
    website: "https://trello.com",
    privacy: "https://www.atlassian.com/legal/privacy-policy",
  },
  {
    provider: "pagerduty",
    title: "PagerDuty",
    description: "Open incidents on a service from an automation.",
    category: "APIs",
    authType: "manual",
    icon: PagerDutyIcon,
    fields: [
      { name: "apiKey", label: "API Key", type: "password", placeholder: "From PagerDuty's API Access Keys settings" },
      { name: "fromEmail", label: "From Email", placeholder: "A valid PagerDuty user's email — required by their API" },
    ],
    prompts: [
      "Open a PagerDuty incident for the API outage.",
      "Page the on-call engineer about this error spike.",
      "Create an incident for the failed deploy.",
    ],
    website: "https://www.pagerduty.com",
    privacy: "https://www.pagerduty.com/privacy-policy/",
  },
  {
    provider: "twilio",
    title: "Twilio",
    description: "Send SMS notifications from an automation.",
    category: "APIs",
    authType: "manual",
    icon: TwilioIcon,
    fields: [
      { name: "accountSid", label: "Account SID", placeholder: "AC..." },
      { name: "authToken", label: "Auth Token", type: "password" },
      { name: "fromNumber", label: "From Number", placeholder: "+15551234567" },
    ],
    prompts: [
      "Text me when a high-value payment fails.",
      "Send an SMS alert when a new lead comes in.",
      "Notify the team by text when the site goes down.",
    ],
    website: "https://www.twilio.com",
    privacy: "https://www.twilio.com/legal/privacy",
  },
  {
    provider: "airtable",
    title: "Airtable",
    description: "Create and poll records in a base from an automation.",
    category: "Databases",
    authType: "manual",
    icon: AirtableIcon,
    fields: [
      { name: "apiKey", label: "Personal Access Token", type: "password", placeholder: "pat..." },
    ],
    prompts: [
      "Add this lead to my Airtable CRM base.",
      "Check for new records added to my tracker today.",
      "Log this expense in my Airtable budget base.",
    ],
    website: "https://airtable.com",
    privacy: "https://www.airtable.com/privacy",
  },
  {
    provider: "postgres",
    title: "Postgres",
    description:
      "Read-only SQL queries for signups, errors, and business metrics. Permissions are verified before saving.",
    category: "Databases",
    authType: "manual",
    icon: PostgresIcon,
    fields: [
      {
        name: "connectionUrl",
        label: "Connection URL",
        type: "password",
        placeholder: "postgres://readonly:password@host:5432/db",
      },
    ],
    prompts: [
      "How many new users signed up today?",
      "Show error rates from the logs table over the last 24 hours.",
      "What's the daily active user count for the past 7 days?",
      "Find the top 10 users by session count this month.",
    ],
    website: "https://postgresql.org",
    privacy: "https://www.postgresql.org/about/policies/privacy/",
  },
  {
    provider: "mongodb",
    title: "MongoDB",
    description:
      "Restricted aggregate and find queries over your product database. Read-only access is verified before saving.",
    category: "Databases",
    authType: "manual",
    icon: MongoDbIcon,
    fields: [
      {
        name: "connectionUrl",
        label: "Connection URL",
        type: "password",
        placeholder: "mongodb+srv://readonly:password@cluster/db",
      },
    ],
    prompts: [
      "How many documents were created in the orders collection today?",
      "Show aggregate revenue by product category this month.",
      "Find users who haven't logged in for 30 days.",
      "What's the breakdown of users across plan types?",
    ],
    website: "https://mongodb.com",
    privacy: "https://www.mongodb.com/legal/privacy-policy",
  },
  {
    provider: "notion",
    title: "Notion",
    description: "Search pages, retrieve knowledge base content, and get context from your docs.",
    category: "Team",
    authType: "oauth",
    icon: NotionIcon,
    prompts: [
      "Find our onboarding doc in Notion and summarize it.",
      "Create a Notion page for today's meeting notes.",
      "What does our Notion say about the refund policy?",
    ],
    website: "https://www.notion.so",
    privacy: "https://www.notion.so/privacy",
  },
  {
    provider: "discord",
    title: "Discord",
    description: "Read a bot-accessible channel for updates and post approved messages through an optional webhook.",
    category: "Team",
    authType: "manual",
    icon: DiscordIcon,
    fields: [
      { name: "botToken", label: "Bot token", type: "password", placeholder: "Discord bot token" },
      { name: "channelId", label: "Channel ID", placeholder: "123456789012345678" },
      { name: "guildId", label: "Server ID (optional, enables message links)", placeholder: "123456789012345678", required: false },
      { name: "webhookUrl", label: "Channel webhook URL (optional, enables posting)", type: "password", placeholder: "https://discord.com/api/webhooks/...", required: false },
    ],
    prompts: [
      "Post a summary of today's standup to our Discord channel.",
      "What's been discussed in #general today?",
      "Notify the team on Discord when a new order comes in.",
    ],
    website: "https://discord.com",
    privacy: "https://discord.com/privacy",
  },
  {
    provider: "dropbox",
    title: "Dropbox",
    description: "Automations that fire when a file changes in your Dropbox.",
    category: "APIs",
    authType: "oauth",
    icon: DropboxIcon,
    prompts: [
      "Let me know when a new file lands in my shared folder.",
      "Notify me when the contract in Dropbox is updated.",
    ],
    website: "https://www.dropbox.com",
    privacy: "https://www.dropbox.com/privacy",
  },
  {
    provider: "figma",
    title: "Figma",
    description: "Automations that fire on a new file comment. Webhooks require a Figma Organization/Enterprise plan.",
    category: "Team",
    authType: "oauth",
    icon: FigmaIcon,
    prompts: [
      "Tell me when someone comments on the homepage design file.",
      "Notify the team when feedback lands on a Figma file.",
    ],
    website: "https://www.figma.com",
    privacy: "https://www.figma.com/privacy/",
  },
  {
    provider: "calendly",
    title: "Calendly",
    description: "Automations that fire when a booking is created or cancelled.",
    category: "Scheduling",
    authType: "oauth",
    icon: CalendlyIcon,
    fields: [
      { name: "apiToken", label: "Personal Access Token (if OAuth doesn't work for your account)", type: "password", placeholder: "From calendly.com/integrations/api_webhooks" },
    ],
    prompts: [
      "Let me know whenever someone books a call on my Calendly.",
      "Notify me if a Calendly meeting gets cancelled.",
    ],
    website: "https://calendly.com",
    privacy: "https://calendly.com/privacy",
  },
  {
    provider: "typeform",
    title: "Typeform",
    description: "Automations that fire on a new form submission.",
    category: "APIs",
    authType: "manual",
    icon: TypeformIcon,
    fields: [
      { name: "apiToken", label: "Personal Access Token", type: "password", placeholder: "From your Typeform account settings" },
      { name: "formId", label: "Form ID", placeholder: "The form to watch — required to register the webhook" },
    ],
    prompts: [
      "Notify me when someone submits my Typeform survey.",
      "Log new form responses to a spreadsheet.",
    ],
    website: "https://www.typeform.com",
    privacy: "https://www.typeform.com/legal/privacy/",
  },
  {
    provider: "gumroad",
    title: "Gumroad",
    description: "Automations that fire on a new sale. Add the ping URL manually — see setup note after connecting.",
    category: "Payments",
    authType: "manual",
    icon: GumroadIcon,
    fields: [
      { name: "accessToken", label: "Access Token", type: "password", placeholder: "From Gumroad Settings -> Advanced" },
    ],
    prompts: [
      "Let me know whenever I make a new sale on Gumroad.",
      "Notify the team when a product sells on Gumroad.",
    ],
    website: "https://gumroad.com",
    privacy: "https://gumroad.com/privacy",
  },
  {
    provider: "lemonsqueezy",
    title: "Lemon Squeezy",
    description: "Automations that fire on a new order.",
    category: "Payments",
    authType: "manual",
    icon: LemonSqueezyIcon,
    fields: [
      { name: "apiKey", label: "API Key", type: "password", placeholder: "From Settings -> API" },
      { name: "storeId", label: "Store ID", placeholder: "The store to watch — required to register the webhook" },
    ],
    prompts: [
      "Tell me when a new order comes in on Lemon Squeezy.",
      "Notify the team when someone subscribes.",
    ],
    website: "https://www.lemonsqueezy.com",
    privacy: "https://www.lemonsqueezy.com/privacy",
  },
  {
    provider: "uptimerobot",
    title: "UptimeRobot",
    description: "Automations that fire when a monitor goes up or down. Add a Web-Hook Alert Contact manually — see setup note after connecting.",
    category: "APIs",
    authType: "manual",
    icon: UptimeRobotIcon,
    fields: [
      { name: "apiKey", label: "API Key", type: "password", placeholder: "From My Settings -> API Settings" },
    ],
    prompts: [
      "Alert me the moment a monitor goes down.",
      "Let me know when my site comes back online.",
    ],
    website: "https://uptimerobot.com",
    privacy: "https://uptimerobot.com/privacy-policy/",
  },
  {
    provider: "quickbooks",
    title: "QuickBooks",
    description: "Automations that fire on a new invoice or a paid invoice. Requires a one-time app-level webhook subscription in the Intuit Developer dashboard.",
    category: "Payments",
    authType: "oauth",
    icon: QuickBooksIcon,
    prompts: [
      "Notify me when an invoice gets paid.",
      "Let me know when a new invoice is created in QuickBooks.",
    ],
    website: "https://quickbooks.intuit.com",
    privacy: "https://www.intuit.com/privacy/statement/",
  },
  {
    provider: "xero",
    title: "Xero",
    description: "Automations that fire when a new invoice is created.",
    category: "Payments",
    authType: "oauth",
    icon: XeroIcon,
    prompts: [
      "Tell me when a new invoice is created in Xero.",
      "Notify the team when a Xero invoice is overdue.",
    ],
    website: "https://www.xero.com",
    privacy: "https://www.xero.com/legal/privacy/",
  },
  {
    provider: "wise",
    title: "Wise",
    description: "Automations that fire when a new transaction credits your balance.",
    category: "Payments",
    authType: "manual",
    icon: WiseIcon,
    fields: [
      { name: "apiToken", label: "API Token", type: "password", placeholder: "From Wise Settings -> API tokens" },
      { name: "profileId", label: "Profile ID", placeholder: "The profile to watch — required to register the webhook" },
    ],
    prompts: [
      "Let me know when a payment lands in my Wise balance.",
      "Notify me of new Wise transactions over $500.",
    ],
    website: "https://wise.com",
    privacy: "https://wise.com/gb/privacy-policy/",
  },
  {
    provider: "bamboohr",
    title: "BambooHR",
    description: "Automations that fire on a new time-off request or a new hire. Polled — BambooHR has no webhook on standard API tiers.",
    category: "Team",
    authType: "manual",
    icon: BambooHrIcon,
    fields: [
      { name: "subdomain", label: "Subdomain", placeholder: "From https://<subdomain>.bamboohr.com" },
      { name: "apiKey", label: "API Key", type: "password", placeholder: "From your BambooHR account API keys" },
    ],
    prompts: [
      "Notify me when someone requests time off.",
      "Let me know when a new hire is added in BambooHR.",
    ],
    website: "https://www.bamboohr.com",
    privacy: "https://www.bamboohr.com/privacy-policy/",
  },
  {
    provider: "deel",
    title: "Deel",
    description: "Automations that fire on a new contract or a completed payment.",
    category: "Team",
    authType: "oauth",
    icon: DeelIcon,
    prompts: [
      "Tell me when a new contract is signed in Deel.",
      "Notify me when a contractor payment completes.",
    ],
    website: "https://www.deel.com",
    privacy: "https://www.deel.com/privacy-policy",
  },
  {
    provider: "box",
    title: "Box",
    description: "Automations that fire when a file is uploaded to a chosen Box folder.",
    category: "APIs",
    authType: "oauth",
    icon: BoxIcon,
    prompts: [
      "Let me know when a new file lands in our Box folder.",
      "Notify the team when a contract is uploaded to Box.",
    ],
    website: "https://www.box.com",
    privacy: "https://www.box.com/legal/privacypolicy",
  },
  {
    provider: "statuspage",
    title: "Statuspage",
    description: "Automations that fire on a new incident or an incident status update. Add the generated webhook URL as a subscriber on your page — see setup note after connecting.",
    category: "APIs",
    authType: "manual",
    icon: StatuspageIcon,
    fields: [
      { name: "pageId", label: "Page ID", placeholder: "From your Statuspage page settings" },
      { name: "apiKey", label: "API Key (optional, auto-subscribes the webhook)", type: "password", placeholder: "From Statuspage Account Settings -> API Info", required: false },
    ],
    prompts: [
      "Notify me when a new incident is posted on our status page.",
      "Alert the team when an incident is resolved.",
    ],
    website: "https://www.atlassian.com/software/statuspage",
    privacy: "https://www.atlassian.com/legal/privacy-policy",
  },
  {
    provider: "betterstack",
    title: "Better Stack",
    description: "Automations that fire when an incident starts or resolves. Add a webhook integration manually — see setup note after connecting.",
    category: "APIs",
    authType: "manual",
    icon: BetterStackIcon,
    fields: [
      { name: "apiKey", label: "API Key", type: "password", placeholder: "From Better Stack Settings -> API tokens" },
    ],
    prompts: [
      "Alert me the moment an incident starts.",
      "Let me know when a Better Stack incident resolves.",
    ],
    website: "https://betterstack.com",
    privacy: "https://betterstack.com/privacy",
  },
];

const CATEGORIES = ["Google", "Scheduling", "Payments", "Databases", "Team", "APIs"] as const;
const RECOMMENDED_CONNECTOR_PROVIDERS = new Set(["gmail", "calendar", "notion"]);
// Allow-list, mirroring ENABLED_CONNECTOR_PROVIDERS in
// dashboard/connectors/connectors-client.tsx — keep the two in sync, or a
// connector offered during onboarding won't exist on the connectors page.
// Slack/Telegram are deliberately absent here: they're linked as chat
// surfaces elsewhere in onboarding, not as connector cards.
const ENABLED_CONNECTOR_PROVIDERS = new Set([
  "gmail",
  "calendar",
  "google_workspace",
  "calcom",
  "razorpay",
  "github",
  "trello",
  "postgres",
  "mongodb",
  "notion",
  "discord",
  "figma",
  "calendly",
]);

const SOURCE_OPTIONS = ["Twitter / X", "LinkedIn", "Friend or colleague", "Search", "Other"];

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Guatemala",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Lagos",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function getTimezoneOptions(current: string): string[] {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : FALLBACK_TIMEZONES;
  return supported.includes(current) ? supported : [current, ...supported];
}

// ── Arrow-up-right icon for links ────────────────────────────────────────────
function ExternalIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

// ── Unified connector dialog (OAuth + manual) ────────────────────────────────
function ConnectorDialog({
  connector,
  error,
  submitting,
  onClose,
  onManualSubmit,
}: {
  connector: ConnectorItem;
  error: string | null;
  submitting: boolean;
  onClose: () => void;
  onManualSubmit: (e: FormEvent<HTMLFormElement>, c: ConnectorItem) => Promise<void>;
}) {
  const Icon = connector.icon;
  const isOAuth = connector.authType === "oauth";
  // Some OAuth connectors (e.g. Stripe) also carry a manual API-key fallback
  // for users who'd rather not grant OAuth access to their full account.
  const showManualFallback = Boolean(connector.fields?.length);
  const oauthHref = `/api/connectors/${connector.provider}/start?returnTo=/onboarding`;
  // Figma has no "list my teams" API and Box webhooks watch a single folder,
  // not the whole account — both need an id from the user before OAuth,
  // appended to the start URL (mirrors the dashboard connectors dialog).
  const isFigma = connector.provider === "figma";
  const [figmaTeamId, setFigmaTeamId] = useState("");
  const figmaOauthHref = `${oauthHref}&teamId=${encodeURIComponent(figmaTeamId.trim())}`;
  const isBox = connector.provider === "box";
  const [boxFolderId, setBoxFolderId] = useState("");
  const boxOauthHref = `${oauthHref}&folderId=${encodeURIComponent(boxFolderId.trim())}`;
  const requiresExtraField = isFigma || isBox;
  const extraFieldMissing = (isFigma && !figmaTeamId.trim()) || (isBox && !boxFolderId.trim());
  const resolvedOauthHref = isFigma ? figmaOauthHref : isBox ? boxOauthHref : oauthHref;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = `connector-dialog-${connector.provider}-title`;
  const descriptionId = `connector-dialog-${connector.provider}-description`;
  const accessLabel = isOAuth
    ? "Secure OAuth"
    : connector.category === "Databases"
      ? "Read-only access"
      : "Encrypted credentials";

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const connectionDetails = (
    <>
      <div className="rounded-2xl bg-slate-50 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-950">
                {isOAuth
                  ? connector.provider === "stripe"
                    ? "OAuth coming soon"
                    : `Continue securely with ${connector.title}`
                  : accessLabel}
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Secure
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-5 text-slate-500">
              {isOAuth
                ? connector.provider === "stripe"
                  ? "Use the API key option below for now — one-click OAuth is on the way."
                  : `You’ll go to ${connector.title} to review and approve access before anything is connected.`
                : connector.category === "Databases"
                  ? "Use a read-only connection. Rizly verifies the permissions before saving it."
                  : "Your credentials are encrypted at rest and used only to connect this account."}
            </p>
          </div>
        </div>

        {isOAuth && (
          connector.provider === "stripe" ? (
            <span
              aria-disabled="true"
              className="mt-4 inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 text-sm font-semibold text-slate-500"
            >
              Coming soon
            </span>
          ) : (
            <>
              {isFigma && (
                <div className="mt-4">
                  <label htmlFor="figma-team-id" className="mb-1.5 block text-xs font-medium text-slate-600">
                    Figma team ID
                  </label>
                  <input
                    id="figma-team-id"
                    type="text"
                    inputMode="numeric"
                    value={figmaTeamId}
                    onChange={(event) => setFigmaTeamId(event.target.value)}
                    placeholder="e.g. 123456789012345678"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-400"
                  />
                  <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                    Find this in your team&apos;s URL: figma.com/files/team/&lt;team id&gt;/... Webhooks (needed for
                    comment-triggered automations) only work on Organization/Enterprise Figma plans.
                  </p>
                </div>
              )}
              {isBox && (
                <div className="mt-4">
                  <label htmlFor="box-folder-id" className="mb-1.5 block text-xs font-medium text-slate-600">
                    Box folder ID
                  </label>
                  <input
                    id="box-folder-id"
                    type="text"
                    inputMode="numeric"
                    value={boxFolderId}
                    onChange={(event) => setBoxFolderId(event.target.value)}
                    placeholder="e.g. 123456789012"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-400"
                  />
                  <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                    Find this in the folder&apos;s URL: app.box.com/folder/&lt;folder id&gt;. Box webhooks watch one folder at a time, not your whole account.
                  </p>
                </div>
              )}
              <a
                href={resolvedOauthHref}
                aria-disabled={requiresExtraField && extraFieldMissing}
                onClick={(event) => {
                  if (requiresExtraField && extraFieldMissing) event.preventDefault();
                }}
                className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/50 ${
                  requiresExtraField && extraFieldMissing ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                Continue to {connector.title}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                </svg>
              </a>
            </>
          )
        )}
      </div>

      {(!isOAuth || showManualFallback) && connector.fields && (
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {isOAuth ? `Or connect with an API key instead` : "Connection details"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {isOAuth ? "Optional — skip this if you used the button above." : "All fields are required."}
              </p>
            </div>
            <span className="text-xs font-medium text-slate-400">Private</span>
          </div>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium leading-5 text-red-700">
              <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
              </svg>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {connector.fields.map((field) => (
              <label key={field.name} className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700">{field.label}</span>
                <input
                  name={field.name}
                  type={field.type ?? "text"}
                  placeholder={field.placeholder}
                  required={field.required !== false}
                  autoComplete="off"
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#D9BEF4] focus:ring-4 focus:ring-[#D9BEF4]/10"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-slate-950">What you can do after connecting</p>
        <ul className="mt-3 space-y-2.5">
          {connector.prompts.slice(0, 3).map((prompt) => (
            <li key={prompt} className="flex items-start gap-2.5 text-[13px] leading-5 text-slate-600">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#D9BEF4]/10 text-[#D96420]">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m2.5 6 2.2 2.2 4.8-4.8" />
                </svg>
              </span>
              {prompt}
            </li>
          ))}
        </ul>
      </div>
    </>
  );

  const dialogFooter = (
    <div className="border-t border-slate-200 bg-slate-50/70 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-4">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-center gap-3 sm:justify-start">
          {connector.website && (
            <a href={connector.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 underline-offset-4 transition hover:text-slate-950 hover:underline">
              Provider website <ExternalIcon />
            </a>
          )}
          {connector.privacy && (
            <a href={connector.privacy} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 underline-offset-4 transition hover:text-slate-950 hover:underline">
              Privacy <ExternalIcon />
            </a>
          )}
        </div>
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:w-auto">
          <button type="button" onClick={onClose} className="h-11 cursor-pointer rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40">
            Cancel
          </button>
          {(!isOAuth || showManualFallback) && (
            <button type="submit" disabled={submitting} className="inline-flex h-11 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/50 sm:px-5">
              {submitting ? (
                <>
                  <span className="sm:hidden">Checking…</span>
                  <span className="hidden sm:inline">Checking connection…</span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">Connect</span>
                  <span className="hidden sm:inline">{isOAuth ? `Connect with API key` : `Connect ${connector.title}`}</span>
                </>
              )}
              {!submitting && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const dialogBody = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="relative mb-0 mt-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-slate-200 bg-white shadow-[0_-20px_60px_-24px_rgba(15,23,42,0.5)] sm:m-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[620px] sm:rounded-[28px] sm:border-b sm:shadow-[0_28px_80px_-20px_rgba(15,23,42,0.45)]"
    >
      <div className="relative border-b border-slate-200 px-5 pb-5 pt-7 sm:px-6 sm:pb-6 sm:pt-6">
        <span className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300 sm:hidden" aria-hidden="true" />
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={`Close ${connector.title} connection dialog`}
          className="absolute right-4 top-4 flex size-9 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        <p className="pr-12 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#D96420]">Connect an integration</p>
        <div className="mt-4 flex items-start gap-4 pr-10">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <ConnectorLogo
              provider={connector.provider}
              alt={connector.title}
              className="size-7 object-contain"
              fallback={<Icon className="size-7" />}
            />
          </span>
          <div>
            <h2 id={titleId} className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-slate-950">
              Connect {connector.title}
            </h2>
            <p id={descriptionId} className="mt-1.5 max-w-[29rem] text-[13px] leading-5 text-slate-500">
            {connector.description}
            </p>
          </div>
        </div>
      </div>

      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void onManualSubmit(e, connector)}>
        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{connectionDetails}</div>
        {dialogFooter}
      </form>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-slate-950/55 p-0 backdrop-blur-[6px] sm:px-4 sm:py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {dialogBody}
    </div>
  );
}

// ── Lightweight dialog for surface extras (Telegram QR, Slack link command) ──
function SurfaceDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[6px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_28px_80px_-20px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

// ── Phone country codes (About-you step) ─────────────────────────────────────
const PHONE_COUNTRIES = [
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "AE", name: "UAE", dial: "+971", flag: "🇦🇪" },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { code: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { code: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽" },
  { code: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { code: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "IL", name: "Israel", dial: "+972", flag: "🇮🇱" },
  { code: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { code: "PL", name: "Poland", dial: "+48", flag: "🇵🇱" },
  { code: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
] as const;

// ── Step metadata (drives the progress stepper + eyebrows) ──────────────────
const STEP_META = [
  { eyebrow: "About you" },
  { eyebrow: "Welcome" },
  { eyebrow: "Preferences" },
  { eyebrow: "Integrations" },
  { eyebrow: "Your channel" },
] as const;

function BackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ── Progress stepper: segmented bar + counter + back affordance ──────────────
function ProgressHeader({ step, onBack }: { step: number; onBack: () => void }) {
  const total = STEP_META.length;
  return (
    <div>
      <div className="flex h-6 items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={onBack}
            className="group -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40"
          >
            <BackIcon />
            Back
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 tabular-nums">
          Step {step} <span className="text-slate-300">/ {total}</span>
        </span>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-black/40">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-500">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Extra search terms so a zone is findable by its modern/legacy name or country,
// regardless of which name the runtime's ICU lists (e.g. Calcutta vs Kolkata).
const TZ_SYNONYMS: Record<string, string> = {
  "asia/calcutta": "kolkata india mumbai delhi ist",
  "asia/kolkata": "calcutta india mumbai delhi ist",
  "asia/saigon": "ho chi minh vietnam",
  "asia/ho_chi_minh": "saigon vietnam",
  "asia/rangoon": "yangon myanmar",
  "asia/yangon": "rangoon myanmar",
  "asia/katmandu": "kathmandu nepal",
  "asia/kathmandu": "katmandu nepal",
  "europe/kiev": "kyiv ukraine",
  "europe/kyiv": "kiev ukraine",
  "america/godthab": "nuuk greenland",
  "america/nuuk": "godthab greenland",
};

function tzSearchString(tz: string): string {
  const extra = TZ_SYNONYMS[tz.toLowerCase()] ?? "";
  return `${tz.replace(/[_/]/g, " ")} ${extra}`.toLowerCase();
}

// ── Searchable timezone picker (type to filter the IANA list) ────────────────
function TimezoneCombobox({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (tz: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = (
    q ? options.filter((tz) => tzSearchString(tz).includes(q)) : options
  ).slice(0, 80);

  function pick(tz: string) {
    onChange(tz);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative mt-6">
      <div className="flex h-[52px] items-center gap-2 rounded-full border border-black/70 bg-white px-5 transition focus-within:border-[#D9BEF4]">
        <SearchIcon />
        <input
          value={open ? query : value}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          placeholder={open ? `Search — current: ${value}` : "Search your timezone…"}
          className="h-full w-full cursor-text bg-transparent text-base font-normal text-black outline-none placeholder:text-slate-400"
          aria-label="Timezone"
          autoComplete="off"
        />
      </div>

      {open && (
        <ul className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-2xl border border-black/70 bg-white shadow-xl">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">No timezone matches “{query}”.</li>
          ) : (
            filtered.map((tz) => {
              const selected = tz === value;
              return (
                <li key={tz}>
                  <button
                    type="button"
                    onClick={() => pick(tz)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      selected ? "bg-slate-950 text-white" : "text-black hover:bg-[#D9BEF4]/10"
                    }`}
                  >
                    <span>{tz.replace(/_/g, " ")}</span>
                    {selected && <CheckIcon />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [source, setSource] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("IN");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>("UTC");
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  const [telegram, setTelegram] = useState<{ deepLink: string; qrCode: string } | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [slack, setSlack] = useState<{ installUrl: string | null; linkCommand: string } | null>(null);
  const [slackCopied, setSlackCopied] = useState(false);
  const [surface, setSurface] = useState<"slack" | "telegram" | null>(null);
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  const [slackLinkDialogOpen, setSlackLinkDialogOpen] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [activeConnector, setActiveConnector] = useState<ConnectorItem | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);
  const [connectorQuery, setConnectorQuery] = useState("");
  const [connectorCategory, setConnectorCategory] = useState<"All" | (typeof CATEGORIES)[number]>("All");
  const [searchOpen, setSearchOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timezoneOptions = getTimezoneOptions(timezone);

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // keep UTC fallback
    }
  }, []);

  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data: { onboarding: OnboardingState; name?: string; phone?: string; email?: string }) => {
        if (data.onboarding.completedAt) {
          router.replace("/dashboard");
          return;
        }

        // Prefill the About-you fields from what's already saved. OAuth signups
        // have a real name; email signups carry a placeholder derived from the
        // address, which we leave blank so the principal types their own.
        const placeholder = data.email?.split("@")[0];
        if (data.name && data.name !== placeholder) {
          setProfileName((current) => current || data.name || "");
        }
        if (data.phone) {
          const match = [...PHONE_COUNTRIES]
            .sort((a, b) => b.dial.length - a.dial.length)
            .find((c) => data.phone?.startsWith(c.dial));
          if (match) {
            setPhoneCountry(match.code);
            setProfilePhone(data.phone.slice(match.dial.length).trim());
          } else {
            setProfilePhone(data.phone);
          }
        }

        if (data.onboarding.source) setSource(data.onboarding.source);
        if (data.onboarding.googleConnected) setConnectedProviders(new Set(["gmail", "calendar"]));
        if (data.onboarding.source) {
          setStep(data.onboarding.telegramLinked ? 5 : 4);
          void fetch("/api/onboarding/timezone", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
          }).catch(() => null);
        } else if (data.onboarding.profileCompleted) {
          // Name/phone already saved — resume at the source step after refresh.
          setStep(2);
        }
      })
      .catch(() => null);
  }, [router]);

  const anyConnected = connectedProviders.size > 0;

  const connectorQ = connectorQuery.trim().toLowerCase();
  const visibleConnectors = CONNECTOR_CATALOG.filter((c) => {
    if (!ENABLED_CONNECTOR_PROVIDERS.has(c.provider)) return false;
    const categoryOk = connectorCategory === "All" || c.category === connectorCategory;
    const queryOk =
      !connectorQ ||
      c.title.toLowerCase().includes(connectorQ) ||
      c.description.toLowerCase().includes(connectorQ) ||
      c.provider.toLowerCase().includes(connectorQ);
    return categoryOk && queryOk;
  });
  const showConnectorGroups = connectorCategory === "All" && !connectorQ;
  const recommendedConnectors = visibleConnectors.filter((connector) =>
    RECOMMENDED_CONNECTOR_PROVIDERS.has(connector.provider),
  );
  const moreConnectors = showConnectorGroups
    ? visibleConnectors.filter(
        (connector) => !RECOMMENDED_CONNECTOR_PROVIDERS.has(connector.provider),
      )
    : visibleConnectors;

  function goBack() {
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4 | 5) : s));
  }

  function isConnected(provider: string) {
    return connectedProviders.has(provider) || connectedProviders.has("google");
  }

  function renderConnectorCard(item: ConnectorItem, recommended = false) {
    const connected = isConnected(item.provider);
    const Icon = item.icon;
    const accessType =
      item.authType === "oauth"
        ? "OAuth"
        : item.category === "Databases"
          ? "Read-only"
          : "API credentials";

    return (
      <article
        key={item.provider}
        className={`group flex min-w-0 flex-col rounded-2xl border bg-white p-3.5 transition duration-200 sm:p-4 ${
          connected
            ? "border-emerald-200 bg-emerald-50/30"
            : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]"
        }`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <ConnectorLogo
              provider={item.provider}
              alt={item.title}
              className="size-6 object-contain"
              fallback={<Icon className="size-6" />}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="truncate text-base font-semibold leading-5 text-black">{item.title}</h3>
              {recommended && (
                <span className="rounded-md bg-[#D9BEF4]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#C95618]">
                  Recommended
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-black/70">
              {item.category} · {accessType}
            </p>
          </div>
        </div>

        <p className="mt-3 line-clamp-3 text-sm leading-6 text-black/70 sm:min-h-12">
          {item.description}
        </p>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          {connected ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-normal text-emerald-700">
                <span className="flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m2.5 6 2.2 2.2 4.8-4.8" />
                  </svg>
                </span>
                Connected
              </span>
              <button
                type="button"
                onClick={() => void unlinkConnector(item.provider)}
                className="cursor-pointer rounded-full px-3 py-1 text-[13px] font-normal text-black/70 transition hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40"
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-black/70">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Secure connection
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveConnector(item);
                  setSetupError(null);
                }}
                className="inline-flex h-10 min-w-24 cursor-pointer items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/50"
              >
                {item.authType === "oauth" ? "Connect" : "Set up"}
              </button>
            </>
          )}
        </div>
      </article>
    );
  }

  // Poll for any newly connected connector while on step 4 (connectors).
  useEffect(() => {
    if (step !== 4) return;
    const check = async () => {
      const res = await fetch("/api/connectors");
      if (!res.ok) return;
      const connectors = (await res.json()) as ConnectorSummary[];
      const next = new Set(connectors.map((c) => c.provider));
      setConnectedProviders(next);
      if (next.has("google") || (next.has("gmail") && next.has("calendar"))) {
        await fetch("/api/onboarding/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ googleConnected: true }),
        });
      }
    };
    void check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [step]);

  async function unlinkConnector(provider: string) {
    await fetch(`/api/connectors/${provider}`, { method: "DELETE" });
    setConnectedProviders((prev) => {
      const next = new Set(prev);
      next.delete(provider);
      next.delete("google");
      return next;
    });
    if (provider === "gmail" || provider === "calendar" || provider === "google") {
      await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ googleConnected: false }),
      });
    }
  }

  async function saveManualConnector(event: FormEvent<HTMLFormElement>, connector: ConnectorItem) {
    event.preventDefault();
    if (!connector.fields) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const secret = Object.fromEntries(
      connector.fields.map((f) => [f.name, String(formData.get(f.name) ?? "")]),
    );
    setSetupError(null);
    setSetupSubmitting(true);
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: connector.provider,
          authType: "manual",
          label: connector.title,
          secret,
          metadata: { source: "onboarding" },
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        setSetupError(err?.message ?? `Could not save ${connector.title}`);
        return;
      }
      form.reset();
      setActiveConnector(null);
      setConnectedProviders((prev) => new Set([...prev, connector.provider]));
    } catch {
      setSetupError(`Could not reach the connector service. ${connector.title} was not saved.`);
    } finally {
      setSetupSubmitting(false);
    }
  }

  // Fetch the Telegram deep-link/QR. Surfaces a clear error + retry instead of
  // hanging on "Generating…" when the bot isn't configured or the call fails.
  const loadTelegramLink = useCallback(async () => {
    setTelegramLoading(true);
    setTelegramError(null);
    try {
      const res = await fetch("/api/onboarding/telegram/token", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { deepLink?: string; qrCode?: string; message?: string }
        | null;
      if (res.ok && data?.deepLink && data?.qrCode) {
        setTelegram({ deepLink: data.deepLink, qrCode: data.qrCode });
      } else {
        setTelegram(null);
        setTelegramError(
          data?.message ??
            "We couldn't generate your Telegram link. You can retry, or skip this and set it up later from the dashboard.",
        );
      }
    } catch {
      setTelegram(null);
      setTelegramError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setTelegramLoading(false);
    }
  }, []);

  // Step 5: prepare both channel links and poll until either one connects.
  useEffect(() => {
    if (step !== 5) return;
    void loadTelegramLink();

    fetch("/api/onboarding/slack/token", { method: "POST" })
      .then((r) => r.json())
      .then((data: { installUrl?: string | null; linkCommand?: string }) => {
        if (data.linkCommand) {
          setSlack({ installUrl: data.installUrl ?? null, linkCommand: data.linkCommand });
        }
      })
      .catch(() => null);

    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/onboarding/status");
      if (!res.ok) return;
      const data = (await res.json()) as { onboarding: OnboardingState };
      if (data.onboarding.telegramLinked || data.onboarding.slackLinked) {
        if (pollRef.current) clearInterval(pollRef.current);
        router.push("/dashboard");
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, router, loadTelegramLink]);

  async function submitProfile() {
    if (!profileName.trim()) return;
    setProfileError(null);
    setProfileLoading(true);
    try {
      const dial = PHONE_COUNTRIES.find((c) => c.code === phoneCountry)?.dial ?? "";
      const digits = profilePhone.replace(/[^\d]/g, "");
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: profileName.trim(),
          phone: digits ? `${dial} ${digits}` : undefined,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      setStep(2);
    } catch {
      setProfileError("Something went wrong saving your details. Please try again.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function submitSource() {
    if (!source) return;
    setSourceError(null);
    setSourceLoading(true);
    try {
      const res = await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (!res.ok) throw new Error("save_failed");
      setStep(3);
    } catch {
      setSourceError("Something went wrong saving your answer. Please try again.");
    } finally {
      setSourceLoading(false);
    }
  }

  async function skipTelegram() {
    setSkipLoading(true);
    try {
      await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });
    } catch {
      // best-effort — don't block navigation if the call fails
    } finally {
      setSkipLoading(false);
    }
    router.push("/dashboard");
  }

  async function submitTimezone() {
    await fetch("/api/onboarding/timezone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timezone }),
    });
    setStep(4);
  }

  return (
    <main
      className={`relative flex justify-center bg-white text-black ${
        step === 4
          ? "min-h-[100dvh] items-start overflow-x-clip px-4 pb-24 pt-14 sm:px-6 sm:pb-28 sm:pt-16"
          : "min-h-screen items-start px-6 pb-10 pt-16"
      }`}
    >
      {/* Floating brand mark — matches the login page */}
      <Link
        href="/"
        className="fixed left-5 top-5 z-30 flex h-9 items-center sm:left-8 sm:top-7"
        aria-label="rizly home"
      >
        <Image
          src="/rizly_white.png"
          alt="rizly"
          width={112}
          height={26}
          className="h-8 w-auto object-contain"
          priority
        />
      </Link>

      <div className={`flex w-full flex-col ${step === 4 ? "max-w-[1200px]" : step === 1 ? "max-w-md" : "max-w-xl"}`}>
        <ProgressHeader step={step} onBack={goBack} />

        <div
          key={step}
          className={`onb-enter ${step === 4 ? "mt-4 flex flex-col sm:mt-7" : "mt-11"}`}
        >
        {/* Step 1 — about you (name + optional phone) */}
        {step === 1 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D96420]">
              {STEP_META[0].eyebrow}
            </p>
            <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-slate-950 text-balance">
              Tell us about you
            </h1>

            <div className="mt-7">
              <label className="block text-base font-normal text-slate-900">Full name</label>
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Enter your full name"
                type="text"
                autoComplete="name"
                autoFocus
                required
                className="mt-2 h-[52px] w-full rounded-full border border-black/70 bg-white px-5 text-base font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#D9BEF4]"
              />
            </div>

            <div className="mt-5">
              <label className="block text-base font-normal text-slate-900">
                Phone <span className="text-slate-400">(optional)</span>
              </label>
              <div className="mt-2 flex gap-2">
                <select
                  value={phoneCountry}
                  onChange={(e) => setPhoneCountry(e.target.value)}
                  aria-label="Country code"
                  className="h-[52px] shrink-0 rounded-full border border-black/70 bg-white px-3 text-base font-normal text-slate-950 outline-none transition focus:border-[#D9BEF4]"
                >
                  {PHONE_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.dial}
                    </option>
                  ))}
                </select>
                <input
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value.replace(/[^\d\s-]/g, ""))}
                  placeholder="Phone number"
                  type="tel"
                  autoComplete="tel-national"
                  inputMode="tel"
                  className="h-[52px] w-full rounded-full border border-black/70 bg-white px-5 text-base font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#D9BEF4]"
                />
              </div>
            </div>

            {profileError && <p className="mt-4 text-sm text-red-600">{profileError}</p>}

            <button
              type="button"
              disabled={!profileName.trim() || profileLoading}
              onClick={() => void submitProfile()}
              className="mt-8 inline-flex h-[52px] w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 text-base font-normal text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {profileLoading ? "Saving…" : "Continue"}
            </button>
          </section>
        )}

        {/* Step 2 — source */}
        {step === 2 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D96420]">
              {STEP_META[1].eyebrow}
            </p>
            <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-slate-950 text-balance">
              Where did you hear about rizly?
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-6 text-slate-500">
              A quick one — it helps us understand who rizly works best for.
            </p>
            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SOURCE_OPTIONS.map((option) => {
                const selected = source === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSource(option)}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-full border border-black/70 px-5 py-3.5 text-left text-base font-normal transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40 ${
                      selected
                        ? "bg-slate-950 text-white"
                        : "bg-white text-slate-950 hover:border-black hover:bg-slate-50"
                    }`}
                  >
                    {option}
                    {selected && <CheckIcon />}
                  </button>
                );
              })}
            </div>
            {sourceError && (
              <p className="mt-4 text-sm text-red-600">{sourceError}</p>
            )}
            <button
              type="button"
              disabled={!source || sourceLoading}
              onClick={() => void submitSource()}
              className="mt-8 inline-flex h-[52px] w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 text-base font-normal text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sourceLoading ? "Saving…" : "Continue"}
            </button>
          </section>
        )}

        {/* Step 3 — timezone */}
        {step === 3 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D96420]">
              {STEP_META[2].eyebrow}
            </p>
            <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-slate-950 text-balance">
              What&rsquo;s your timezone?
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-6 text-slate-500">
              rizly uses this for reminders and meeting times. We&rsquo;ve guessed yours from your
              browser — change it if it&rsquo;s wrong.
            </p>
            <TimezoneCombobox value={timezone} options={timezoneOptions} onChange={setTimezone} />
            <p className="mt-3 text-sm text-slate-500">
              Selected: <span className="font-semibold text-black">{timezone.replace(/_/g, " ")}</span>
              {" — it's "}
              <span className="font-semibold text-black">
                {new Date().toLocaleTimeString("en-US", {
                  timeZone: timezone,
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
              {" there right now."}
            </p>
            <button
              type="button"
              onClick={() => void submitTimezone()}
              className="mt-8 inline-flex h-[52px] w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 text-base font-normal text-white transition hover:bg-slate-800 active:scale-[0.99]"
            >
              Continue
            </button>
          </section>
        )}

        {/* Step 4 — connectors */}
        {step === 4 && (
          <section className="flex flex-col">
            <header className="shrink-0 bg-white">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D96420]">
                    {STEP_META[3].eyebrow}
                  </p>
                  <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-black text-balance">
                    Connect your workspace
                  </h1>
                  <p className="mt-3 max-w-2xl text-[15px] leading-6 text-black/70">
                    Start with the tools you use most. You can add or remove integrations anytime.
                  </p>
                </div>
                <span className={`mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tabular-nums ${
                  anyConnected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-black/70"
                }`}>
                  <span className={`size-1.5 rounded-full ${anyConnected ? "bg-emerald-500" : "bg-slate-300"}`} />
                  {connectedProviders.size}
                  <span className="hidden sm:inline">connected</span>
                </span>
              </div>
            </header>

            <div className="sticky top-14 z-20 -mx-4 mt-4 border-y border-slate-200 bg-white/95 px-4 py-2 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.6)] backdrop-blur-md sm:top-16 sm:mx-0 sm:rounded-xl sm:border sm:px-3">
              <div className="flex min-w-0 items-center gap-2">
                <nav aria-label="Integration categories" className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex w-max gap-1.5">
                    {(["All", ...CATEGORIES] as const).map((cat) => {
                      const active = connectorCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setConnectorCategory(cat)}
                          className={`cursor-pointer rounded-full px-4 py-2 text-[13px] font-normal whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40 ${
                            active
                              ? "bg-slate-950 text-white"
                              : "text-black/70 hover:bg-slate-100 hover:text-black"
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </nav>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen((open) => {
                      if (open) setConnectorQuery("");
                      return !open;
                    });
                  }}
                  aria-label={searchOpen ? "Close integration search" : "Search integrations"}
                  aria-expanded={searchOpen}
                  className={`flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40 ${
                    searchOpen
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-black/70 hover:border-slate-300 hover:text-black"
                  }`}
                >
                  {searchOpen ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  ) : (
                    <SearchIcon />
                  )}
                </button>
              </div>

              {searchOpen && (
                <div className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 transition focus-within:border-[#D9BEF4] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#D9BEF4]/10">
                  <SearchIcon />
                  <input
                    value={connectorQuery}
                    onChange={(e) => setConnectorQuery(e.target.value)}
                    placeholder="Search Gmail, Stripe, Postgres…"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-black outline-none placeholder:text-black/70"
                    aria-label="Search integrations"
                    autoComplete="off"
                    autoFocus
                  />
                  {connectorQuery && (
                    <button
                      type="button"
                      onClick={() => setConnectorQuery("")}
                      aria-label="Clear integration search"
                      className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-black/70 transition hover:bg-slate-200/70 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="-mx-1 mt-3 px-1 pb-5 pt-1">
              {visibleConnectors.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-6 text-center">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-black/70">
                    <SearchIcon />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-black">No integrations found</p>
                  <p className="mt-1 text-xs leading-5 text-black/70">
                    Try another search or choose a different category.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setConnectorQuery("");
                      setConnectorCategory("All");
                    }}
                    className="mt-3 cursor-pointer text-xs font-semibold text-[#C95618] underline-offset-4 hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {showConnectorGroups && recommendedConnectors.length > 0 && (
                    <section aria-labelledby="recommended-connectors-title">
                      <div className="mb-3 flex items-end justify-between gap-4">
                        <div>
                          <h2 id="recommended-connectors-title" className="text-base font-semibold text-black">
                            Recommended for you
                          </h2>
                          <p className="mt-1 text-[13px] text-black/70">The best place to start with Rizly.</p>
                        </div>
                        <span className="text-[11px] font-medium text-black/70">{recommendedConnectors.length} tools</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {recommendedConnectors.map((item) => renderConnectorCard(item, true))}
                      </div>
                    </section>
                  )}

                  <section aria-labelledby="all-connectors-title">
                    <div className="mb-3 flex items-end justify-between gap-4 border-t border-slate-200 pt-5">
                      <div>
                        <h2 id="all-connectors-title" className="text-base font-semibold text-black">
                          {showConnectorGroups ? "More integrations" : "Integrations"}
                        </h2>
                        <p className="mt-1 text-[13px] text-black/70">
                          {showConnectorGroups
                            ? "Connect revenue, scheduling, databases, and team tools."
                            : `${moreConnectors.length} matching ${moreConnectors.length === 1 ? "tool" : "tools"}.`}
                        </p>
                      </div>
                      {showConnectorGroups && <span className="text-[11px] font-medium text-black/70">{moreConnectors.length} tools</span>}
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {moreConnectors.map((item) => renderConnectorCard(item))}
                    </div>
                  </section>
                </div>
              )}
            </div>

          </section>
        )}

        {/* Step 5 — choose where Riz lives (Slack / Telegram / dashboard only) */}
        {step === 5 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D96420]">
              {STEP_META[4].eyebrow}
            </p>
            <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-slate-950 text-balance">
              Where should Riz live?
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-6 text-slate-500">
              Riz sends your morning brief, drafts, and approvals wherever you already are. Pick a
              channel — you can add the other one later from the dashboard.
            </p>

            <div className="mt-7 flex flex-col gap-3">
              {/* Slack row */}
              <div className="rounded-2xl border border-black/70 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-black/70 bg-white">
                    <SlackIcon className="size-5" />
                  </span>
                  <div>
                    <span className="block text-sm font-semibold text-black">Slack</span>
                    <span className="mt-0.5 block text-sm leading-6 text-slate-500">
                      Riz DMs you inside your workspace — briefs, drafts, and one-click approve
                      buttons where your work already happens.
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4">
                  {slack ? (
                    slack.installUrl ? (
                      <>
                        <a
                          href={slack.installUrl}
                          onClick={() => setSurface("slack")}
                          className="inline-flex h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.99]"
                        >
                          <SlackIcon className="size-4" />
                          Add to Slack
                        </a>
                        <button
                          type="button"
                          onClick={() => setSlackLinkDialogOpen(true)}
                          className="inline-flex h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-black/70 bg-white px-5 text-sm font-normal text-black transition hover:border-black hover:bg-slate-50"
                        >
                          Already have the app?
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSurface("slack");
                          setSlackLinkDialogOpen(true);
                        }}
                        className="inline-flex h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.99]"
                      >
                        <SlackIcon className="size-4" />
                        Link Slack
                      </button>
                    )
                  ) : (
                    <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-black" />
                      Generating your secure link…
                    </p>
                  )}
                </div>
              </div>

              {/* Telegram row */}
              <div className="rounded-2xl border border-black/70 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-black/70 bg-white">
                    <TelegramIcon className="size-5" />
                  </span>
                  <div>
                    <span className="block text-sm font-semibold text-black">Telegram</span>
                    <span className="mt-0.5 block text-sm leading-6 text-slate-500">
                      Riz texts you on your phone — scan a QR once and every brief, reminder, and
                      approval lands in one chat.
                    </span>
                  </div>
                </div>
                <div className="mt-4 border-t border-slate-200 pt-4">
                  {telegram ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSurface("telegram");
                        setTelegramDialogOpen(true);
                      }}
                      className="inline-flex h-[44px] cursor-pointer items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.99]"
                    >
                      Connect Telegram
                    </button>
                  ) : telegramError ? (
                    <div>
                      <p className="text-sm leading-6 text-slate-500">{telegramError}</p>
                      <button
                        type="button"
                        onClick={() => void loadTelegramLink()}
                        disabled={telegramLoading}
                        className="mt-3 inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {telegramLoading ? "Retrying…" : "Try again"}
                      </button>
                    </div>
                  ) : (
                    <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-black" />
                      Generating your link…
                    </p>
                  )}
                </div>
              </div>

              {/* Dashboard-only row */}
              <div className="rounded-2xl border border-black/70 bg-white p-4 transition-all hover:border-black">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-black/70 bg-white">
                    <ChatBubbleIcon />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-black">Just the dashboard</p>
                    <p className="mt-0.5 text-sm leading-6 text-slate-500">
                      Use Riz from the web only. Briefs and approvals wait for you here — you can
                      connect Slack or Telegram anytime.
                    </p>
                    <button
                      type="button"
                      disabled={skipLoading}
                      onClick={() => void skipTelegram()}
                      className="mt-3 inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-black/70 bg-white px-5 text-sm font-normal text-black transition hover:border-black hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {skipLoading ? "Saving…" : "Continue to dashboard"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {surface !== null && (
              <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D9BEF4] opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-[#D9BEF4]" />
                </span>
                Waiting for the link to complete — this page moves on automatically.
              </p>
            )}
          </section>
        )}
        </div>

        {step === 4 && (
          <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_32px_-24px_rgba(15,23,42,0.45)] backdrop-blur-md sm:px-6 sm:pb-4">
            <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="shrink-0 cursor-pointer rounded-full px-3 py-2 text-sm font-normal text-black/70 transition hover:bg-slate-100 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40"
              >
                Skip for now
              </button>
              <button
                type="button"
                disabled={!anyConnected}
                onClick={() => setStep(5)}
                className="inline-flex h-[52px] min-w-36 cursor-pointer items-center justify-center gap-2 rounded-full bg-slate-950 px-8 text-base font-normal text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-black/70"
              >
                Continue
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
          </footer>
        )}

        {/* Step 3 fills the viewport with its own pinned footer, so the trust line
            would overflow the page there — show it on the shorter steps only. */}
        {step !== 4 && (
          <p className="mt-14 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <LockIcon />
            Encrypted end to end. Nothing sends without your approval.
          </p>
        )}
      </div>

      {activeConnector && (
        <ConnectorDialog
          connector={activeConnector}
          error={setupError}
          submitting={setupSubmitting}
          onClose={() => { setActiveConnector(null); setSetupError(null); }}
          onManualSubmit={saveManualConnector}
        />
      )}

      {telegramDialogOpen && telegram && (
        <SurfaceDialog title="Connect Telegram" onClose={() => setTelegramDialogOpen(false)}>
          <div className="flex flex-col items-center gap-4 text-center">
            <img
              src={telegram.qrCode}
              alt="Telegram link QR code"
              className="h-[200px] w-[200px] rounded-2xl border border-black/70 bg-white p-2"
            />
            <p className="text-sm leading-6 text-slate-600">
              Scan from your phone, or tap the button to open the bot. Start the bot to
              complete the link.
            </p>
            <a
              href={telegram.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[44px] w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.99]"
            >
              Open Telegram bot
            </a>
          </div>
        </SurfaceDialog>
      )}

      {slackLinkDialogOpen && slack && (
        <SurfaceDialog
          title={slack.installUrl ? "Already have the Rizly app?" : "Link Slack"}
          onClose={() => setSlackLinkDialogOpen(false)}
        >
          <p className="text-sm leading-6 text-slate-500">
            DM the Rizly app in Slack this command to link your account:
          </p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(slack.linkCommand).then(() => {
                setSlackCopied(true);
                setTimeout(() => setSlackCopied(false), 2000);
              });
            }}
            className="mt-3 flex w-full cursor-pointer items-center justify-between gap-3 rounded-full border border-black/70 bg-slate-50 px-4 py-2 text-left font-mono text-xs text-slate-700 transition hover:border-black"
          >
            <span className="truncate">{slack.linkCommand}</span>
            <span className="shrink-0 font-sans text-[11px] font-semibold text-slate-500">
              {slackCopied ? "Copied ✓" : "Copy"}
            </span>
          </button>
        </SurfaceDialog>
      )}
    </main>
  );
}
