"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreditsBadge } from "../components/CreditsBadge";
import { ConnectorLogo } from "../../components/ConnectorLogo";
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
  PayPalIcon,
  PostgresIcon,
  QuickBooksIcon,
  RazorpayIcon,
  ShopifyIcon,
  SlackIcon,
  StatuspageIcon,
  StripeIcon,
  TrelloIcon,
  TwilioIcon,
  TypeformIcon,
  UptimeRobotIcon,
  WiseIcon,
  XeroIcon,
} from "../../components/ConnectorIcons";

export type ConnectorSummary = {
  id: string;
  provider: string;
  authType: string;
  label: string;
  status: string;
  scopes: string[];
  metadata: Record<string, string | number | boolean | null>;
  updatedAt: string;
};

export const MULTI_ACCOUNT_PROVIDERS = ["postgres", "mongodb", "razorpay", "paypal", "mpesa", "calcom"] as const;
type MultiAccountProvider = (typeof MULTI_ACCOUNT_PROVIDERS)[number];
export function isMultiAccount(provider: string): provider is MultiAccountProvider {
  return MULTI_ACCOUNT_PROVIDERS.includes(provider as MultiAccountProvider);
}

export type ConnectorField = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
};

export type ConnectorCatalogItem = {
  id: string;
  /** Backend connector key used for status lookup + connect/disconnect. */
  provider: "gmail" | "calendar" | "calcom" | "razorpay" | "stripe" | "postgres" | "mongodb" | "slack" | "notion" | "paypal" | "github" | "mpesa" | "discord" | "google_workspace" | "jira" | "pagerduty" | "trello" | "airtable" | "twilio" | "shopify" | "calendly" | "typeform" | "gumroad" | "lemonsqueezy" | "dropbox" | "figma" | "uptimerobot" | "quickbooks" | "xero" | "wise" | "bamboohr" | "deel" | "box" | "statuspage" | "betterstack";
  title: string;
  description: string;
  category: "Google" | "Scheduling" | "Payments" | "Databases" | "Team" | "APIs";
  authType: "oauth" | "manual";
  icon: typeof GmailIcon;
  fields?: ConnectorField[];
};

