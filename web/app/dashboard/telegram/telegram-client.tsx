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

export function TelegramClient() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [telegram, setTelegram] = useState<{ deepLink: string; qrCode: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);
    try {
      const response = await fetch("/api/telegram");
      if (!response.ok) throw new Error("Failed to load Telegram history");
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
      setLoadError(error instanceof Error ? error.message : "Failed to load Telegram history");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (linked !== false) return;

    fetch("/api/onboarding/telegram/token", { method: "POST" })
      .then((r) => r.json())
      .then((data: { deepLink?: string; qrCode?: string }) => {
        if (data.deepLink && data.qrCode) setTelegram({ deepLink: data.deepLink, qrCode: data.qrCode });
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
            <h1 className="text-xl font-semibold tracking-tight">Telegram</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              The live conversation Riz sees from your Telegram channel
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
            <span className="text-sm text-slate-500">Loading Telegram status…</span>
          </div>
        )}

        {linked === false && <LinkTelegramPanel telegram={telegram} />}

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
        Reply from Telegram to continue the conversation — this view is a read-only mirror.
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
          isUser ? "bg-slate-100 text-slate-600" : "bg-[#FE7F2D]/10 text-[#FE7F2D]"
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
      <p className="font-medium">No Telegram messages yet</p>
      <p className="max-w-xs text-sm text-slate-500">
        Send Riz a message in Telegram and the conversation history will appear here.
      </p>
    </div>
  );
}

// ── Link view ─────────────────────────────────────────────────────────────────

function LinkTelegramPanel({ telegram }: { telegram: { deepLink: string; qrCode: string } | null }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-base font-semibold text-slate-900">Link Telegram</p>
        <p className="mt-1.5 text-sm leading-6 text-slate-500">
          Use Telegram for fast mobile reminders, approvals, and follow-ups. This page updates
          automatically once you&apos;re linked.
        </p>

        {telegram ? (
          <>
            <img
              src={telegram.qrCode}
              alt="Telegram link QR code"
              className="mt-6 h-[220px] w-[220px] rounded-xl border border-slate-200 bg-white p-3"
            />
            <a
              href={telegram.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center justify-center rounded-md border border-[#FE7F2D] bg-[#FE7F2D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e96f24]"
            >
              Open Telegram
            </a>
          </>
        ) : (
          <div className="mt-6 flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <span className="text-sm text-slate-500">Generating secure link…</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-6 py-2">
        <SetupRow index="01" title="Scan or open" text="Use the QR code from desktop, or the button from mobile." first />
        <SetupRow index="02" title="Start the bot" text="Telegram opens the rizly bot with a secure one-time token." />
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
