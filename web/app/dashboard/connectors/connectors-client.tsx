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
  GoogleDocsIcon,
  GoogleSheetsIcon,
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
export type MultiAccountProvider = (typeof MULTI_ACCOUNT_PROVIDERS)[number];
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
  provider:
    | "gmail"
    | "calendar"
    | "calcom"
    | "razorpay"
    | "stripe"
    | "postgres"
    | "mongodb"
    | "slack"
    | "notion"
    | "paypal"
    | "github"
    | "mpesa"
    | "discord"
    | "google_workspace"
    | "jira"
    | "pagerduty"
    | "trello"
    | "airtable"
    | "twilio"
    | "shopify"
    | "calendly"
    | "typeform"
    | "gumroad"
    | "lemonsqueezy"
    | "dropbox"
    | "figma"
    | "uptimerobot"
    | "quickbooks"
    | "xero"
    | "wise"
    | "bamboohr"
    | "deel"
    | "box"
    | "statuspage"
    | "betterstack";
  title: string;
  description: string;
  category: "Google" | "Scheduling" | "Payments" | "Databases" | "Team" | "APIs";
  authType: "oauth" | "manual";
  icon: typeof GmailIcon;
  /** Skip the shared provider logo lookup and always render `icon` — for catalog entries that share a provider (and its logo) with sibling cards but need their own distinct icon, e.g. Drive/Sheets/Docs under one google_workspace grant. */
  forceIcon?: boolean;
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
  // These three share one OAuth grant/token (provider "google_workspace" —
  // Sheets/Docs scopes have no per-app split on Google's side, see
  // connector.service.ts) but render as separate cards so each app gets its
  // own logo; connecting or disconnecting any one of them applies to all three.
  {
    id: "google_drive",
    provider: "google_workspace",
    title: "Google Drive",
    description: "Upload files and create folders from an automation. Shares one grant with Sheets/Docs.",
    category: "Google",
    authType: "oauth",
    icon: GoogleDriveIcon,
    forceIcon: true,
  },
  {
    id: "google_sheets",
    provider: "google_workspace",
    title: "Google Sheets",
    description: "Append and read spreadsheet rows from an automation. Shares one grant with Drive/Docs.",
    category: "Google",
    authType: "oauth",
    icon: GoogleSheetsIcon,
    forceIcon: true,
  },
  {
    id: "google_docs",
    provider: "google_workspace",
    title: "Google Docs",
    description: "Create and edit documents from an automation. Shares one grant with Drive/Sheets.",
    category: "Google",
    authType: "oauth",
    icon: GoogleDocsIcon,
    forceIcon: true,
  },
  {
    id: "calcom",
    provider: "calcom",
    title: "Cal.com",
    description: "View bookings, create meetings, and schedule meeting notifications through Cal.com.",
    category: "Scheduling",
    authType: "oauth",
    icon: CalComIcon,
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
    description: "Lightweight, single-channel option: read one bot-accessible channel and post approved messages through an optional webhook.",
    category: "Team",
    authType: "manual",
    icon: DiscordIcon,
    fields: [
      { name: "botToken", label: "Bot token", type: "password", placeholder: "Discord bot token" },
      { name: "channelId", label: "Channel ID", placeholder: "123456789012345678" },
      { name: "guildId", label: "Server ID (optional, enables message links)", placeholder: "123456789012345678", required: false },
      { name: "webhookUrl", label: "Channel webhook URL (optional, enables posting)", type: "password", placeholder: "https://discord.com/api/webhooks/...", required: false },
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
    description: "Automations that fire when a monitor goes up or down. Add a Web-Hook Alert Contact manually.",
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
    description: "Automations that fire on a new invoice or a paid invoice.",
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
    description: "Automations that fire on a new time-off request or a new hire.",
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
    description: "Automations that fire on a new incident or an incident status update.",
    category: "APIs",
    authType: "manual",
    icon: StatuspageIcon,
    fields: [
      { name: "pageId", label: "Page ID", placeholder: "From your Statuspage page settings" },
      { name: "apiKey", label: "API Key (optional)", type: "password", placeholder: "From Statuspage Account Settings -> API Info", required: false },
    ],
  },
  {
    id: "betterstack",
    provider: "betterstack",
    title: "Better Stack",
    description: "Automations that fire when an incident starts or resolves.",
    category: "APIs",
    authType: "manual",
    icon: BetterStackIcon,
    fields: [
      { name: "apiKey", label: "API Key", type: "password", placeholder: "From Better Stack Settings -> API tokens" },
    ],
  },
];

