"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalComIcon,
  CalendarIcon,
  GmailIcon,
  MongoDbIcon,
  NotionIcon,
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

const MULTI_ACCOUNT_PROVIDERS = ["postgres", "mongodb"] as const;
type MultiAccountProvider = (typeof MULTI_ACCOUNT_PROVIDERS)[number];
function isMultiAccount(provider: string): provider is MultiAccountProvider {
  return MULTI_ACCOUNT_PROVIDERS.includes(provider as MultiAccountProvider);
}

type ConnectorField = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
};

type ConnectorCatalogItem = {
  id: string;
  /** Backend connector key used for status lookup + connect/disconnect. */
  provider: "gmail" | "calendar" | "calcom" | "razorpay" | "stripe" | "postgres" | "mongodb" | "slack" | "notion";
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
    description: "View upcoming bookings, check who booked you, and create new meetings via chat.",
    category: "Scheduling",
    authType: "manual",
    icon: CalComIcon,
    fields: [
      { name: "apiKey", label: "API Key", type: "password", placeholder: "cal_live_..." },
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
    authType: "manual",
    icon: StripeIcon,
    fields: [{ name: "secretKey", label: "Secret Key", type: "password" }],
  },
  {
    id: "postgres",
    provider: "postgres",
    title: "Postgres",
    description: "Read-only SQL queries for signups, errors, and business metrics.",
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
    description: "Read-only aggregate/find queries over your product database.",
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
    description: "Search messages, summarize channel activity, and get briefed on team discussions.",
    category: "Team",
    authType: "manual",
    icon: SlackIcon,
    fields: [
      { name: "botToken", label: "Bot Token", type: "password", placeholder: "xoxb-..." },
    ],
  },
  {
    id: "notion",
    provider: "notion",
    title: "Notion",
    description: "Search pages, retrieve knowledge base content, and get context from your docs.",
    category: "Team",
    authType: "manual",
    icon: NotionIcon,
    fields: [
      { name: "apiToken", label: "Integration Token", type: "password", placeholder: "secret_..." },
    ],
  },
];

const categories = ["All", "Google", "Scheduling", "Payments", "Databases", "Team", "APIs"] as const;

