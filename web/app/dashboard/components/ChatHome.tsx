"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpIcon,
  BoltIcon,
  LayersIcon,
  LibraryIcon,
  MicIcon,
  PlusIcon,
  SlidersIcon,
} from "./icons";
import {
  type ChatSession,
  type PendingApproval,
  type StoredMessage,
  deriveTitle,
  getSession,
  isContextPaused,
  openChatSearch,
  saveSession,
} from "../lib/chat-store";

const suggestions = [
  "What tasks were still incomplete the last time I worked?",
  "Show me how my focus time changed over the past few weeks.",
  "Summarize unread emails from this morning.",
];

export function ChatHome({ name }: { name?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [session, setSession] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const [onboarding, setOnboarding] = useState<{ googleConnected?: boolean; telegramLinked?: boolean } | null>(null);
  const [connectorsCount, setConnectorsCount] = useState(0);

  useEffect(() => {
    setSession(sessionId ? getSession(sessionId) ?? null : null);
    setError(null);
  }, [sessionId]);

  useEffect(() => {
    fetch("/api/telegram")
      .then((r) => r.json())
      .then((d: { linked?: boolean }) => setTelegramLinked(Boolean(d.linked)))
      .catch(() => null);
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((d: { onboarding?: { googleConnected?: boolean; telegramLinked?: boolean } }) =>
        setOnboarding(d.onboarding ?? {}),
      )
      .catch(() => null);
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((d: { connectors?: unknown[] }) => setConnectorsCount(d.connectors?.length ?? 0))
      .catch(() => null);
  }, []);


  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.messages.length, sending]);

  const firstName = name?.split(" ")[0];
  const hasMessages = (session?.messages.length ?? 0) > 0;

  async function runTurn(
    displayContent: string,
    apiOverrides: { approve?: boolean; pendingApproval?: { tool: string; payload: unknown } } = {},
  ) {
    if (sending) return;

    setError(null);
    setSending(true);

    const now = new Date().toISOString();
    const base: ChatSession =
      session ?? {
        id: crypto.randomUUID(),
        title: "New chat",
        messages: [],
        favorite: false,
        updatedAt: now,
      };

    const userTurn: StoredMessage = { role: "user", content: displayContent, timestamp: now };
    const withUserTurn: ChatSession = {
      ...base,
      title: base.messages.length === 0 ? deriveTitle(displayContent) : base.title,
      messages: [...base.messages, userTurn],
      updatedAt: now,
    };

    setSession(withUserTurn);
    saveSession(withUserTurn);
    if (!sessionId) {
      router.replace(`/dashboard?session=${withUserTurn.id}`);
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: apiOverrides.approve ? "approved" : displayContent,
          history: isContextPaused()
            ? []
            : withUserTurn.messages.slice(0, -1).map((turn) => ({ role: turn.role, content: turn.content })),
          ...apiOverrides,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        reply?: string;
        pendingApproval?: PendingApproval;
        error?: string;
      } | null;
      if (!response.ok || !data?.reply) {
        throw new Error(data?.error || "The assistant didn't respond.");
      }

      const assistantTurn: StoredMessage = {
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toISOString(),
        pendingApproval: data.pendingApproval,
      };
      const withReply: ChatSession = {
        ...withUserTurn,
        messages: [...withUserTurn.messages, assistantTurn],
        updatedAt: new Date().toISOString(),
      };
      setSession(withReply);
      saveSession(withReply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessage("");
    await runTurn(trimmed);
  }

  async function handleApprove(approval: PendingApproval) {
    await runTurn("Approve", { approve: true, pendingApproval: { tool: approval.tool, payload: approval.payload } });
  }

  function handleReject(approval: PendingApproval) {
    if (!session) return;
    const resolved: ChatSession = {
      ...session,
      messages: session.messages.map((turn) =>
        turn.pendingApproval === approval
          ? { ...turn, pendingApproval: { ...approval, resolved: "rejected" as const } }
          : turn,
      ),
    };
    const withCancelNote: ChatSession = {
      ...resolved,
      messages: [
        ...resolved.messages,
        { role: "assistant", content: "Cancelled.", timestamp: new Date().toISOString() },
      ],
      updatedAt: new Date().toISOString(),
    };
    setSession(withCancelNote);
    saveSession(withCancelNote);
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#1a1a19]">
      {hasMessages ? (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {session!.messages.map((turn, index) => {
                const isLast = index === session!.messages.length - 1;
                const approval = turn.pendingApproval;
                return (
                  <div key={index} className="flex flex-col gap-2 self-stretch">
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap ${
                        turn.role === "user"
                          ? "self-end bg-[#f2f1ec] text-[#1a1a19]"
                          : "self-start border border-[#2e2e2c] bg-[#232321] text-[#f2f1ec]"
                      }`}
                    >
                      {turn.content}
                    </div>
                    {approval && !approval.resolved && isLast && (
                      <div className="self-start rounded-2xl border border-[#2e2e2c] bg-[#232321] px-4 py-3 text-sm text-[#f2f1ec]">
                        <p className="text-[#cfcfc7]">{approval.preview}</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={sending}
                            onClick={() => void handleApprove(approval)}
                            className="rounded-lg bg-[#f2f1ec] px-3 py-1.5 text-xs font-semibold text-[#1a1a19] transition disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={sending}
                            onClick={() => handleReject(approval)}
                            className="rounded-lg border border-[#2e2e2c] px-3 py-1.5 text-xs font-semibold text-[#cfcfc7] transition hover:bg-[#2a2a28] disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {sending && (
                <div className="self-start rounded-2xl border border-[#2e2e2c] bg-[#232321] px-4 py-2.5 text-sm text-[#a8a399]">
                  Thinking…
                </div>
              )}
            </div>
          </div>

          <div className="px-6 pb-8">
            <div className="mx-auto w-full max-w-2xl">
              {error && <p className="mb-2 text-sm text-[#f87171]">{error}</p>}
              <ChatInputForm message={message} sending={sending} onMessageChange={setMessage} onSubmit={sendMessage} />
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
          <h1 className="text-center text-2xl font-semibold text-[#f2f1ec] sm:text-3xl">
            {firstName ? `What's on your mind today, ${firstName}?` : "What's on your mind today?"}
          </h1>

          {/* Feature highlight: Telegram USP + DB connectors */}
          <div className="mt-6 flex w-full max-w-2xl gap-3">
            <Link
              href="/dashboard/telegram"
              className="group relative flex flex-1 flex-col gap-1.5 overflow-hidden rounded-2xl border border-[#2e4a5c] bg-[#1a2e3a] px-4 py-3.5 transition hover:border-[#3a6a8a] hover:bg-[#1f3545]"
            >
              <div className="flex items-center gap-2">
                <TelegramIcon className="h-4 w-4 text-[#4da8d8] shrink-0" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4da8d8]">Telegram</p>
                {telegramLinked === true && (
                  <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    Connected
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-[#f2f1ec]">
                {telegramLinked ? "Chat via Telegram" : "Start chatting on Telegram"}
              </p>
              <p className="text-xs text-[#6b8fa0]">
                {telegramLinked
                  ? "Send messages, get reminders & briefs right on your phone"
                  : "Your primary channel — reminders, briefs & replies on Telegram"}
              </p>
            </Link>

            <Link
              href="/dashboard/connectors"
              className="group flex flex-1 flex-col gap-1.5 rounded-2xl border border-[#2e2e2c] bg-[#232321] px-4 py-3.5 transition hover:border-[#3e3e3c] hover:bg-[#2a2a28]"
            >
              <div className="flex items-center gap-2">
                <DatabaseIcon className="h-4 w-4 text-[#a89878] shrink-0" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b6b63]">DB Connectors</p>
              </div>
              <p className="text-sm font-medium text-[#f2f1ec]">Connect your database</p>
              <p className="text-xs text-[#6b6b63]">
                Postgres &amp; MongoDB — query and analyze your data via Riz
              </p>
            </Link>
          </div>

          {onboarding && (
            <OnboardingChecklist
              googleConnected={Boolean(onboarding.googleConnected)}
              telegramLinked={Boolean(onboarding.telegramLinked)}
              hasConnectors={connectorsCount > 0}
            />
          )}

          <div className="mt-4 w-full max-w-2xl">
            {error && <p className="mb-2 text-sm text-[#f87171]">{error}</p>}
            <ChatInputForm message={message} sending={sending} onMessageChange={setMessage} onSubmit={sendMessage} />
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="rounded-full border border-[#2e2e2c] bg-[#232321] px-4 py-2 text-sm text-[#cfcfc7] shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition hover:bg-[#2a2a28]"
                >
                  {suggestion}
                </button>
              ))}
              <button
                type="button"
                onClick={openChatSearch}
                className="flex items-center gap-1.5 rounded-full border border-[#2e2e2c] bg-[#232321] px-4 py-2 text-sm text-[#cfcfc7] shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition hover:bg-[#2a2a28]"
              >
                <LibraryIcon className="h-4 w-4 text-[#8a8578]" />
                Chat library
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ChatInputForm({
  message,
  sending,
  onMessageChange,
  onSubmit,
}: {
  message: string;
  sending: boolean;
  onMessageChange: (v: string) => void;
  onSubmit: (v: string) => void;
}) {
  return (
    <form
      className="rounded-2xl border border-[#2e2e2c] bg-[#232321] p-3 shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(message);
      }}
    >
      <textarea
        value={message}
        onChange={(event) => onMessageChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit(message);
          }
        }}
        placeholder="Ask anything, or tell me what to handle..."
        rows={2}
        disabled={sending}
        className="w-full resize-none bg-transparent text-sm text-[#f2f1ec] placeholder:text-[#6b6b63] focus:outline-none disabled:opacity-60"
      />
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <IconButton title="Attach (coming soon)"><PlusIcon className="h-4 w-4" /></IconButton>
          <IconButton title="Layers (coming soon)"><LayersIcon className="h-4 w-4" /></IconButton>
          <IconButton title="Tune (coming soon)"><SlidersIcon className="h-4 w-4" /></IconButton>
          <IconButton title="Quick action (coming soon)"><BoltIcon className="h-4 w-4" /></IconButton>
        </div>
        <div className="flex items-center gap-2">
          <IconButton title="Voice input (coming soon)"><MicIcon className="h-4 w-4" /></IconButton>
          <button
            type="submit"
            disabled={!message.trim() || sending}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f2f1ec] text-[#1a1a19] transition disabled:opacity-40"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </form>
  );
}

function IconButton({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a8578] transition hover:bg-[#2a2a28]"
    >
      {children}
    </button>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.94z" />
    </svg>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v4c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
      <path d="M3 9v4c0 1.657 4.03 3 9 3s9-1.343 9-3V9" />
      <path d="M3 13v4c0 1.657 4.03 3 9 3s9-1.343 9-3v-4" />
    </svg>
  );
}

function CheckStep({ done, label, href }: { done: boolean; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-sm transition hover:opacity-80">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${done ? "border-emerald-500 bg-emerald-500/15 text-emerald-400" : "border-white/20 text-white/30"}`}>
        {done ? (
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
        )}
      </span>
      <span className={done ? "text-white/40 line-through" : "text-white/80"}>{label}</span>
    </Link>
  );
}

function OnboardingChecklist({ googleConnected, telegramLinked, hasConnectors }: {
  googleConnected: boolean;
  telegramLinked: boolean;
  hasConnectors: boolean;
}) {
  const allDone = googleConnected && telegramLinked && hasConnectors;
  if (allDone) return null;

  return (
    <div className="mt-5 w-full max-w-2xl rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/30">Get started</p>
      <div className="flex flex-col gap-2.5">
        <CheckStep done={googleConnected} label="Connect Gmail & Calendar" href="/dashboard/connectors" />
        <CheckStep done={telegramLinked} label="Link Telegram for notifications" href="/dashboard/telegram" />
        <CheckStep done={hasConnectors} label="Connect a data source (Postgres, Stripe…)" href="/dashboard/connectors" />
      </div>
    </div>
  );
}
