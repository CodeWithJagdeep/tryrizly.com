"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditsBadge } from "../../components/CreditsBadge";
import {
  ConnectorRow,
  SetupDialog,
  categories,
  catalogByProvider,
  isMultiAccount,
  shownCatalog,
  type ConnectorCatalogItem,
  type ConnectorSummary,
} from "../connectors-client";

const visibleConnectorProviders = new Set(shownCatalog.map((c) => c.provider as string));

export function NewConnectorClient() {
  const router = useRouter();
  const returnToRef = useRef<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
  const [connectorQuery, setConnectorQuery] = useState("");
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
  }, []);

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
        setActionError("Discord isn't configured yet -- try again in a moment.");
      }
    } catch {
      setActionError("Couldn't start the Discord connection -- try again.");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("returnTo");
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      returnToRef.current = returnTo;
    }
    const provider = params.get("setup");
    if (!provider) return;
    const connector = catalogByProvider.get(provider);
    if (!connector) return;
    if (connector.provider === "discord") {
      void startDiscordOAuth();
      return;
    }
    setActiveCategory("All");
    setConnectorQuery(connector.title);
    if (connector.authType === "manual") {
      setSetupConnector(connector);
      setSetupEditAccount(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleConnectors = useMemo(
    () =>
      connectors
        .map((connector) => (connector.provider === "discord_surface" ? { ...connector, provider: "discord" } : connector))
        .filter((connector) => visibleConnectorProviders.has(connector.provider)),
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
      if (returnToRef.current) {
        router.push(returnToRef.current);
        return;
      }
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

  return (
    <main className="min-h-screen bg-[#121214] text-white/90 font-sans antialiased">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-white/10 bg-[#121214]/85 px-4 backdrop-blur-md md:px-6">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white/90">
          <Link
            href="/dashboard/connectors"
            className="flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-white/60 transition hover:bg-white/10 hover:text-white/90"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Plugins
          </Link>
          <span className="text-white/30">/</span>
          <span>Browse</span>
        </div>
        <CreditsBadge />
      </div>

      <section className="mx-auto flex w-full max-w-[1240px] flex-col px-4 py-8 sm:px-8">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-white/90">Browse connectors</h1>
          <p className="mt-1 text-sm text-white/50">
            Connect approved tools or encrypted business credentials. Add as many as you need.
          </p>
        </header>

        {loadError && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
            {loadError}
          </div>
        )}
        {actionError && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
            {actionError}
          </div>
        )}

        {/* Search bar */}
        <div className="relative mt-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={connectorQuery}
            onChange={(e) => setConnectorQuery(e.target.value)}
            placeholder="Search connectors, skills, data sources"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-11 pr-9 text-sm text-white/90 placeholder-white/40 outline-none transition focus:border-white/20 focus:bg-white/[0.05]"
          />
          {connectorQuery && (
            <button
              type="button"
              onClick={() => setConnectorQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/90"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        <div className="mt-6">
          {filteredConnectors.length === 0 ? (
            <p className="py-16 text-center text-sm text-white/50">
              No integrations match &quot;{connectorQuery}&quot;.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredConnectors.map((connector) => (
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
                  onAddAccount={() => { setSetupEditAccount(null); setSetupConnector(connector); }}
                  onEditAccount={(account) => { setSetupEditAccount(account); setSetupConnector(connector); }}
                  onUnlink={() => void deleteConnector(connector)}
                  onRemoveAccount={(id, label) => void deleteConnectorById(id, label)}
                  onSaveSettings={saveConnectorSettings}
                  telegramLinked={telegramLinked}
                  slackLinked={slackLinked}
                />
              ))}
            </div>
          )}
        </div>
      </section>

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