export function ConnectorsClient() {
  const [connectors, setConnectors] = useState<ConnectorSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
  const [setupConnector, setSetupConnector] = useState<ConnectorCatalogItem | null>(null);
  const [setupEditAccount, setSetupEditAccount] = useState<ConnectorSummary | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((d: { onboarding?: { telegramLinked?: boolean } }) =>
        setTelegramLinked(Boolean(d.onboarding?.telegramLinked)),
      )
      .catch(() => setTelegramLinked(false));
  }, []);

  // For multi-account providers, store arrays. For others, store single.
  const connectedByProvider = useMemo(
    () => new Map(connectors.map((connector) => [connector.provider, connector])),
    [connectors],
  );
  const connectedByProviderAll = useMemo(() => {
    const map = new Map<string, ConnectorSummary[]>();
    for (const c of connectors) {
      const existing = map.get(c.provider) ?? [];
      map.set(c.provider, [...existing, c]);
    }
    return map;
  }, [connectors]);

  const connectedCount = connectors.length;

  const filteredConnectors = useMemo(
    () =>
      activeCategory === "All"
        ? connectorCatalog
        : connectorCatalog.filter((connector) => connector.category === activeCategory),
    [activeCategory],
  );

  async function loadConnectors() {
    try {
      const response = await fetch("/api/connectors");
      if (!response.ok) {
        throw new Error("Failed to load connectors");
      }

      setConnectors((await response.json()) as ConnectorSummary[]);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load connectors");
    }
  }

  useEffect(() => {
    void loadConnectors();
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
    <main className="min-h-screen bg-[#1a1a19] text-[#f2f1ec]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-[#2e2e2c] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#6b6b63]">
              heyriz setup
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#f2f1ec] sm:text-3xl">
              Connectors
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a8a399]">
              Connect OAuth apps or add provider keys for encrypted vault access.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#2e2e2c] bg-[#1f1f1e] px-3.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
            <span className="text-xs font-medium text-[#a8a399]">
              {connectedCount} connected
            </span>
          </div>
        </header>

        {loadError ? (
          <p className="rounded-lg border border-[#5c2626] bg-[#241616] px-4 py-3 text-sm text-[#f87171]">
            {loadError}
          </p>
        ) : null}
        {actionError ? (
          <p className="rounded-lg border border-[#5c2626] bg-[#241616] px-4 py-3 text-sm text-[#f87171]">
            {actionError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              className={`h-9 rounded-lg px-3.5 text-sm font-medium transition ${
                activeCategory === category
                  ? "bg-[#f2f1ec] text-[#1a1a19]"
                  : "border border-[#2e2e2c] bg-[#1f1f1e] text-[#a8a399] hover:bg-[#242422] hover:text-[#f2f1ec]"
              }`}
              key={category}
              onClick={() => setActiveCategory(category)}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>

        <section className="overflow-hidden rounded-xl border border-[#2e2e2c] bg-[#1f1f1e]">
          <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#2e2e2c] bg-[#232321] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b6b63]">
            <span>App</span>
            <span className="hidden text-right sm:block">Action</span>
          </div>

          <div className="divide-y divide-[#2e2e2c]">
            {filteredConnectors.map((connector) => (
              <ConnectorRow
                connector={connector}
                key={connector.id}
                linkedConnector={connectedByProvider.get(connector.provider)}
                linkedAccounts={connectedByProviderAll.get(connector.provider) ?? []}
                onSetup={() => { setSetupEditAccount(null); setSetupConnector(connector); }}
                onAddAccount={() => { setSetupEditAccount(null); setSetupConnector(connector); }}
                onEditAccount={(account) => { setSetupEditAccount(account); setSetupConnector(connector); }}
                onUnlink={() => void deleteConnector(connector)}
                onRemoveAccount={(id, label) => void deleteConnectorById(id, label)}
                onSaveSettings={saveConnectorSettings}
                telegramLinked={telegramLinked}
              />
            ))}
          </div>
        </section>
      </section>

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
      className={`relative flex h-[22px] w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "border-emerald-500/40 bg-emerald-500/25" : "border-[#3a3a36] bg-[#242422]"
      }`}
    >
      <span
        className={`absolute h-[14px] w-[14px] rounded-full shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[19px] bg-emerald-400" : "translate-x-[3px] bg-[#5a5a56]"
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
        <p className="text-sm font-medium text-[#e8e6e0]">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-5 text-[#5d5d58]">{description}</p>}
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
}: {
  connector: ConnectorCatalogItem;
  account: ConnectorSummary;
  onSave: (id: string, metadata: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  telegramLinked: boolean | null;
}) {
  const Icon = connector.icon;

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

  async function handleSave() {
    setSaving(true);
    const patch: Record<string, unknown> = { notificationsEnabled: notifEnabled };
    if (isGmail) {
      patch.notificationScope = notifScope;
      patch.autoProcess = autoProcess;
    }
    if (isCalendar) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-panel-title"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-2xl border border-[#2e2e2c] bg-[#1c1c1b] shadow-[0_24px_64px_rgba(0,0,0,0.6)] max-h-[calc(100vh-3rem)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-[#272725] px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2e2e2c] bg-[#161615]">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="settings-panel-title" className="text-sm font-semibold text-[#f2f1ec]">
              {connector.title}
            </h2>
            <p className="text-[11px] text-[#5d5d58]">Connector settings</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              statusConnected
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {statusConnected ? "Connected" : "Error"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#5d5d58] transition hover:bg-[#272725] hover:text-[#f2f1ec]"
          >
            <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-1">

          {/* Connection info */}
          <div className="py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4a4a46]">
              Connection
            </p>
            <div className="rounded-xl border border-[#272725] bg-[#181817] divide-y divide-[#272725]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-[#5d5d58]">Status</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-[#d0cec8]">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusConnected ? "bg-emerald-400" : "bg-red-400"}`} />
                  {statusConnected ? "Active" : "Error"}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-[#5d5d58]">Auth type</span>
                <span className="text-xs font-medium capitalize text-[#d0cec8]">
                  {account.authType === "oauth" ? "OAuth 2.0" : "API key"}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-[#5d5d58]">Last updated</span>
                <span className="text-xs font-medium text-[#d0cec8]">{connectedSince}</span>
              </div>
              {account.scopes.length > 0 && (
                <div className="px-4 py-2.5">
                  <p className="text-xs text-[#5d5d58] mb-1.5">Permissions</p>
                  <div className="flex flex-wrap gap-1">
                    {account.scopes
                      .filter((s) => !s.startsWith("openid") && !s.startsWith("email") && !s.startsWith("profile"))
                      .map((scope) => (
                        <span
                          key={scope}
                          className="rounded bg-[#242422] px-1.5 py-0.5 text-[10px] font-mono text-[#6b6b63]"
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
          <div className="py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4a4a46]">
              Notifications
            </p>

            {telegramLinked === false && (
              <div className="mb-2 flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5">
                <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true">
                  <path d="M8 2L1.5 13.5h13L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <p className="text-[11px] leading-5 text-amber-200/80">
                  Telegram isn&apos;t linked — notifications won&apos;t be delivered.{" "}
                  <a href="/dashboard/telegram" className="font-semibold underline underline-offset-2 hover:text-amber-200">
                    Connect Telegram
                  </a>
                </p>
              </div>
            )}

            <div className="rounded-xl border border-[#272725] bg-[#181817] divide-y divide-[#272725] px-4">
              <SettingRow
                label="Enable notifications"
                description="Send Telegram alerts triggered by this connector"
              >
                <ToggleSwitch checked={notifEnabled} onChange={setNotifEnabled} />
              </SettingRow>

              {isGmail && (
                <SettingRow
                  label="Alert scope"
                  description="Which emails trigger a Telegram alert"
                >
                  <select
                    value={notifScope}
                    onChange={(e) => setNotifScope(e.target.value)}
                    disabled={!notifEnabled}
                    className="rounded-lg border border-[#2e2e2c] bg-[#242422] px-2.5 py-1.5 text-xs text-[#d0cec8] outline-none transition focus:border-[#3e3e3c] disabled:opacity-40"
                  >
                    {SCOPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </SettingRow>
              )}

              {isCalendar && (
                <SettingRow
                  label="Notify on invites"
                  description="Alert when a new calendar invite arrives"
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
          {(isGmail || isCalendar) && (
            <div className="py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4a4a46]">
                Behaviour
              </p>
              <div className="rounded-xl border border-[#272725] bg-[#181817] divide-y divide-[#272725] px-4">
                {isGmail && (
                  <SettingRow
                    label="Auto-process emails"
                    description="Riz reads and summarises new emails in the background"
                  >
                    <ToggleSwitch checked={autoProcess} onChange={setAutoProcess} />
                  </SettingRow>
                )}
                {isCalendar && (
                  <SettingRow
                    label="Meeting reminder"
                    description="How early to send a pre-meeting alert"
                  >
                    <select
                      value={reminderMinutes}
                      onChange={(e) => setReminderMinutes(e.target.value)}
                      className="rounded-lg border border-[#2e2e2c] bg-[#242422] px-2.5 py-1.5 text-xs text-[#d0cec8] outline-none transition focus:border-[#3e3e3c]"
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
        <div className="flex items-center justify-end gap-2 border-t border-[#272725] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#2e2e2c] px-4 text-sm font-medium text-[#7a7a72] transition hover:bg-[#242422] hover:text-[#f2f1ec]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || saved}
            className="h-9 rounded-lg bg-[#f2f1ec] px-5 text-sm font-semibold text-[#1a1a19] transition hover:bg-white disabled:opacity-60"
          >
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save settings"}
          </button>
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
}) {
  const Icon = connector.icon;
  const multi = isMultiAccount(connector.provider);
  const [settingsAccount, setSettingsAccount] = useState<ConnectorSummary | null>(null);

  return (
    <>
      <article className="px-5 py-5 transition hover:bg-[#232321]/60">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#2e2e2c] bg-[#1a1a19]">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-[#f2f1ec]">{connector.title}</h2>
                {!multi && <ConnectorBadge connector={linkedConnector} />}
                {multi && linkedAccounts.length > 0 && (
                  <span className="shrink-0 rounded-full bg-[#0f2e1f] px-2.5 py-1 text-xs font-medium text-[#4ade80]">
                    {linkedAccounts.length} connected
                  </span>
                )}
                {multi && linkedAccounts.length === 0 && (
                  <span className="shrink-0 rounded-full bg-[#242422] px-2.5 py-1 text-xs font-medium text-[#6b6b63]">
                    Not connected
                  </span>
                )}
                <span className="rounded-full bg-[#242422] px-2.5 py-1 text-xs font-medium text-[#a8a399]">
                  {connector.category}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#7d7a72]">
                {connector.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {/* Settings gear — only shown when connected (single account) */}
            {!multi && linkedConnector && (
              <button
                type="button"
                title="Connector settings"
                onClick={() => setSettingsAccount(linkedConnector)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2e2e2c] text-[#6b6b63] transition hover:bg-[#242422] hover:text-[#f2f1ec]"
              >
                <GearIcon />
              </button>
            )}
            {connector.authType === "oauth" ? (
              linkedConnector ? (
                <button className="h-9 rounded-lg border border-[#2e2e2c] px-4 text-sm font-medium text-[#a8a399] transition hover:bg-[#242422] hover:text-[#f2f1ec]" onClick={onUnlink} type="button">Unlink</button>
              ) : (
                <a className="inline-flex h-9 items-center rounded-lg bg-[#2563eb] px-4 text-sm font-medium text-white transition hover:bg-[#1d4ed8]" href={`/api/connectors/${connector.provider}/start?returnTo=%2Fdashboard%2Fconnectors%3Fconnected%3D${connector.provider}`}>Link</a>
              )
            ) : multi ? (
              <button className="h-9 rounded-lg bg-[#2563eb] px-4 text-sm font-medium text-white transition hover:bg-[#1d4ed8]" onClick={onAddAccount} type="button">
                Add account
              </button>
            ) : (
              <>
                <button className="h-9 rounded-lg bg-[#2563eb] px-4 text-sm font-medium text-white transition hover:bg-[#1d4ed8]" onClick={onSetup} type="button">
                  {linkedConnector ? "Edit setup" : "Setup"}
                </button>
                {linkedConnector && (
                  <button className="h-9 rounded-lg border border-[#2e2e2c] px-4 text-sm font-medium text-[#a8a399] transition hover:bg-[#242422] hover:text-[#f2f1ec]" onClick={onUnlink} type="button">Unlink</button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Named accounts list for multi-account DB providers */}
        {multi && linkedAccounts.length > 0 && (
          <div className="mt-3 ml-13 space-y-2 pl-[52px]">
            {linkedAccounts.map((account) => (
              <div key={account.id} className="flex items-center gap-3 rounded-lg border border-[#2e2e2c] bg-[#1a1a19] px-3 py-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#22c55e]" />
                <span className="flex-1 truncate text-sm font-medium text-[#f2f1ec]">{account.label}</span>
                <span className="text-xs text-[#6b6b63]">{new Date(account.updatedAt).toLocaleDateString()}</span>
                <button
                  type="button"
                  title="Account settings"
                  onClick={() => setSettingsAccount(account)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[#6b6b63] transition hover:bg-[#2a2a28] hover:text-[#f2f1ec]"
                >
                  <GearIcon />
                </button>
                <button
                  type="button"
                  onClick={() => onEditAccount(account)}
                  className="rounded px-2 py-1 text-xs text-[#a8a399] transition hover:bg-[#242422] hover:text-[#f2f1ec]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveAccount(account.id, account.label)}
                  className="rounded px-2 py-1 text-xs text-[#f87171] transition hover:bg-[#2e1a1a]"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </article>

      {settingsAccount && (
        <SettingsPanel
          connector={connector}
          account={settingsAccount}
          onSave={onSaveSettings}
          onClose={() => setSettingsAccount(null)}
          telegramLinked={telegramLinked}
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
  const isEdit = Boolean(editAccount);
  const [closing, setClosing] = useState(false);

  function handleClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 140);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 ${closing ? "dialog-backdrop-exit" : "dialog-backdrop-enter"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="connector-setup-title"
      onClick={handleClose}
    >
      <form
        className={`w-full max-w-lg rounded-xl border border-[#2e2e2c] bg-[#1f1f1e] p-5 shadow-2xl ${closing ? "dialog-panel-exit" : "dialog-panel-enter"}`}
        onSubmit={(e) => onSubmit(e, connector)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#2e2e2c] bg-[#1a1a19]">
              <Icon className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#f2f1ec]" id="connector-setup-title">
                {isEdit ? `Edit "${editAccount!.label}"` : multi ? `Add ${connector.title} account` : `Setup ${connector.title}`}
              </h2>
              <p className="mt-1 text-sm text-[#a8a399]">
                {multi ? "Credentials are encrypted and stored securely." : "Add credentials to create an encrypted connector."}
              </p>
            </div>
          </div>
          <button className="rounded-lg border border-[#2e2e2c] px-3 py-2 text-sm font-medium text-[#a8a399] transition hover:bg-[#242422] hover:text-[#f2f1ec]" onClick={handleClose} type="button">Close</button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-[#5c2626] bg-[#241616] px-3 py-2 text-sm text-[#f87171]">{error}</p>
        )}

        <div className="mt-5 grid gap-4">
          {/* Name field for multi-account providers */}
          {multi && (
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-[#a8a399]">Account name</span>
              <input
                className="h-11 rounded-lg border border-[#2e2e2c] bg-[#1a1a19] px-3 text-sm text-[#f2f1ec] outline-none transition placeholder:text-[#6b6b63] focus:border-[#2563eb]"
                name="_name"
                placeholder={`e.g. Production ${connector.title}, Staging DB`}
                defaultValue={editAccount?.label ?? ""}
                required
              />
              <span className="text-xs text-[#6b6b63]">Riz uses this name to ask you which DB to query when you have multiple connected.</span>
            </label>
          )}
          {connector.fields?.map((field) => (
            <label className="grid gap-2 text-sm" key={field.name}>
              <span className="font-medium text-[#a8a399]">{field.label}</span>
              <input
                className="h-11 rounded-lg border border-[#2e2e2c] bg-[#1a1a19] px-3 text-sm text-[#f2f1ec] outline-none transition placeholder:text-[#6b6b63] focus:border-[#2563eb]"
                name={field.name}
                placeholder={isEdit ? "Leave blank to keep existing credentials" : field.placeholder}
                required={!isEdit}
                type={field.type ?? "text"}
              />
            </label>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className="h-10 rounded-lg border border-[#2e2e2c] px-4 text-sm font-medium text-[#a8a399] transition hover:bg-[#242422] hover:text-[#f2f1ec]" onClick={handleClose} type="button">Cancel</button>
          <button className="h-10 rounded-lg bg-[#2563eb] px-4 text-sm font-medium text-white transition hover:bg-[#1d4ed8] disabled:opacity-50" disabled={submitting} type="submit">
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Connect"}
          </button>
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
          ? "bg-[#0f2e1f] text-[#4ade80]"
          : "bg-[#242422] text-[#6b6b63]"
      }`}
    >
      {connector ? "Connected" : "Not connected"}
    </span>
  );
}
