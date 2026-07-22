"use client";

import { Dispatch, FormEvent, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { CreditsBadge } from "../components/CreditsBadge";
import {
  CalComIcon,
  CalendarIcon,
  DiscordIcon,
  GitHubIcon,
  GmailIcon,
  MongoDbIcon,
  MpesaIcon,
  NotionIcon,
  PayPalIcon,
  PostgresIcon,
  RazorpayIcon,
  SlackIcon,
  StripeIcon,
} from "../../components/ConnectorIcons";

type ConnectorSummary = {
  id: string;
  provider: string;
  authType: string;
  label: string;
  status: string;
  scopes: string[];
  metadata: Record<string, string | number | boolean | null>;
  updatedAt: string;
};

const MULTI_ACCOUNT_PROVIDERS = ["postgres", "mongodb", "razorpay", "paypal", "mpesa", "calcom"] as const;
type MultiAccountProvider = (typeof MULTI_ACCOUNT_PROVIDERS)[number];
function isMultiAccount(provider: string): provider is MultiAccountProvider {
  return MULTI_ACCOUNT_PROVIDERS.includes(provider as MultiAccountProvider);
}

type ConnectorField = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
};

type ConnectorCatalogItem = {
  id: string;
  /** Backend connector key used for status lookup + connect/disconnect. */
  provider: "gmail" | "calendar" | "calcom" | "razorpay" | "stripe" | "postgres" | "mongodb" | "slack" | "notion" | "paypal" | "github" | "mpesa" | "discord";
  title: string;
  description: string;
  category: "Google" | "Scheduling" | "Payments" | "Databases" | "Team" | "APIs";
  authType: "oauth" | "manual";
  icon: typeof GmailIcon;
  fields?: ConnectorField[];
};

const connectorCatalog: ConnectorCatalogItem[] = [
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
    title: "Discord",
    description: "Read a bot-accessible channel for updates and post approved messages through an optional webhook.",
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
];

const categories = ["All", "Google", "Scheduling", "Payments", "Databases", "Team", "APIs"] as const;

// Temporarily hidden from the connectors page — remove from this set to bring one back.
const hiddenConnectorProviders = new Set<string>(["discord", "slack", "notion", "paypal"]);
const shownCatalog = connectorCatalog.filter((c) => !hiddenConnectorProviders.has(c.provider));

const catalogByProvider = new Map(shownCatalog.map((c) => [c.provider as string, c]));
const visibleConnectorProviders = new Set(shownCatalog.map((c) => c.provider as string));

