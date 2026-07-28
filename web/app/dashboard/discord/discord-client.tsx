"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 168) return d.toLocaleDateString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function DiscordClient() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [discord, setDiscord] = useState<{ installUrl: string; linkCommand: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);
    try {
      const response = await fetch("/api/discord");
      if (!response.ok) throw new Error("Failed to load Discord history");
      const data = (await response.json()) as {
        linked?: boolean;
        turns?: ConversationTurn[];
        error?: string;
      };
      if (data.error) throw new Error(data.error);
      setLinked(Boolean(data.linked));
      setTurns(data.turns ?? []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load Discord history");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
    // Surface an OAuth-callback failure (?error=...) from the gateway redirect.
    const params = new URLSearchParams(window.location.search);
    const callbackError = params.get("error");
    if (callbackError) setLoadError(callbackError);
  }, []);

  useEffect(() => {
    if (linked !== false) return;

    fetch("/api/onboarding/discord/token", { method: "POST" })
      .then((r) => r.json())
      .then((data: { installUrl?: string; linkCommand?: string }) => {
        if (data.installUrl && data.linkCommand) {
          setDiscord({ installUrl: data.installUrl, linkCommand: data.linkCommand });
        }
      })
      .catch(() => null);

    pollRef.current = setInterval(() => void load(), 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [linked]);

  const lastActivity = useMemo(() => {
    const last = turns.at(-1);
    return last ? formatDate(last.timestamp) : "—";
  }, [turns]);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 px-6 pt-5">
        <div className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Discord</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              The live conversation Riz sees from your Discord DM, plus every channel Rizly can watch for automations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill linked={linked} />
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-40"
            >
              <RefreshIcon spinning={refreshing} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="w-full px-6 py-6">
        {/* Error */}
        {loadError && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-600">
            {loadError}
          </div>
        )}

        {/* Loading */}
        {linked === null && !loadError && (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <span className="text-sm text-slate-500">Loading Discord status…</span>
          </div>
        )}

        {linked === false && <LinkDiscordPanel discord={discord} />}

        {linked === true && (
          <div className="flex flex-col gap-6">
            <StatsRow turnCount={turns.length} lastActivity={lastActivity} />
            {turns.length === 0 ? <EmptyConversation /> : <ConversationList turns={turns} />}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Linked view ───────────────────────────────────────────────────────────────

function StatsRow({ turnCount, lastActivity }: { turnCount: number; lastActivity: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard label="Recent messages" value={String(turnCount)} />
      <StatCard label="Last activity" value={lastActivity} />
      <StatCard label="Mode" value="Read-only mirror" />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function ConversationList({ turns }: { turns: ConversationTurn[] }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        Conversation
      </p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {turns.map((turn, index) => (
          <TurnRow key={`${turn.timestamp}-${index}`} turn={turn} first={index === 0} />
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Reply from Discord to continue the conversation — this view is a read-only mirror.
      </p>
    </div>
  );
}

function TurnRow({ turn, first }: { turn: ConversationTurn; first: boolean }) {
  const isUser = turn.role === "user";
  return (
    <div
      className={`flex items-start gap-3 px-4 py-4 transition hover:bg-slate-50 ${
        first ? "" : "border-t border-slate-200"
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
          isUser ? "bg-slate-100 text-slate-600" : "bg-[#D9BEF4]/10 text-[#D9BEF4]"
        }`}
      >
        {isUser ? "You" : "R"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900">{isUser ? "You" : "Riz"}</span>
          <span className="shrink-0 text-[11px] text-slate-400">{formatDate(turn.timestamp)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{turn.content}</p>
      </div>
    </div>
  );
}

function EmptyConversation() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <ChatIcon />
      </div>
      <p className="font-medium">No Discord messages yet</p>
      <p className="max-w-xs text-sm text-slate-500">
        Send Riz a DM in Discord and the conversation history will appear here. Post in any
        channel the bot can see and it&apos;s ready to trigger automations.
      </p>
    </div>
  );
}

// ── Link view ─────────────────────────────────────────────────────────────────

function LinkDiscordPanel({ discord }: { discord: { installUrl: string; linkCommand: string } | null }) {
  const [copied, setCopied] = useState(false);

  function copyCommand() {
    if (!discord) return;
    void navigator.clipboard.writeText(discord.linkCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-base font-semibold text-slate-900">Add Rizly to Discord</p>
        <p className="mt-1.5 text-sm leading-6 text-slate-500">
          Add the bot to a server to watch its channels for automations, and link your account
          for DM replies, drafts, and approvals. This page updates automatically once
          you&apos;re linked.
        </p>

        {discord ? (
          <>
            <a
              href={discord.installUrl}
              className="mt-6 inline-flex items-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              <DiscordIcon />
              Add to Discord
            </a>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Already added the bot to your server?
              </p>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                DM the Rizly bot this command instead:
              </p>
              <button
                type="button"
                onClick={copyCommand}
                className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left font-mono text-xs text-slate-700 transition hover:border-slate-300"
              >
                <span className="truncate">{discord.linkCommand}</span>
                <span className="shrink-0 text-[11px] font-sans font-semibold text-slate-500">
                  {copied ? "Copied ✓" : "Copy"}
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="mt-6 flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <span className="text-sm text-slate-500">Generating secure link…</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-6 py-2">
        <SetupRow index="01" title="Add to Discord" text="Pick a server to install the bot into — your account links automatically." first />
        <SetupRow index="02" title="Or link manually" text="If the bot is already in your server, DM it the link command on the left." />
        <SetupRow index="03" title="Return here" text="This page polls every few seconds and switches to the conversation view once linked." />
      </div>
    </div>
  );
}

function SetupRow({
  index,
  title,
  text,
  first = false,
}: {
  index: string;
  title: string;
  text: string;
  first?: boolean;
}) {
  return (
    <div className={`flex gap-4 py-5 ${first ? "" : "border-t border-slate-200"}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
        {index}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm leading-6 text-slate-500">{text}</p>
      </div>
    </div>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function StatusPill({ linked }: { linked: boolean | null }) {
  const config =
    linked === null
      ? { dot: "bg-amber-400", text: "Checking…", classes: "border-slate-200 text-slate-500" }
      : linked
        ? { dot: "bg-emerald-500", text: "Linked", classes: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" }
        : { dot: "bg-red-400", text: "Not linked", classes: "border-slate-200 text-slate-500" };
  return (
    <span className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${config.classes}`}>
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.text}
    </span>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function DiscordIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.246.195.373.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028ZM8.02 15.278c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.947 2.419-2.157 2.419Z" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={spinning ? "animate-spin" : ""} aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