export const connectorCatalog: ConnectorCatalogItem[] = [
  {
    id: "gmail",
    provider: "gmail",
    title: "Gmail",
    description: "Inbox triage, meeting detection from email, and approved replies.",
    category: "Google",
    authType: "oauth",
    icon: GmailIcon,
  },
  {
    id: "calendar",
    provider: "calendar",
    title: "Google Calendar",
    description: "Free/busy checks, approved event creation, reschedules, and meeting reminders.",
    category: "Google",
    authType: "oauth",
    icon: CalendarIcon,
  },
  {
    id: "google_workspace",
    provider: "google_workspace",
    title: "Google Drive, Sheets & Docs",
    description: "Upload files, append sheet rows, and create documents from an automation. A separate grant from Gmail/Calendar.",
    category: "Google",
    authType: "oauth",
    icon: GoogleDriveIcon,
  },
  {
    id: "calcom",
    provider: "calcom",
    title: "Cal.com",
    description: "View bookings, create meetings, and schedule meeting notifications through Cal.com.",
    category: "Scheduling",
    authType: "oauth",
    icon: CalComIcon,
    // OAuth only covers Cal.com's EU org (cal.eu) today - anyone on the
    // global cal.com account needs this fallback instead.
    fields: [
      { name: "apiKey", label: "API Key (if OAuth doesn't work for your account)", type: "password", placeholder: "cal_live_..." },
    ],
  },
  {
    id: "razorpay",
    provider: "razorpay",
    title: "Razorpay",
    description: "Read-only revenue snapshots, failed payments, and settlement checks.",
    category: "Payments",
    authType: "manual",
    icon: RazorpayIcon,
    fields: [
      { name: "keyId", label: "Key ID", placeholder: "rzp_live_..." },
      { name: "keySecret", label: "Key Secret", type: "password" },
    ],
  },
  {
    id: "stripe",
    provider: "stripe",
    title: "Stripe",
    description: "Read-only subscription, MRR, invoices, and failed payment checks.",
    category: "Payments",
    authType: "oauth",
    icon: StripeIcon,
    // Manual fallback: a restricted secret key works for users who'd rather
    // not grant OAuth Connect access to their full account.
    fields: [
      { name: "secretKey", label: "Secret Key", type: "password", placeholder: "sk_live_..." },
      { name: "stripeAccountId", label: "Stripe Account ID (optional)", placeholder: "acct_...", required: false },
    ],
  },
  {
    id: "paypal",
    provider: "paypal",
    title: "PayPal",
    description: "Read-only balances and recent transactions from your PayPal business account.",
    category: "Payments",
    authType: "manual",
    icon: PayPalIcon,
    fields: [
      { name: "clientId", label: "Client ID", placeholder: "REST app client ID" },
      { name: "clientSecret", label: "Client Secret", type: "password" },
    ],
  },
  {
    id: "mpesa",
    provider: "mpesa",
    title: "M-Pesa",
    description: "Safaricom Daraja business credentials — connection checks now, balance and transaction pulls coming next.",
    category: "Payments",
    authType: "manual",
    icon: MpesaIcon,
    fields: [
      { name: "consumerKey", label: "Consumer Key", type: "password" },
      { name: "consumerSecret", label: "Consumer Secret", type: "password" },
      { name: "shortcode", label: "Business Shortcode", placeholder: "e.g. 174379" },
      { name: "environment", label: "Environment", placeholder: "production or sandbox" },
    ],
  },
  {
    id: "github",
    provider: "github",
    title: "GitHub",
    description: "Open PRs, issues, and review requests involving you — briefed on demand.",
    category: "Team",
    authType: "oauth",
    icon: GitHubIcon,
    // Manual fallback: a fine-grained PAT still works for users who prefer
    // narrower read-only access than the OAuth app's "repo" scope.
    fields: [
      { name: "token", label: "Personal Access Token", type: "password", placeholder: "ghp_... or github_pat_..." },
    ],
  },
  {
    id: "jira",
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
  },
  {
    id: "trello",
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
  },
  {
    id: "pagerduty",
    provider: "pagerduty",
    title: "PagerDuty",
    description: "Open incidents on a service from an automation.",
    category: "APIs",
    authType: "oauth",
    icon: PagerDutyIcon,
    // Manual fallback: a scoped REST API key still works for users who'd
    // rather not grant OAuth access.
    fields: [
      { name: "apiKey", label: "API Key", type: "password", placeholder: "From PagerDuty's API Access Keys settings" },
      { name: "fromEmail", label: "From Email", placeholder: "A valid PagerDuty user's email — required by their API" },
    ],
  },
  {
    id: "twilio",
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
  },
  {
    id: "airtable",
    provider: "airtable",
    title: "Airtable",
    description: "Create and poll records in a base from an automation.",
    category: "Databases",
    authType: "manual",
    icon: AirtableIcon,
    fields: [
      { name: "apiKey", label: "Personal Access Token", type: "password", placeholder: "pat..." },
    ],
  },
  {
    id: "postgres",
    provider: "postgres",
    title: "Postgres",
    description: "Read-only SQL for business metrics. Permissions are verified before saving.",
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
  },
  {
    id: "mongodb",
    provider: "mongodb",
    title: "MongoDB",
    description: "Restricted aggregate/find queries. Read-only access is verified before saving.",
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
  },
  {
    id: "slack",
    provider: "slack",
    title: "Slack",
    description: "Read joined channels with message authors, timestamps, source links, and concise Telegram briefs.",
    category: "Team",
    authType: "manual",
    icon: SlackIcon,
    fields: [
      { name: "botToken", label: "Bot token with channel history and users:read scopes", type: "password", placeholder: "xoxb-..." },
    ],
  },
  {
    id: "notion",
    provider: "notion",
    title: "Notion",
    description: "Search pages, retrieve knowledge base content, and get context from your docs.",
    category: "Team",
    authType: "oauth",
    icon: NotionIcon,
  },
  {
    id: "discord",
    provider: "discord",
    title: "Discord (basic webhook)",
    description: "Lightweight, single-channel option: read one bot-accessible channel and post approved messages through an optional webhook, with your own bot token. For the full Discord bot — server install, live channel triggers, DM chat — use Dashboard → Discord instead.",
    category: "Team",
    authType: "manual",
    icon: DiscordIcon,
    fields: [
      {
        name: "botToken",
        label: "Bot token",
        type: "password",
        placeholder: "Discord bot token",
      },
      {
        name: "channelId",
        label: "Channel ID",
        placeholder: "123456789012345678",
      },
      {
        name: "guildId",
        label: "Server ID (optional, enables message links)",
        placeholder: "123456789012345678",
        required: false,
      },
      {
        name: "webhookUrl",
        label: "Channel webhook URL (optional, enables posting)",
        type: "password",
        placeholder: "https://discord.com/api/webhooks/...",
        required: false,
      },
    ],
  },
  {
    id: "dropbox",
    provider: "dropbox",
    title: "Dropbox",
    description: "Automations that fire when a file changes in your Dropbox.",
    category: "APIs",
    authType: "oauth",
    icon: DropboxIcon,
  },
  {
    id: "figma",
    provider: "figma",
    title: "Figma",
    description: "Automations that fire on a new file comment. Webhooks require a Figma Organization/Enterprise plan.",
    category: "Team",
    authType: "oauth",
    icon: FigmaIcon,
  },
  {
    id: "calendly",
    provider: "calendly",
    title: "Calendly",
    description: "Automations that fire when a booking is created or cancelled.",
    category: "Scheduling",
    // Real OAuth exchange is built on the backend (CALENDLY_CLIENT_ID/SECRET,
    // gateway /api/connectors/calendly/start + /callback) -- the PAT field
    // below is only a fallback for accounts OAuth doesn't cover, same as Cal.com.
    authType: "oauth",
    icon: CalendlyIcon,
    fields: [
      { name: "apiToken", label: "Personal Access Token (if OAuth doesn't work for your account)", type: "password", placeholder: "From calendly.com/integrations/api_webhooks" },
    ],
  },
  {
    id: "typeform",
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
  },
  {
    id: "gumroad",
    provider: "gumroad",
    title: "Gumroad",
    description: "Automations that fire on a new sale. Add the ping URL manually — see setup note after connecting.",
    category: "Payments",
    authType: "manual",
    icon: GumroadIcon,
    fields: [
      { name: "accessToken", label: "Access Token", type: "password", placeholder: "From Gumroad Settings -> Advanced" },
    ],
  },
  {
    id: "lemonsqueezy",
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
  },
  {
    id: "uptimerobot",
    provider: "uptimerobot",
    title: "UptimeRobot",
    description: "Automations that fire when a monitor goes up or down. Add a Web-Hook Alert Contact manually — see setup note after connecting.",
    category: "APIs",
    authType: "manual",
    icon: UptimeRobotIcon,
    fields: [
      { name: "apiKey", label: "API Key", type: "password", placeholder: "From My Settings -> API Settings" },
    ],
  },
  {
    id: "quickbooks",
    provider: "quickbooks",
    title: "QuickBooks",
    description: "Automations that fire on a new invoice or a paid invoice. Requires a one-time app-level webhook subscription in the Intuit Developer dashboard.",
    category: "Payments",
    authType: "oauth",
    icon: QuickBooksIcon,
  },
  {
    id: "xero",
    provider: "xero",
    title: "Xero",
    description: "Automations that fire when a new invoice is created.",
    category: "Payments",
    authType: "oauth",
    icon: XeroIcon,
  },
  {
    id: "wise",
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
  },
  {
    id: "bamboohr",
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
  },
  {
    id: "deel",
    provider: "deel",
    title: "Deel",
    description: "Automations that fire on a new contract or a completed payment.",
    category: "Team",
    authType: "oauth",
    icon: DeelIcon,
  },
  {
    id: "box",
    provider: "box",
    title: "Box",
    description: "Automations that fire when a file is uploaded to a chosen Box folder.",
    category: "APIs",
    authType: "oauth",
    icon: BoxIcon,
  },
  {
    id: "statuspage",
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
  },
  {
    id: "betterstack",
    provider: "betterstack",
    title: "Better Stack",
    description: "Automations that fire when an incident starts or resolves. Add a webhook integration manually — see setup note after connecting.",
    category: "APIs",
    authType: "manual",
    icon: BetterStackIcon,
    fields: [
      { name: "apiKey", label: "API Key", type: "password", placeholder: "From Better Stack Settings -> API tokens" },
    ],
  },
];