export const categories = ["All", "Google", "Scheduling", "Payments", "Databases", "Team", "APIs"] as const;

export const ENABLED_CONNECTOR_PROVIDERS = new Set<string>([
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
  const [activeTab, setActiveTab] = useState<"catalog" | "connected">("catalog");
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [setupConnector, setSetupConnector] = useState<ConnectorCatalogItem | null>(null);
  const [setupEditAccount, setSetupEditAccount] = useState<ConnectorSummary | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const [slackLinked, setSlackLinked] = useState<boolean | null>(null);

  async function loadConnectors() {
    try {
      const response = await fetch("/api/connectors");
      if (!response.ok) throw new Error("Failed to load connectors");
      const data = (await response.json()) as unknown;
      setConnectors(Array.isArray(data) ? (data as ConnectorSummary[]) : []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load connectors");
    }
  }

  useEffect(() => {
    void loadConnectors();
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((d: { onboarding?: { telegramLinked?: boolean; slackLinked?: boolean } }) => {
        setTelegramLinked(Boolean(d.onboarding?.telegramLinked));
        setSlackLinked(Boolean(d.onboarding?.slackLinked));
      })
      .catch(() => {
        setTelegramLinked(false);
        setSlackLinked(false);
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("setup");
    if (provider && catalogByProvider.has(provider)) {
      const connector = catalogByProvider.get(provider)!;
      setSetupConnector(connector);
      setSetupEditAccount(null);
    }
    const tab = params.get("tab");
    if (tab === "connected") {
      setActiveTab("connected");
    }
  }, []);

  const visibleConnectors = useMemo(
    () =>
      connectors
        .map((c) => (c.provider === "discord_surface" ? { ...c, provider: "discord" } : c))
        .filter((connector) => visibleConnectorProviders.has(connector.provider)),
    [connectors],
  );

  const connectedByProvider = useMemo(
    () => new Map(visibleConnectors.map((c) => [c.provider, c])),
    [visibleConnectors],
  );

  const connectedByProviderAll = useMemo(() => {
    const map = new Map<string, ConnectorSummary[]>();
    for (const c of visibleConnectors) {
      const existing = map.get(c.provider) ?? [];
      map.set(c.provider, [...existing, c]);
    }
    return map;
  }, [visibleConnectors]);

  const filteredCatalog = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return shownCatalog.filter((connector) => {
      const categoryOk = activeCategory === "All" || connector.category === activeCategory;
      const queryOk =
        !query ||
        connector.title.toLowerCase().includes(query) ||
        connector.description.toLowerCase().includes(query) ||
        connector.provider.toLowerCase().includes(query);
      return categoryOk && queryOk;
    });
  }, [activeCategory, searchQuery]);

  async function deleteConnector(connector: ConnectorCatalogItem) {
    setActionError(null);
    const response = await fetch(`/api/connectors/${connector.provider}`, { method: "DELETE" });
    if (!response.ok) {
      setActionError(`Could not unlink ${connector.title}`);
      return;
    }
    await loadConnectors();
  }

  async function deleteConnectorById(accountId: string, label: string) {
    setActionError(null);
    const response = await fetch(`/api/connectors/account/${accountId}`, { method: "DELETE" });
    if (!response.ok) {
      setActionError(`Could not remove "${label}"`);
      return;
    }
    await loadConnectors();
  }

  async function saveConnectorSettings(accountId: string, metadata: Record<string, unknown>) {
    setActionError(null);
    const response = await fetch(`/api/connectors/account/${accountId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ metadata }),
    });
    if (!response.ok) {
      setActionError("Could not save connector settings");
      return;
    }
    await loadConnectors();
  }

  async function startDiscordOAuth() {
    try {
      const res = await fetch("/api/onboarding/discord/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnTo: window.location.pathname }),
      });
      const data = (await res.json()) as { installUrl?: string | null };
      if (data.installUrl) {
        window.location.href = data.installUrl;
      } else {
        setActionError("Discord connection initialization failed. Try again.");
      }
    } catch {
      setActionError("Could not connect Discord.");
    }
  }

  async function saveManualConnector(
    event: FormEvent<HTMLFormElement>,
    connector: ConnectorCatalogItem,
    editAccount: ConnectorSummary | null,
  ) {
    event.preventDefault();
    if (!connector.fields) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const secret = Object.fromEntries(
      connector.fields.map((field) => [field.name, String(formData.get(field.name) ?? "")]),
    );
    const name = isMultiAccount(connector.provider)
      ? String(formData.get("_name") ?? "").trim() || connector.title
      : connector.title;

    setSetupError(null);
    setSetupSubmitting(true);

    try {
      const response = await fetch("/api/connectors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: connector.provider,
          authType: "manual",
          label: name,
          accountId: editAccount?.id ?? undefined,
          secret,
          metadata: { source: "connectors_page" },
        }),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { message?: string } | null;
        setSetupError(error?.message || `Could not save ${connector.title}`);
        return;
      }

      form.reset();
      setSetupConnector(null);
      setSetupEditAccount(null);
      await loadConnectors();
    } catch {
      setSetupError(`Could not reach connector service for ${connector.title}.`);
    } finally {
      setSetupSubmitting(false);
    }
  }

  const connectedCount = visibleConnectors.length;

  return (
    <main className="min-h-screen bg-[#121214] text-white/90 font-sans antialiased">
      <section className="mx-auto flex w-full max-w-[1240px] flex-col px-4 py-8 sm:px-8">
        {/* ── Flat page header ─────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-white/90">Plugins</h1>
          <CreditsBadge />
        </header>

        {/* ── Load / Action Error Toasts ──────────────────────────── */}
        {loadError && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
            </svg>
            {loadError}
          </div>
        )}
        {actionError && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
            </svg>
            {actionError}
          </div>
        )}

        {/* ── Search bar ───────────────────────────────────────────── */}
        <div className="relative mt-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connectors, skills, data sources"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-11 pr-9 text-sm text-white/90 placeholder-white/40 outline-none transition focus:border-white/20 focus:bg-white/[0.05]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/90"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Section header: view switcher + category filter ────────── */}
        <div className="mt-8 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("catalog")}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    activeTab === "catalog" ? "bg-[#ffffff] text-black" : "text-white/60 hover:text-white/90"
                  }`}
                >
                  Connectors
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("connected")}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    activeTab === "connected" ? "bg-[#ffffff] text-black" : "text-white/60 hover:text-white/90"
                  }`}
                >
                  Connected
                  {connectedCount > 0 && (
                    <span className={activeTab === "connected" ? "ml-1.5 text-slate-500" : "ml-1.5 text-white/40"}>
                      {connectedCount}
                    </span>
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-white/50">
                {activeTab === "catalog"
                  ? "Connect apps and APIs to share your context."
                  : "Accounts your assistant currently has access to."}
              </p>
            </div>
          </div>

          {/* Category Filter Pills (shown when in Catalog tab) */}
          {activeTab === "catalog" && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      active
                        ? "bg-[#ffffff] text-black font-semibold"
                        : "text-white/50 hover:bg-white/5 hover:text-white/80"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Content View Section ──────────────────────────────────── */}
        <section className="mt-6">
          {activeTab === "connected" ? (
            /* Connected Accounts View */
            visibleConnectors.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-white/5 text-white/40 ring-1 ring-white/10">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">No connected accounts yet</h3>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-white/50">
                  Connect your Google Workspace, databases, or workflow apps from the catalog to enable automated actions and data sync.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("catalog")}
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#ffffff] px-5 text-xs font-bold text-black transition hover:opacity-90"
                >
                  Browse connectors
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {visibleConnectors.map((account) => {
                  const catalogItem = catalogByProvider.get(account.provider);
                  const Icon = catalogItem?.icon;
                  const connectedDate = new Date(account.updatedAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  return (
                    <article
                      key={account.id}
                      className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-colors duration-200 hover:border-white/20"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex size-11 items-center justify-center overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                            <ConnectorLogo
                              provider={account.provider}
                              alt={account.label}
                              className="size-6 object-contain"
                              fallback={
                                Icon ? <Icon className="size-6" /> : (
                                  <span className="text-xs font-bold uppercase text-white/60">
                                    {account.provider.slice(0, 2)}
                                  </span>
                                )
                              }
                            />
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/60">
                            <span className="size-1.5 rounded-full bg-emerald-400" />
                            Connected
                          </span>
                        </div>

                        <div className="mt-3">
                          <h3 className="truncate text-base font-semibold text-white">{account.label}</h3>
                          <p className="truncate text-xs font-medium text-white/50">
                            {account.provider === "google_workspace"
                              ? "Google Drive, Sheets & Docs"
                              : (catalogItem?.title ?? account.provider)}{" "}
                            · {account.authType === "oauth" ? "OAuth 2.0" : "API Credentials"}
                          </p>
                        </div>

                        <p className="mt-2 text-[11px] text-white/40">
                          Connected on {connectedDate}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                        {catalogItem && (
                          <button
                            type="button"
                            onClick={() => setSetupEditAccount(account)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 transition hover:text-white"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="3" />
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                            </svg>
                            Settings
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void deleteConnectorById(account.id, account.label)}
                          className="ml-auto text-xs font-semibold text-red-400 transition hover:text-red-300 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : (
            /* Catalog View Grid */
            filteredCatalog.length === 0 ? (
              <p className="py-16 text-center text-sm text-white/50">
                No integrations found matching &quot;{searchQuery}&quot;.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCatalog.map((connector) => (
                  <ConnectorRow
                    key={connector.id}
                    connector={connector}
                    linkedConnector={connectedByProvider.get(connector.provider)}
                    linkedAccounts={connectedByProviderAll.get(connector.provider) ?? []}
                    onSetup={() => {
                      if (connector.provider === "discord") {
                        void startDiscordOAuth();
                        return;
                      }
                      setSetupEditAccount(null);
                      setSetupConnector(connector);
                    }}
                    onAddAccount={() => {
                      setSetupEditAccount(null);
                      setSetupConnector(connector);
                    }}
                    onEditAccount={(account) => {
                      setSetupEditAccount(account);
                      setSetupConnector(connector);
                    }}
                    onUnlink={() => void deleteConnector(connector)}
                    onRemoveAccount={(id, label) => void deleteConnectorById(id, label)}
                    onSaveSettings={saveConnectorSettings}
                    telegramLinked={telegramLinked}
                    slackLinked={slackLinked}
                  />
                ))}
              </div>
            )
          )}
        </section>
      </section>

      {/* Setup / Modal Dialog */}
      {setupConnector && (
        <SetupDialog
          connector={setupConnector}
          editAccount={setupEditAccount}
          error={setupError}
          onClose={() => {
            setSetupConnector(null);
            setSetupEditAccount(null);
            setSetupError(null);
          }}
          onSubmit={(e, c) => void saveManualConnector(e, c, setupEditAccount)}
          submitting={setupSubmitting}
        />
      )}
    </main>
  );
}

export function ToggleSwitch({
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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-white/80" : "bg-white/20"
      }`}
    >
      <span
        className={`pointer-events-none inline-block size-5 rounded-full bg-[#ffffff] shadow-md transform ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">{label}</p>
        {description && <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{description}</p>}
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

export function SettingsPanel({
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-panel-title"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#161618] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3.5 border-b border-white/10 p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#ffffff] p-2 shadow-md">
            <ConnectorLogo
              provider={connector.provider}
              alt={connector.title}
              className="size-6 object-contain"
              fallback={<Icon className="size-6 text-slate-800" />}
            />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="settings-panel-title" className="text-base font-bold text-white">
              {connector.title}
            </h2>
            <p className="text-xs text-white/50">Connector Settings & Preferences</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              statusConnected ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {statusConnected ? "Active" : "Error"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-xl text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-5">
          {/* Connection Overview */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Connection Details</p>
            <div className="divide-y divide-white/10 text-xs">
              <div className="flex justify-between py-2">
                <span className="text-white/50">Status</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Connected
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-white/50">Auth Type</span>
                <span className="font-semibold text-white/80">
                  {account.authType === "oauth" ? "OAuth 2.0" : "API Credentials"}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-white/50">Last Active</span>
                <span className="font-semibold text-white/80">{connectedSince}</span>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Alerts & Notifications</p>
            {channelsLoaded && !anyChannelLinked && (
              <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 leading-relaxed">
                ⚠️ No alert channels linked.{" "}
                <a href="/dashboard/telegram" className="underline font-semibold hover:text-amber-200">Connect Telegram</a> or{" "}
                <a href="/dashboard/slack" className="underline font-semibold hover:text-amber-200">Connect Slack</a> to receive alerts.
              </div>
            )}
            <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] px-4">
              <SettingRow
                label="Enable Notifications"
                description={`Send ${linkedChannelNames.length > 0 ? linkedChannelNames.join(" / ") : "Telegram/Slack"} alerts`}
              >
                <ToggleSwitch checked={notifEnabled} onChange={setNotifEnabled} />
              </SettingRow>

              {isGmail && (
                <SettingRow label="Alert Scope" description="Which emails trigger an alert">
                  <select
                    value={notifScope}
                    onChange={(e) => setNotifScope(e.target.value)}
                    disabled={!notifEnabled}
                    className="rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white outline-none focus:border-white/30"
                  >
                    {SCOPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#161618] text-white">{o.label}</option>
                    ))}
                  </select>
                </SettingRow>
              )}

              {isMeetingProvider && (
                <SettingRow label="Meeting Invites" description="Alert on new event invitations">
                  <ToggleSwitch checked={notifyOnInvites} onChange={setNotifyOnInvites} disabled={!notifEnabled} />
                </SettingRow>
              )}
            </div>
          </div>

          {/* Behavior Settings */}
          {(isGmail || isMeetingProvider) && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Behavior & Automation</p>
              <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] px-4">
                {isGmail && (
                  <SettingRow label="Auto-Process Emails" description="Riz reads and triages incoming email in background">
                    <ToggleSwitch checked={autoProcess} onChange={setAutoProcess} />
                  </SettingRow>
                )}
                {isMeetingProvider && (
                  <SettingRow label="Meeting Reminder" description="Minutes prior to send meeting alert">
                    <select
                      value={reminderMinutes}
                      onChange={(e) => setReminderMinutes(e.target.value)}
                      className="rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white outline-none focus:border-white/30"
                    >
                      {REMINDER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} className="bg-[#161618] text-white">{o.label}</option>
                      ))}
                    </select>
                  </SettingRow>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-white/[0.02] p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || saved}
            className="rounded-xl bg-[#ffffff] px-5 py-2 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {saved ? "Saved ✓" : saving ? "Saving..." : "Save Settings"}
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
  const isMultiConnected = multi && linkedAccounts.length > 0;

  return (
    <>
      <article
        className={`group flex min-h-[220px] flex-col justify-between rounded-2xl border p-4 backdrop-blur-sm transition-all duration-200 ${
          connected || isMultiConnected
            ? "border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.06] to-emerald-500/[0.02]"
            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05] hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)]"
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#ffffff] p-2 shadow-md ring-1 ring-white/20">
                {connector.forceIcon ? (
                  <Icon className="size-6 text-slate-800" />
                ) : (
                  <ConnectorLogo
                    provider={connector.provider}
                    alt={connector.title}
                    className="size-6 object-contain"
                    fallback={<Icon className="size-6 text-slate-800" />}
                  />
                )}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold tracking-tight text-white">{connector.title}</h3>
                <p className="text-[11px] font-medium text-white/50">
                  {connector.category} · {connector.authType === "oauth" ? "OAuth 2.0" : "API Key"}
                </p>
              </div>
            </div>

            {/* Badge */}
            {multi ? (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  linkedAccounts.length > 0
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border border-white/10 bg-white/5 text-white/40"
                }`}
              >
                {linkedAccounts.length > 0 ? `${linkedAccounts.length} connected` : "Not connected"}
              </span>
            ) : (
              <ConnectorBadge connector={linkedConnector} />
            )}
          </div>

          <p className="mt-3.5 line-clamp-2 text-xs leading-relaxed text-white/60">
            {connector.description}
          </p>

          {!multi && linkedConnector && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Connected as <span className="font-semibold text-white">{linkedConnector.label}</span>
            </div>
          )}
        </div>

        {/* Multi accounts list */}
        {multi && linkedAccounts.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5">
            {linkedAccounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-2.5 py-1.5 text-xs">
                <span className="truncate font-medium text-white">{acc.label}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSettingsAccount(acc)}
                    className="p-1 text-white/40 hover:text-white"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveAccount(acc.id, acc.label)}
                    className="p-1 text-red-400 hover:text-red-300 text-[11px]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Card Footer Actions */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
          {!multi && linkedConnector && (
            <button
              type="button"
              onClick={() => setSettingsAccount(linkedConnector)}
              className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
              title="Settings"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </button>
          )}

          {multi ? (
            <button
              type="button"
              onClick={onAddAccount}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#ffffff] px-3 text-xs font-semibold text-black transition hover:opacity-90"
            >
              + Add Account
            </button>
          ) : connector.authType === "oauth" ? (
            linkedConnector ? (
              <button
                type="button"
                onClick={onUnlink}
                className="ml-auto rounded-xl px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={onSetup}
                className="ml-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-[#ffffff] px-4 text-xs font-bold text-black transition hover:opacity-90"
              >
                Connect
              </button>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={onSetup}
                className="inline-flex h-8 flex-1 items-center justify-center rounded-xl bg-[#ffffff] px-3 text-xs font-bold text-black transition hover:opacity-90"
              >
                {linkedConnector ? "Edit Credentials" : "Set up"}
              </button>
              {linkedConnector && (
                <button
                  type="button"
                  onClick={onUnlink}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
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
  const showManualFallback = Boolean(connector.fields?.length);
  const isEdit = Boolean(editAccount);
  const oauthHref = `/api/connectors/${connector.provider}/start?returnTo=%2Fdashboard%2Fconnectors%3Fconnected%3D${connector.provider}`;

  const isFigma = connector.provider === "figma";
  const [figmaTeamId, setFigmaTeamId] = useState("");
  const figmaOauthHref = `${oauthHref}&teamId=${encodeURIComponent(figmaTeamId.trim())}`;

  const isBox = connector.provider === "box";
  const [boxFolderId, setBoxFolderId] = useState("");
  const boxOauthHref = `${oauthHref}&folderId=${encodeURIComponent(boxFolderId.trim())}`;

  const requiresExtraField = isFigma || isBox;
  const extraFieldMissing = (isFigma && !figmaTeamId.trim()) || (isBox && !boxFolderId.trim());
  const resolvedOauthHref = isFigma ? figmaOauthHref : isBox ? boxOauthHref : oauthHref;

  const title = isEdit
    ? `Edit "${editAccount!.label}"`
    : multi
      ? `Add ${connector.title} account`
      : `Setup ${connector.title}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connector-setup-title"
      onClick={onClose}
    >
      <form
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#161618] shadow-2xl"
        onSubmit={(e) => onSubmit(e, connector)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3.5 border-b border-white/10 p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#ffffff] p-2 shadow-md">
            <ConnectorLogo
              provider={connector.provider}
              alt={connector.title}
              className="size-7 object-contain"
              fallback={<Icon className="size-7 text-slate-800" />}
            />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-white" id="connector-setup-title">
              {title}
            </h2>
            <p className="text-xs text-white/50">{connector.category} Integration</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-xl text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-5">
          <p className="text-xs leading-relaxed text-white/70">{connector.description}</p>

          {isOAuth && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              {isGoogleOAuth && (
                <p className="text-[11px] leading-relaxed text-white/60">
                  Tokens are stored encrypted. Data is used strictly for assistant features and never training generalized models.{" "}
                  <a href="/privacy#google-user-data" className="underline text-white hover:text-white">
                    Google Privacy Policy
                  </a>
                </p>
              )}

              {isFigma && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-white/80">Figma Team ID</label>
                  <input
                    type="text"
                    value={figmaTeamId}
                    onChange={(e) => setFigmaTeamId(e.target.value)}
                    placeholder="e.g. 1234567890"
                    className="h-10 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>
              )}

              {isBox && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-white/80">Box Folder ID</label>
                  <input
                    type="text"
                    value={boxFolderId}
                    onChange={(e) => setBoxFolderId(e.target.value)}
                    placeholder="e.g. 12345678"
                    className="h-10 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>
              )}

              <a
                href={resolvedOauthHref}
                aria-disabled={requiresExtraField && extraFieldMissing}
                onClick={(e) => {
                  if (requiresExtraField && extraFieldMissing) e.preventDefault();
                }}
                className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#ffffff] font-bold text-xs text-black transition hover:opacity-90 ${
                  requiresExtraField && extraFieldMissing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Continue to {connector.title} OAuth
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                </svg>
              </a>
            </div>
          )}

          {(!isOAuth || showManualFallback) && (
            <div className="space-y-4">
              {isOAuth && (
                <div className="relative flex items-center justify-center text-xs text-white/40 my-3">
                  <span className="h-px bg-white/10 w-full" />
                  <span className="bg-[#161618] px-3 font-semibold uppercase tracking-wider text-[10px]">Or API Key</span>
                  <span className="h-px bg-white/10 w-full" />
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-medium text-red-300">
                  {error}
                </div>
              )}

              {multi && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white/80">Account Name</label>
                  <input
                    name="_name"
                    placeholder={`e.g. Production ${connector.title}`}
                    defaultValue={editAccount?.label ?? ""}
                    required
                    className="h-10 w-full rounded-xl border border-white/15 bg-white/10 px-3.5 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>
              )}

              {connector.fields?.map((field) => (
                <div className="flex flex-col gap-1.5" key={field.name}>
                  <label className="text-xs font-semibold text-white/80">{field.label}</label>
                  <input
                    name={field.name}
                    placeholder={isEdit ? "Leave blank to keep existing" : field.placeholder}
                    required={!isEdit && field.required !== false}
                    type={field.type ?? "text"}
                    autoComplete="off"
                    className="h-10 w-full rounded-xl border border-white/15 bg-white/10 px-3.5 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {(!isOAuth || showManualFallback) && (
          <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-white/[0.02] p-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#ffffff] px-5 py-2 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Saving..." : isEdit ? "Save Changes" : `Connect ${connector.title}`}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function ConnectorBadge({ connector }: { connector?: ConnectorSummary }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        connector
          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border border-white/10 bg-white/5 text-white/40"
      }`}
    >
      {connector ? "Connected" : "Not connected"}
    </span>
  );
}