export function ConnectorsClient() {
  const [connectors, setConnectors] = useState<ConnectorSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
  const [connectorQuery, setConnectorQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [setupConnector, setSetupConnector] = useState<ConnectorCatalogItem | null>(null);
  const [setupEditAccount, setSetupEditAccount] = useState<ConnectorSummary | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const [slackLinked, setSlackLinked] = useState<boolean | null>(null);

  useEffect(() => {
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

  // For multi-account providers, store arrays. For others, store single.
  const visibleConnectors = useMemo(
    () => connectors.filter((connector) => visibleConnectorProviders.has(connector.provider)),
    [connectors],
  );

  const connectedByProvider = useMemo(
    () => new Map(visibleConnectors.map((connector) => [connector.provider, connector])),
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

  const connectedCount = visibleConnectors.length;

  const filteredConnectors = useMemo(() => {
    const query = connectorQuery.trim().toLowerCase();
    return shownCatalog.filter((connector) => {
      const categoryOk = activeCategory === "All" || connector.category === activeCategory;
      const queryOk =
        !query ||
        connector.title.toLowerCase().includes(query) ||
        connector.description.toLowerCase().includes(query) ||
        connector.provider.toLowerCase().includes(query);
      return categoryOk && queryOk;
    });
  }, [activeCategory, connectorQuery]);

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

  useEffect(() => {
    const provider = new URLSearchParams(window.location.search).get("setup");
    if (!provider) return;
    const connector = catalogByProvider.get(provider);
    if (!connector) return;
    setActiveCategory("All");
    setConnectorQuery(connector.title);
    if (connector.authType === "manual") {
      setSetupConnector(connector);
      setSetupEditAccount(null);
    }
  }, []);

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
      connector.fields.map((field) => [
        field.name,
        String(formData.get(field.name) ?? ""),
      ]),
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
      setSetupError(`Could not reach the connector service. ${connector.title} was not saved.`);
    } finally {
      setSetupSubmitting(false);
    }
  }

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

  const saveConnectorSettings = useCallback(async (accountId: string, metadata: Record<string, unknown>) => {
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
  }, []);

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
            <button
              type="button"
              onClick={() => setCatalogOpen(true)}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-slate-950 px-4 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/50"
              title="Connect an account"
              aria-label="Connect an account"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="shrink-0">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
              Connect account
            </button>
          </div>

          {visibleConnectors.length === 0 ? (
            <div className="mt-3 flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 px-6 text-center">
              <p className="text-sm text-black/70">
                Nothing connected yet. Browse integrations to add Gmail, Calendar, and more.
              </p>
              <button
                type="button"
                onClick={() => setCatalogOpen(true)}
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-normal text-white transition hover:bg-slate-800 active:scale-[0.98]"
              >
                Browse integrations
              </button>
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
                      {Icon ? <Icon className="size-5" /> : (
                        <span className="text-xs font-bold uppercase text-slate-400">
                          {account.provider.slice(0, 2)}
                        </span>
                      )}
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

      {catalogOpen && (
        <IntegrationsDialog
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          connectorQuery={connectorQuery}
          setConnectorQuery={setConnectorQuery}
          filteredConnectors={filteredConnectors}
          connectedByProvider={connectedByProvider}
          connectedByProviderAll={connectedByProviderAll}
          telegramLinked={telegramLinked}
          slackLinked={slackLinked}
          onClose={() => setCatalogOpen(false)}
          onSetup={(connector) => { setSetupEditAccount(null); setSetupConnector(connector); }}
          onAddAccount={(connector) => { setSetupEditAccount(null); setSetupConnector(connector); }}
          onEditAccount={(connector, account) => { setSetupEditAccount(account); setSetupConnector(connector); }}
          onUnlink={(connector) => void deleteConnector(connector)}
          onRemoveAccount={(id, label) => void deleteConnectorById(id, label)}
          onSaveSettings={saveConnectorSettings}
        />
      )}

      {setupConnector ? (
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
      ) : null}
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
            <Icon className="h-5 w-5" />
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
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/40"
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
                    className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#FE7F2D] disabled:opacity-40"
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
                      className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#FE7F2D]"
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
            className="h-10 cursor-pointer rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/40"
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

function IntegrationsDialog({
  activeCategory,
  setActiveCategory,
  searchOpen,
  setSearchOpen,
  connectorQuery,
  setConnectorQuery,
  filteredConnectors,
  connectedByProvider,
  connectedByProviderAll,
  telegramLinked,
  slackLinked,
  onClose,
  onSetup,
  onAddAccount,
  onEditAccount,
  onUnlink,
  onRemoveAccount,
  onSaveSettings,
}: {
  activeCategory: (typeof categories)[number];
  setActiveCategory: (category: (typeof categories)[number]) => void;
  searchOpen: boolean;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  connectorQuery: string;
  setConnectorQuery: (value: string) => void;
  filteredConnectors: ConnectorCatalogItem[];
  connectedByProvider: Map<string, ConnectorSummary>;
  connectedByProviderAll: Map<string, ConnectorSummary[]>;
  telegramLinked: boolean | null;
  slackLinked: boolean | null;
  onClose: () => void;
  onSetup: (connector: ConnectorCatalogItem) => void;
  onAddAccount: (connector: ConnectorCatalogItem) => void;
  onEditAccount: (connector: ConnectorCatalogItem, account: ConnectorSummary) => void;
  onUnlink: (connector: ConnectorCatalogItem) => void;
  onRemoveAccount: (id: string, label: string) => void;
  onSaveSettings: (accountId: string, metadata: Record<string, unknown>) => Promise<void>;
}) {
  const [closing, setClosing] = useState(false);

  function handleClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 140);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-slate-950/55 p-0 backdrop-blur-[6px] sm:px-4 sm:py-8 ${closing ? "dialog-backdrop-exit" : "dialog-backdrop-enter"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="integrations-dialog-title"
      onClick={handleClose}
    >
      <div
        className={`relative mb-0 mt-auto flex max-h-[92dvh] w-full max-w-[1000px] flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-slate-200 bg-white shadow-[0_-20px_60px_-24px_rgba(15,23,42,0.5)] sm:m-auto sm:max-h-[85vh] sm:rounded-[28px] sm:border-b sm:shadow-[0_28px_80px_-20px_rgba(15,23,42,0.45)] ${closing ? "dialog-panel-exit" : "dialog-panel-enter"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 pb-5 pt-7 sm:px-6 sm:pb-5 sm:pt-6">
          <span className="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300 sm:hidden" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-black" id="integrations-dialog-title">
              Browse integrations
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Connect approved apps or encrypted business credentials.
            </p>
          </div>
          <button
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/40"
            onClick={handleClose}
            type="button"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-200 px-5 pt-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max gap-1.5">
                {categories.map((category) => {
                  const active = activeCategory === category;
                  return (
                    <button
                      className={`cursor-pointer rounded-full px-4 py-2 text-[13px] font-normal whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/40 ${
                        active
                          ? "bg-slate-950 text-white"
                          : "text-black/70 hover:bg-slate-100 hover:text-black"
                      }`}
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      type="button"
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchOpen((open) => {
                  if (open) setConnectorQuery("");
                  return !open;
                });
              }}
              aria-label={searchOpen ? "Close search" : "Search integrations"}
              aria-expanded={searchOpen}
              className={`flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/40 ${
                searchOpen
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-black/70 hover:border-slate-300 hover:text-black"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
          </div>

          {searchOpen && (
            <div className="mt-2.5 mb-4 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 transition focus-within:border-[#FE7F2D] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#FE7F2D]/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-black/40">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={connectorQuery}
                onChange={(e) => setConnectorQuery(e.target.value)}
                placeholder="Search integrations..."
                className="h-full w-full bg-transparent text-sm text-black outline-none placeholder:text-slate-400"
                aria-label="Search integrations"
                autoComplete="off"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setConnectorQuery("");
                  setSearchOpen(false);
                }}
                aria-label="Close search"
                className="text-black/40 transition-colors hover:text-black"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          )}

          {!searchOpen && <div className="pb-4" />}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {filteredConnectors.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              No integrations match "{connectorQuery}".
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredConnectors.map((connector) => (
                <ConnectorRow
                  connector={connector}
                  key={connector.id}
                  linkedConnector={connectedByProvider.get(connector.provider)}
                  linkedAccounts={connectedByProviderAll.get(connector.provider) ?? []}
                  onSetup={() => onSetup(connector)}
                  onAddAccount={() => onAddAccount(connector)}
                  onEditAccount={(account) => onEditAccount(connector, account)}
                  onUnlink={() => onUnlink(connector)}
                  onRemoveAccount={onRemoveAccount}
                  onSaveSettings={onSaveSettings}
                  telegramLinked={telegramLinked}
                  slackLinked={slackLinked}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectorRow({
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
              <Icon className="size-6" />
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

function SetupDialog({
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
            className="absolute right-4 top-4 flex size-9 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/40"
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
              <Icon className="size-7" />
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
                <a
                  href={oauthHref}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/50"
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
                        className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#FE7F2D] focus:ring-4 focus:ring-[#FE7F2D]/10"
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
                        className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#FE7F2D] focus:ring-4 focus:ring-[#FE7F2D]/10"
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
                  className="h-11 cursor-pointer rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-11 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/50 sm:px-5"
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