export const categories = ["All", "Google", "Scheduling", "Payments", "Databases", "Team", "APIs"] as const;

// The connectors catalog is a deliberate allow-list, not a hide-list: anything
// not named here stays off the page. Adding a connector to connectorCatalog
// above is therefore not enough to ship it — that's the point, so half-built
// integrations can't leak into the UI by accident.
//
// Slack and Telegram are intentionally absent while remaining fully live as
// automation trigger/action nodes and as DM surfaces — they're chat surfaces
// reached from their own dashboard pages, not connector cards.
const ENABLED_CONNECTOR_PROVIDERS = new Set<string>([
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

export const shownCatalog = connectorCatalog.filter((c) => ENABLED_CONNECTOR_PROVIDERS.has(c.provider));

export const catalogByProvider = new Map(shownCatalog.map((c) => [c.provider as string, c]));
const visibleConnectorProviders = new Set(shownCatalog.map((c) => c.provider as string));

export function ConnectorsClient() {
  const [connectors, setConnectors] = useState<ConnectorSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // For multi-account providers, store arrays. For others, store single.
  const visibleConnectors = useMemo(
    () => connectors.filter((connector) => visibleConnectorProviders.has(connector.provider)),
    [connectors],
  );

  const connectedCount = visibleConnectors.length;

  async function loadConnectors() {
    try {
      const response = await fetch("/api/connectors");
      if (!response.ok) {
        throw new Error("Failed to load connectors");
      }

      const data = (await response.json()) as unknown;
      setConnectors(Array.isArray(data) ? (data as ConnectorSummary[]) : []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load connectors");
    }
  }

  useEffect(() => {
    void loadConnectors();
  }, []);

  // Deep links to "connect this specific provider" now live on the dedicated
  // catalog page, which owns the search/category state that used to live here.
  useEffect(() => {
    const provider = new URLSearchParams(window.location.search).get("setup");
    if (!provider || !catalogByProvider.has(provider)) return;
    window.location.replace(`/dashboard/connectors/new?setup=${encodeURIComponent(provider)}`);
  }, []);

  async function deleteConnectorById(accountId: string, label: string) {
    setActionError(null);
    const response = await fetch(`/api/connectors/account/${accountId}`, { method: "DELETE" });
    if (!response.ok) {
      setActionError(`Could not remove "${label}"`);
      return;
    }
    await loadConnectors();
  }

  return (
    <main className="min-h-screen bg-[#f8f8f7] text-black">
      {/* Top bar — matches the chat page's sticky chrome */}
      <div className="sticky top-0 z-10 flex h-14 w-full shrink-0 items-center justify-between border-b border-transparent bg-[#f8f8f7] px-4 md:px-6">
        <div className="flex h-8 items-center rounded-lg px-2 text-base font-normal text-slate-900 md:text-lg">
          Connectors
        </div>
        <CreditsBadge />
      </div>

      <section className="mx-auto flex w-full max-w-[1200px] flex-col px-4 py-8 sm:px-8">
        <header className="shrink-0">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D96420]">
                Integrations
              </p>
              <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-slate-950 text-balance">
                Connect your tools
              </h1>
            </div>
            <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tabular-nums bg-emerald-50 text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {connectedCount}
              <span className="hidden sm:inline">connected</span>
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-slate-500">
            The more rizly can see, the more it can handle. Connect approved apps or encrypted business credentials.
          </p>
        </header>

        {loadError ? (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {loadError}
          </p>
        ) : null}
        {actionError ? (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {actionError}
          </p>
        ) : null}

        <section className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-black">Connected accounts</p>
            <Link
              href="/dashboard/connectors/new"
              className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-slate-950 px-4 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/50"
              title="Connect an account"
              aria-label="Connect an account"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="shrink-0">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
              Connect account
            </Link>
          </div>

          {visibleConnectors.length === 0 ? (
            <div className="mt-3 flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 px-6 text-center">
              <p className="text-sm text-black/70">
                Nothing connected yet. Browse integrations to add Gmail, Calendar, and more.
              </p>
              <Link
                href="/dashboard/connectors/new"
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.98]"
              >
                Browse integrations
              </Link>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleConnectors.map((account) => {
                const catalogItem = catalogByProvider.get(account.provider);
                const Icon = catalogItem?.icon;
                return (
                  <div
                    key={account.id}
                    className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-3.5"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                      <ConnectorLogo
                        provider={account.provider}
                        alt={account.label}
                        className="size-5 object-contain"
                        fallback={
                          Icon ? <Icon className="size-5" /> : (
                            <span className="text-xs font-bold uppercase text-slate-400">
                              {account.provider.slice(0, 2)}
                            </span>
                          )
                        }
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-black">{account.label}</p>
                      <p className="truncate text-xs text-black/70">{catalogItem?.title ?? account.provider}</p>
                    </div>
                    <span
                      className={`shrink-0 h-1.5 w-1.5 rounded-full ${
                        account.status === "connected" ? "bg-emerald-500" : "bg-red-500"
                      }`}
                      title={account.status}
                    />
                    <button
                      type="button"
                      title="Remove account"
                      onClick={() => void deleteConnectorById(account.id, account.label)}
                      className="shrink-0 cursor-pointer rounded-full px-2 py-1 text-xs font-normal text-red-500 transition hover:bg-white hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </section>
    </main>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative flex h-6 w-11 shrink-0 cursor-pointer items-center border-2 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "border-slate-950 bg-[#d9f99d]" : "border-slate-400 bg-slate-100"
      }`}
    >
      <span
        className={`absolute h-4 w-4 border border-slate-950 transition-transform duration-200 ${
          checked ? "translate-x-[21px] bg-emerald-500" : "translate-x-[3px] bg-slate-400"
        }`}
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{label}</p>
        {description && <p className="mt-0.5 text-xs font-medium leading-5 text-slate-500">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const REMINDER_OPTIONS = [
  { value: "5", label: "5 min" },
  { value: "10", label: "10 min" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "1 hour" },
];

const SCOPE_OPTIONS = [
  { value: "all", label: "All emails" },
  { value: "important", label: "Important only" },
];

function SettingsPanel({
  connector,
  account,
  onSave,
  onClose,
  telegramLinked,
  slackLinked,
}: {
  connector: ConnectorCatalogItem;
  account: ConnectorSummary;
  onSave: (id: string, metadata: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  telegramLinked: boolean | null;
  slackLinked: boolean | null;
}) {
  const Icon = connector.icon;
  const anyChannelLinked = Boolean(telegramLinked) || Boolean(slackLinked);
  const linkedChannelNames = [telegramLinked && "Telegram", slackLinked && "Slack"].filter(
    (name): name is string => Boolean(name),
  );
  const channelsLoaded = telegramLinked !== null && slackLinked !== null;

  const [notifEnabled, setNotifEnabled] = useState(account.metadata.notificationsEnabled !== false);
  const [notifScope, setNotifScope] = useState<string>(
    typeof account.metadata.notificationScope === "string"
      ? account.metadata.notificationScope
      : "all",
  );
  const [reminderMinutes, setReminderMinutes] = useState<string>(
    typeof account.metadata.meetingReminderMinutes === "number"
      ? String(account.metadata.meetingReminderMinutes)
      : "15",
  );
  const [autoProcess, setAutoProcess] = useState(account.metadata.autoProcess !== false);
  const [notifyOnInvites, setNotifyOnInvites] = useState(account.metadata.notifyOnInvites !== false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isGmail = account.provider === "gmail";
  const isCalendar = account.provider === "calendar";
  const isMeetingProvider = isCalendar || account.provider === "calcom";

  async function handleSave() {
    setSaving(true);
    const patch: Record<string, unknown> = { notificationsEnabled: notifEnabled };
    if (isGmail) {
      patch.notificationScope = notifScope;
      patch.autoProcess = autoProcess;
    }
    if (isMeetingProvider) {
      patch.meetingReminderMinutes = Number(reminderMinutes);
      patch.notifyOnInvites = notifyOnInvites;
    }
    await onSave(account.id, patch);
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 900);
  }

  const statusConnected = account.status === "connected";
  const connectedSince = new Date(account.updatedAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex bg-slate-950/55 p-0 backdrop-blur-[6px] sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-panel-title"
      onClick={onClose}
    >
      <div
        className="relative mb-0 mt-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-slate-200 bg-white shadow-[0_-20px_60px_-24px_rgba(15,23,42,0.5)] sm:m-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[440px] sm:rounded-[28px] sm:border-b sm:shadow-[0_28px_80px_-20px_rgba(15,23,42,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="relative flex items-center gap-3 border-b border-slate-200 px-5 pb-5 pt-7 sm:px-6 sm:pb-5 sm:pt-6">
          <span className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300 sm:hidden" aria-hidden="true" />
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <ConnectorLogo
              provider={connector.provider}
              alt={connector.title}
              className="h-5 w-5 object-contain"
              fallback={<Icon className="h-5 w-5" />}
            />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="settings-panel-title" className="text-base font-semibold text-slate-950">
              {connector.title}
            </h2>
            <p className="text-xs text-slate-500">Connector settings</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              statusConnected
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-600"
            }`}
          >
            {statusConnected ? "Connected" : "Error"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">

          {/* Connection info */}
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40">
              Connection
            </p>
            <div className="flex flex-col divide-y divide-slate-200">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs font-medium text-slate-500">Status</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusConnected ? "bg-emerald-500" : "bg-red-500"}`} />
                  {statusConnected ? "Active" : "Error"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs font-medium text-slate-500">Auth type</span>
                <span className="text-xs font-semibold text-slate-700">
                  {account.authType === "oauth"
                    ? "OAuth 2.0"
                    : connector.category === "Databases"
                      ? "Read-only connection"
                      : "API key"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs font-medium text-slate-500">Last updated</span>
                <span className="text-xs font-semibold text-slate-700">{connectedSince}</span>
              </div>
              {account.scopes.length > 0 && (
                <div className="py-2.5">
                  <p className="mb-1.5 text-xs text-slate-500">Permissions</p>
                  <div className="flex flex-wrap gap-1">
                    {account.scopes
                      .filter((s) => !s.startsWith("openid") && !s.startsWith("email") && !s.startsWith("profile"))
                      .map((scope) => (
                        <span
                          key={scope}
                          className="rounded-md bg-white px-1.5 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-200"
                        >
                          {scope.split("/").pop()?.split(".").pop() ?? scope}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40">
              Notifications
            </p>

            {channelsLoaded && !anyChannelLinked && (
              <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true">
                  <path d="M8 2L1.5 13.5h13L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <p className="text-[13px] font-medium leading-5 text-amber-900">
                  No notification channel is linked — alerts won&apos;t be delivered.{" "}
                  <a href="/dashboard/telegram" className="font-semibold underline underline-offset-2 hover:text-amber-700">
                    Connect Telegram
                  </a>{" "}
                  or{" "}
                  <a href="/dashboard/slack" className="font-semibold underline underline-offset-2 hover:text-amber-700">
                    connect Slack
                  </a>
                  .
                </p>
              </div>
            )}

            <div className="divide-y divide-slate-200 rounded-2xl bg-slate-50 px-4">
              <SettingRow
                label="Enable notifications"
                description={`Send ${linkedChannelNames.length > 0 ? linkedChannelNames.join(" and ") : "Telegram or Slack"} alerts triggered by this connector`}
              >
                <ToggleSwitch checked={notifEnabled} onChange={setNotifEnabled} />
              </SettingRow>

              {isGmail && (
                <SettingRow
                  label="Alert scope"
                  description={`Which emails trigger a ${linkedChannelNames.length > 0 ? linkedChannelNames.join("/") : "Telegram/Slack"} alert`}
                >
                  <select
                    value={notifScope}
                    onChange={(e) => setNotifScope(e.target.value)}
                    disabled={!notifEnabled}
                    className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#D9BEF4] disabled:opacity-40"
                  >
                    {SCOPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </SettingRow>
              )}

              {isMeetingProvider && (
                <SettingRow
                  label={account.provider === "calcom" ? "Notify on bookings" : "Notify on invites"}
                  description={
                    account.provider === "calcom"
                      ? "Alert when a Cal.com booking is upcoming"
                      : "Alert when a new calendar invite arrives"
                  }
                >
                  <ToggleSwitch
                    checked={notifyOnInvites}
                    onChange={setNotifyOnInvites}
                    disabled={!notifEnabled}
                  />
                </SettingRow>
              )}
            </div>
          </div>

          {/* Behaviour — connector-specific */}
          {(isGmail || isMeetingProvider) && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40">
                Behaviour
              </p>
              <div className="divide-y divide-slate-200 rounded-2xl bg-slate-50 px-4">
                {isGmail && (
                  <SettingRow
                    label="Auto-process emails"
                    description="Riz reads and summarises new emails in the background"
                  >
                    <ToggleSwitch checked={autoProcess} onChange={setAutoProcess} />
                  </SettingRow>
                )}
                {isMeetingProvider && (
                  <SettingRow
                    label="Meeting reminder"
                    description="How early to send a pre-meeting alert"
                  >
                    <select
                      value={reminderMinutes}
                      onChange={(e) => setReminderMinutes(e.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#D9BEF4]"
                    >
                      {REMINDER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </SettingRow>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 cursor-pointer rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || saved}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConnectorRow({
  connector,
  linkedConnector,
  linkedAccounts,
  onSetup,
  onAddAccount,
  onEditAccount,
  onUnlink,
  onRemoveAccount,
  onSaveSettings,
  telegramLinked,
  slackLinked,
}: {
  connector: ConnectorCatalogItem;
  linkedConnector?: ConnectorSummary;
  linkedAccounts: ConnectorSummary[];
  onSetup: () => void;
  onAddAccount: () => void;
  onEditAccount: (account: ConnectorSummary) => void;
  onUnlink: () => void;
  onRemoveAccount: (id: string, label: string) => void;
  onSaveSettings: (id: string, metadata: Record<string, unknown>) => Promise<void>;
  telegramLinked: boolean | null;
  slackLinked: boolean | null;
}) {
  const Icon = connector.icon;
  const multi = isMultiAccount(connector.provider);
  const [settingsAccount, setSettingsAccount] = useState<ConnectorSummary | null>(null);

  const connected = !multi && Boolean(linkedConnector);

  return (
    <>
      <article
        className={`group flex min-h-[230px] min-w-0 flex-col justify-between rounded-2xl border bg-white p-3.5 transition duration-200 sm:p-4 ${
          connected || (multi && linkedAccounts.length > 0)
            ? "border-emerald-200 bg-emerald-50/30"
            : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]"
        }`}
      >
        <div>
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <ConnectorLogo
                provider={connector.provider}
                alt={connector.title}
                className="size-6 object-contain"
                fallback={<Icon className="size-6" />}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="truncate text-base font-semibold leading-5 text-black">{connector.title}</h2>
                {!multi && <ConnectorBadge connector={linkedConnector} />}
                {multi && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      linkedAccounts.length > 0
                        ? "bg-emerald-50 text-emerald-500"
                        : "bg-slate-50 text-slate-500"
                    }`}
                  >
                    {linkedAccounts.length > 0 ? `${linkedAccounts.length} connected` : "Not connected"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs font-medium text-black/70">
                {connector.category} · {connector.authType === "oauth" ? "OAuth" : connector.category === "Databases" ? "Read-only" : "API credentials"}
              </p>
            </div>
          </div>

          <p className="mt-3 line-clamp-3 text-sm leading-6 text-black/70 sm:min-h-12">
            {connector.description}
          </p>

          {!multi && linkedConnector && (
            <p className="mt-2 truncate text-xs font-semibold text-slate-900">
              Connected as {linkedConnector.label}
            </p>
          )}
        </div>

        {/* Named accounts list for multi-account DB providers */}
        {multi && linkedAccounts.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
            {linkedAccounts.map((account) => (
              <div key={account.id} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900">{account.label}</span>
                <button
                  type="button"
                  title="Account settings"
                  onClick={() => setSettingsAccount(account)}
                  className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-950 hover:text-white"
                >
                  <GearIcon />
                </button>
                <button
                  type="button"
                  onClick={() => onEditAccount(account)}
                  className="shrink-0 cursor-pointer rounded-full px-2 py-1 text-xs font-semibold text-black/40 transition hover:bg-slate-100 hover:text-black"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveAccount(account.id, account.label)}
                  className="shrink-0 cursor-pointer rounded-full px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          {!multi && linkedConnector && (
            <button
              type="button"
              title="Connector settings"
              onClick={() => setSettingsAccount(linkedConnector)}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-white"
            >
              <GearIcon />
            </button>
          )}
          {multi ? (
            <button
              className="inline-flex h-10 min-w-24 flex-1 cursor-pointer items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.98]"
              onClick={onAddAccount}
              type="button"
            >
              Add account
            </button>
          ) : connector.authType === "oauth" ? (
            linkedConnector ? (
              <button
                className="ml-auto inline-flex h-10 min-w-24 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-normal text-black/70 transition hover:bg-white hover:text-black"
                onClick={onUnlink}
                type="button"
              >
                Disconnect
              </button>
            ) : (
              <button
                className="ml-auto inline-flex h-10 min-w-24 cursor-pointer items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.98]"
                onClick={onSetup}
                type="button"
              >
                Connect
              </button>
            )
          ) : (
            <>
              <button
                className="inline-flex h-10 min-w-24 flex-1 cursor-pointer items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.98]"
                onClick={onSetup}
                type="button"
              >
                {linkedConnector ? "Edit setup" : "Set up"}
              </button>
              {linkedConnector && (
                <button
                  className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-normal text-black/70 transition hover:bg-white hover:text-black"
                  onClick={onUnlink}
                  type="button"
                >
                  Disconnect
                </button>
              )}
            </>
          )}
        </div>
      </article>

      {settingsAccount && (
        <SettingsPanel
          connector={connector}
          account={settingsAccount}
          onSave={onSaveSettings}
          onClose={() => setSettingsAccount(null)}
          telegramLinked={telegramLinked}
          slackLinked={slackLinked}
        />
      )}
    </>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M13.3 9.3a1.2 1.2 0 0 0 .24 1.32l.04.04a1.45 1.45 0 0 1-2.05 2.05l-.04-.04a1.2 1.2 0 0 0-1.32-.24 1.2 1.2 0 0 0-.73 1.1V13.6a1.45 1.45 0 0 1-2.9 0v-.07a1.2 1.2 0 0 0-.78-1.1 1.2 1.2 0 0 0-1.32.24l-.04.04a1.45 1.45 0 0 1-2.05-2.05l.04-.04A1.2 1.2 0 0 0 2.63 9.3a1.2 1.2 0 0 0-1.1-.73H1.4a1.45 1.45 0 0 1 0-2.9h.07a1.2 1.2 0 0 0 1.1-.78 1.2 1.2 0 0 0-.24-1.32l-.04-.04A1.45 1.45 0 0 1 4.34 1.48l.04.04a1.2 1.2 0 0 0 1.32.24h.06a1.2 1.2 0 0 0 .73-1.1V.6a1.45 1.45 0 0 1 2.9 0v.07a1.2 1.2 0 0 0 .73 1.1 1.2 1.2 0 0 0 1.32-.24l.04-.04a1.45 1.45 0 0 1 2.05 2.05l-.04.04a1.2 1.2 0 0 0-.24 1.32v.06a1.2 1.2 0 0 0 1.1.73h.06a1.45 1.45 0 0 1 0 2.9h-.07a1.2 1.2 0 0 0-1.1.73Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function SetupDialog({
  connector,
  editAccount,
  error,
  onClose,
  onSubmit,
  submitting,
}: {
  connector: ConnectorCatalogItem;
  editAccount: ConnectorSummary | null;
  error: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, connector: ConnectorCatalogItem) => void;
  submitting: boolean;
}) {
  const Icon = connector.icon;
  const multi = isMultiAccount(connector.provider);
  const isOAuth = connector.authType === "oauth";
  const isGoogleOAuth = connector.provider === "gmail" || connector.provider === "calendar";
  // Cal.com's OAuth only covers cal.eu accounts today - it carries a manual
  // API-key fallback for everyone else, shown alongside the Connect button.
  const showManualFallback = Boolean(connector.fields?.length);
  const isEdit = Boolean(editAccount);
  const oauthHref = `/api/connectors/${connector.provider}/start?returnTo=%2Fdashboard%2Fconnectors%3Fconnected%3D${connector.provider}`;
  const [closing, setClosing] = useState(false);
  // Figma has no "list my teams" API — the team a webhook gets registered
  // for has to come from the user, so it's appended to the OAuth start URL.
  const isFigma = connector.provider === "figma";
  const [figmaTeamId, setFigmaTeamId] = useState("");
  const figmaOauthHref = `${oauthHref}&teamId=${encodeURIComponent(figmaTeamId.trim())}`;
  // Box webhooks watch a single folder, not "the whole account" — same idea
  // as Figma's teamId, the folder id has to come from the user up front.
  const isBox = connector.provider === "box";
  const [boxFolderId, setBoxFolderId] = useState("");
  const boxOauthHref = `${oauthHref}&folderId=${encodeURIComponent(boxFolderId.trim())}`;
  const requiresExtraField = isFigma || isBox;
  const extraFieldMissing = (isFigma && !figmaTeamId.trim()) || (isBox && !boxFolderId.trim());
  const resolvedOauthHref = isFigma ? figmaOauthHref : isBox ? boxOauthHref : oauthHref;

  function handleClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 140);
  }

  const title = isEdit
    ? `Edit "${editAccount!.label}"`
    : multi
      ? `Add ${connector.title} account`
      : `Setup ${connector.title}`;

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-slate-950/55 p-0 backdrop-blur-[6px] sm:px-4 sm:py-8 ${closing ? "dialog-backdrop-exit" : "dialog-backdrop-enter"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="connector-setup-title"
      onClick={handleClose}
    >
      <form
        className={`relative mb-0 mt-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-slate-200 bg-white shadow-[0_-20px_60px_-24px_rgba(15,23,42,0.5)] sm:m-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[620px] sm:rounded-[28px] sm:border-b sm:shadow-[0_28px_80px_-20px_rgba(15,23,42,0.45)] ${closing ? "dialog-panel-exit" : "dialog-panel-enter"}`}
        onSubmit={(e) => onSubmit(e, connector)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-slate-200 px-5 pb-5 pt-7 sm:px-6 sm:pb-6 sm:pt-6">
          <span className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300 sm:hidden" aria-hidden="true" />
          <button
            className="absolute right-4 top-4 flex size-9 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40"
            onClick={handleClose}
            type="button"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>

          <p className="pr-12 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#D96420]">
            {isEdit ? "Edit connection" : "Connect an integration"}
          </p>
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
              <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-slate-950" id="connector-setup-title">
                {title}
              </h2>
              <p className="mt-1.5 max-w-[29rem] text-[13px] leading-5 text-slate-500">
                {isOAuth
                  ? connector.description
                  : isEdit
                  ? "Update the saved connector label or rotate credentials without changing how rizly uses this source."
                  : multi
                    ? "Name this account and add read-only credentials. Credentials are encrypted before storage."
                    : "Add credentials to create an encrypted connector rizly can use when you ask."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-6 px-5 py-5 sm:px-6 sm:py-6">
            {isOAuth && (
              <div className="rounded-2xl bg-slate-50 px-4 py-4 sm:px-5">
                {isGoogleOAuth && (
                  <p className="mb-3 text-left text-[12px] leading-5 text-slate-600">
                    {connector.provider === "gmail"
                      ? "Rizly will read Gmail messages and contacts to triage and draft replies, and send email only after your approval. Relevant content is processed by contracted AI providers solely to deliver these features."
                      : "Rizly will read calendar events for schedules and conflict checks, and create or update events only after your approval."}{" "}
                    Tokens are encrypted, access can be revoked at any time, and Google data is never sold or used to train generalized AI models.{" "}
                    <a href="/privacy#google-user-data" className="font-medium text-slate-900 underline underline-offset-2">
                      Google data privacy details
                    </a>
                  </p>
                )}
                {isFigma && (
                  <div className="mb-3">
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
                  <div className="mb-3">
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
                  className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/50 ${
                    requiresExtraField && extraFieldMissing ? "cursor-not-allowed opacity-50" : ""
                  }`}
                >
                  Continue to {connector.title}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                  </svg>
                </a>
                {connector.provider === "calcom" && (
                  <a
                    href={`${oauthHref}&region=eu`}
                    className="mt-3 block text-center text-xs font-medium text-black/40 underline-offset-2 hover:text-black hover:underline"
                  >
                    Have a Cal.com EU (cal.eu) account? Connect via cal.eu instead
                  </a>
                )}
              </div>
            )}

            {(!isOAuth || showManualFallback) && (
              <div>
                <div className="mb-4">
                  <p className="text-sm font-semibold text-slate-950">
                    {isOAuth ? `Or connect with an API key instead` : "Connection details"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {isOAuth
                      ? "Optional — skip this if you used the button above."
                      : connector.category === "Databases"
                        ? "All fields are required. Access is verified read-only before saving."
                        : "All fields are required. Credentials are encrypted at rest."}
                  </p>
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
                  {multi && (
                    <label className="flex flex-col gap-2 text-sm">
                      <span className="font-medium text-slate-700">Account name</span>
                      <input
                        className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#D9BEF4] focus:ring-4 focus:ring-[#D9BEF4]/10"
                        name="_name"
                        placeholder={`e.g. Production ${connector.title}, Staging DB`}
                        defaultValue={editAccount?.label ?? ""}
                        required
                      />
                      <span className="text-xs leading-5 text-slate-500">
                        Riz uses this name when you have multiple {connector.title} accounts connected.
                      </span>
                    </label>
                  )}

                  {connector.fields?.map((field) => (
                    <label className="flex flex-col gap-2 text-sm" key={field.name}>
                      <span className="font-medium text-slate-700">{field.label}</span>
                      <input
                        className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#D9BEF4] focus:ring-4 focus:ring-[#D9BEF4]/10"
                        name={field.name}
                        placeholder={isEdit ? "Leave blank to keep existing credentials" : field.placeholder}
                        required={!isEdit && field.required !== false}
                        type={field.type ?? "text"}
                        autoComplete="off"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(!isOAuth || showManualFallback) && (
            <div className="sticky bottom-0 border-t border-slate-200 bg-slate-50/70 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:py-4">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:w-auto sm:justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-11 cursor-pointer rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-11 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/50 sm:px-5"
                >
                  {submitting ? (
                    "Saving…"
                  ) : (
                    <>
                      {isEdit ? "Save changes" : isOAuth ? "Connect with API key" : `Connect ${connector.title}`}
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function ConnectorBadge({ connector }: { connector?: ConnectorSummary }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
        connector
          ? "bg-emerald-50 text-emerald-500"
          : "bg-slate-50 text-slate-500"
      }`}
    >
      {connector ? "Connected" : "Not connected"}
    </span>
  );
}
