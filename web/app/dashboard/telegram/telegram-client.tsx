"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

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
    return last ? new Date(last.timestamp).toLocaleString() : "No messages yet";
  }, [turns]);

  return (
    <main className="min-h-screen bg-[#1a1a19] text-white">
      <header className="border-b border-white/[0.05] px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[20px] font-semibold leading-tight tracking-tight">Telegram</h1>
            <p className="mt-1 text-[15px] leading-6 text-white/40">
              Connect your phone channel and review the live conversation Riz sees from Telegram.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex h-9 w-fit items-center gap-2 border border-white/[0.08] bg-white/[0.04] px-4 text-[15px] font-medium text-white/75 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
          >
            <RefreshIcon spinning={refreshing} />
            Refresh
          </button>
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-89px)] grid-cols-1 lg:grid-cols-[360px_1fr]">
        <aside className="border-b border-white/[0.05] bg-[#1f1f1e] p-6 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/[0.06] pb-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/25">Connection</p>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[17px] font-semibold text-white">
                  {linked === null ? "Checking status" : linked ? "Telegram linked" : "Telegram not linked"}
                </p>
                <p className="mt-1 text-[15px] leading-6 text-white/40">
                  {linked ? "Riz can receive and reply from Telegram." : "Scan the QR code or open Telegram to connect."}
                </p>
              </div>
              <StatusDot linked={linked} />
            </div>
          </div>

          <div className="grid gap-0 border-b border-white/[0.06] py-4">
            <InfoRow label="Recent turns" value={String(turns.length)} />
            <InfoRow label="Last activity" value={lastActivity} />
            <InfoRow label="Mode" value="Read-only mirror" />
          </div>

          <div className="pt-5">
            <p className="text-[15px] font-medium text-white">How it works</p>
            <div className="mt-3 grid gap-3 text-[15px] leading-6 text-white/40">
              <p>Messages sent in Telegram appear here after Riz processes them.</p>
              <p>Reply from Telegram to continue the conversation. This dashboard view does not send messages.</p>
            </div>
          </div>
        </aside>

        <div className="bg-[#1a1a19] p-6">
          {loadError ? (
            <div className="mb-5 border border-red-500/20 bg-red-500/5 px-4 py-3 text-[15px] text-red-300">
              {loadError}
            </div>
          ) : null}

          {linked === null ? (
            <LoadingState />
          ) : !linked ? (
            <LinkTelegramPanel telegram={telegram} />
          ) : turns.length === 0 ? (
            <EmptyConversation />
          ) : (
            <ConversationTimeline turns={turns} />
          )}
        </div>
      </section>
    </main>
  );
}

function LinkTelegramPanel({ telegram }: { telegram: { deepLink: string; qrCode: string } | null }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="border border-white/[0.06] bg-[#1f1f1e] p-6">
        <p className="text-[18px] font-semibold text-white">Link Telegram</p>
        <p className="mt-2 text-[15px] leading-6 text-white/40">
          Use Telegram for fast mobile reminders, approvals, and follow-ups. The page will update automatically after linking.
        </p>

        {telegram ? (
          <>
            <img
              src={telegram.qrCode}
              alt="Telegram link QR code"
              className="mt-6 h-[220px] w-[220px] border border-white/[0.08] bg-white p-3"
            />
            <a
              href={telegram.deepLink}
              className="mt-5 inline-flex h-9 items-center justify-center bg-white px-4 text-[15px] font-medium text-[#1a1a19] transition hover:bg-white/90"
            >
              Open Telegram
            </a>
          </>
        ) : (
          <p className="mt-6 text-[15px] text-white/35">Generating secure link...</p>
        )}
      </div>

      <div className="border-t border-white/[0.06]">
        <SetupRow index="01" title="Scan or open" text="Use the QR code from desktop, or the button from mobile." />
        <SetupRow index="02" title="Start the bot" text="Telegram opens the HeyRiz bot with a secure one-time token." />
        <SetupRow index="03" title="Return here" text="This page polls every few seconds and switches to conversation view once linked." />
      </div>
    </div>
  );
}

function ConversationTimeline({ turns }: { turns: ConversationTurn[] }) {
  return (
    <div className="border-t border-white/[0.06]">
      {turns.map((turn, index) => (
        <article key={`${turn.timestamp}-${index}`} className="grid gap-3 border-b border-white/[0.06] py-5 lg:grid-cols-[180px_1fr]">
          <div>
            <p className={`text-[15px] font-semibold ${turn.role === "user" ? "text-sky-300" : "text-white"}`}>
              {turn.role === "user" ? "You" : "Riz"}
            </p>
            <p className="mt-1 text-[13px] text-white/30">{new Date(turn.timestamp).toLocaleString()}</p>
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-white/75">{turn.content}</p>
        </article>
      ))}
    </div>
  );
}

function EmptyConversation() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center border border-white/[0.06] bg-[#1f1f1e] px-6 text-center">
      <p className="text-[18px] font-semibold text-white">No Telegram messages yet</p>
      <p className="mt-2 max-w-md text-[15px] leading-6 text-white/40">
        Send Riz a message in Telegram and the conversation history will appear here.
      </p>
    </div>
  );
}

function LoadingState() {
  return <p className="border-t border-white/[0.06] py-5 text-[15px] text-white/40">Loading Telegram status...</p>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t border-white/[0.04] py-3 first:border-t-0">
      <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-white/25">{label}</p>
      <p className="break-words text-[15px] text-white/75">{value}</p>
    </div>
  );
}

function SetupRow({ index, title, text }: { index: string; title: string; text: string }) {
  return (
    <div className="grid gap-3 border-b border-white/[0.06] py-5 md:grid-cols-[72px_1fr]">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/25">{index}</p>
      <div>
        <p className="text-[15px] font-semibold text-white">{title}</p>
        <p className="mt-1 text-[15px] leading-6 text-white/40">{text}</p>
      </div>
    </div>
  );
}

function StatusDot({ linked }: { linked: boolean | null }) {
  const color = linked === null ? "bg-amber-300" : linked ? "bg-emerald-300" : "bg-red-300";
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />;
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13.2 8a5.2 5.2 0 1 1-1.52-3.68" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13.2 3.2v3.2H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
