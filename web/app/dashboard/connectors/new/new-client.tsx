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
  // Where to send the principal after a manual connector saves successfully --
  // set only when this page was opened from elsewhere (e.g. the automation
  // builder's "Connect" link) wanting to come straight back, same as the
  // OAuth apps' /api/connectors/[provider]/start?returnTo=... round-trip.
  const returnToRef = useRef<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
  const [connectorQuery, setConnectorQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
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

  // Kicks off Discord's real connect flow directly -- mints a link token and
  // sends the browser straight to Discord's server-picker OAuth consent, the
  // same request /dashboard/discord's "Add to Discord" button makes, just
  // without requiring a stop on that page first.
  async function startDiscordOAuth() {
    try {
      const res = await fetch("/api/onboarding/discord/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Come back here, not the standalone /dashboard/discord chat page --
        // this button was clicked from the connectors list.
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

  // Deep link from the main connectors page (e.g. onboarding's "setup" prompts).
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
        // The real Discord bot saves its connection under "discord_surface"
        // (kept distinct so linking it can never clobber the legacy manual
        // "discord" webhook connector's own row) -- remap it here so the
        // "discord" card's connected-status check actually finds it.
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
    <main className="min-h-screen bg-[#f8f8f7] text-black">
      <div className="sticky top-0 z-10 flex h-14 w-full shrink-0 items-center justify-between border-b border-transparent bg-[#f8f8f7] px-4 md:px-6">
        <div className="flex items-center gap-1 text-base font-normal text-slate-900 md:text-lg">
          <Link
            href="/dashboard/connectors"
            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-950"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Connectors
          </Link>
        </div>
        <CreditsBadge />
      </div>

      <section className="mx-auto flex w-full max-w-[1200px] flex-col px-4 py-8 sm:px-8">
        <header className="shrink-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D96420]">Integrations</p>
          <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-slate-950 text-balance">
            Browse integrations
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-slate-500">
            Connect approved apps or encrypted business credentials. Connect as many as you need — nothing here is
            limited to one.
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

        <div className="mt-6 flex items-center gap-2">
          <div className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-1.5">
              {categories.map((category) => {
                const active = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`cursor-pointer rounded-full px-4 py-2 text-[13px] font-normal whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40 ${
                      active ? "bg-slate-950 text-white" : "text-black/70 hover:bg-slate-100 hover:text-black"
                    }`}
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
            className={`flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9BEF4]/40 ${
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
          <div className="mt-2.5 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 transition focus-within:border-[#D9BEF4] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#D9BEF4]/10">
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

        <div className="mt-6">
          {filteredConnectors.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              No integrations match &quot;{connectorQuery}&quot;.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredConnectors.map((connector) => (
                <ConnectorRow
                  connector={connector}
                  key={connector.id}
                  linkedConnector={connectedByProvider.get(connector.provider)}
                  linkedAccounts={connectedByProviderAll.get(connector.provider) ?? []}
                  onSetup={() => {
                    // Discord's real connect is the server-picker OAuth install --
                    // kick it off directly (no intermediate page/click) rather than
                    // opening the legacy manual webhook form below.
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
