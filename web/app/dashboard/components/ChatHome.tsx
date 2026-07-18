"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpIcon, LibraryIcon } from "./icons";
import { MarkdownMessage } from "./MarkdownMessage";
import {
  CalendarIcon,
  GmailIcon,
  MongoDbIcon,
  PostgresIcon,
  StripeIcon,
  TelegramIcon,
} from "../../components/ConnectorIcons";
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

type AccessState = "loading" | "active" | "blocked";

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
  const [connectorProviders, setConnectorProviders] = useState<Set<string>>(new Set());
  const [accessState, setAccessState] = useState<AccessState>("loading");

  useEffect(() => {
    setError(null);
    if (!sessionId) {
      setSession(null);
      return;
    }

    const local = getSession(sessionId);
    if (local) {
      setSession(local);
      return;
    }

    // Not a locally-cached session — it may be one grouped from the
    // database (e.g. clicked from sidebar history built off Telegram/DB
    // turns). Fetch and hydrate it, then persist locally so continuing
    // the conversation works through the normal send flow.
    let cancelled = false;
    setSession(null);
    fetch("/api/chat/history")
      .then((r) => r.json())
      .then((d: { sessions?: ChatSession[] }) => {
        if (cancelled) return;
        const found = d.sessions?.find((s) => s.id === sessionId);
        if (found) {
          setSession(found);
          saveSession(found);
        }
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    fetch("/api/billing/status")
      .then(async (response) => {
        if (!response.ok) throw new Error("billing_status_unavailable");
        return response.json() as Promise<{ access?: { active?: boolean } }>;
      })
      .then((billing) => setAccessState(billing.access?.active ? "active" : "blocked"))
      .catch(() => setAccessState("blocked"));
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
      .then((d: { connectors?: { provider?: string }[] }) => {
        const providers = (d.connectors ?? [])
          .map((c) => c.provider)
          .filter((p): p is string => Boolean(p));
        setConnectorProviders(new Set(providers));
      })
      .catch(() => null);
  }, []);


  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.messages.length, sending]);

  const firstName = name?.split(" ")[0];
  const hasMessages = (session?.messages.length ?? 0) > 0;

  const googleConnected = Boolean(onboarding?.googleConnected);
  const connectTiles = [
    { title: "Telegram", subtitle: "Reminders & briefs on your phone", href: "/dashboard/telegram", Icon: TelegramIcon, connected: Boolean(telegramLinked) },
    { title: "Gmail", subtitle: "Triage inbox & draft replies", href: "/dashboard/connectors", Icon: GmailIcon, connected: googleConnected || connectorProviders.has("gmail") || connectorProviders.has("google") },
    { title: "Google Calendar", subtitle: "Meetings & scheduling", href: "/dashboard/connectors", Icon: CalendarIcon, connected: googleConnected || connectorProviders.has("calendar") || connectorProviders.has("google") },
    { title: "Postgres", subtitle: "Query your database", href: "/dashboard/connectors", Icon: PostgresIcon, connected: connectorProviders.has("postgres") },
    { title: "Stripe", subtitle: "Revenue & subscriptions", href: "/dashboard/connectors", Icon: StripeIcon, connected: connectorProviders.has("stripe") },
    { title: "MongoDB", subtitle: "Query your collections", href: "/dashboard/connectors", Icon: MongoDbIcon, connected: connectorProviders.has("mongodb") },
  ];

  async function runTurn(
    displayContent: string,
    apiOverrides: { approve?: boolean; pendingApprovalId?: string } = {},
  ) {
    if (sending || accessState !== "active") return;

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
        upgradeRequired?: boolean;
      } | null;
      if (response.status === 402 || data?.upgradeRequired) {
        setAccessState("blocked");
      }
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
    await runTurn("Approve", { approve: true, pendingApprovalId: approval.id });
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
    <main className="flex min-h-0 flex-1 flex-col bg-white">
      {hasMessages ? (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-36 lg:pb-8">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {session!.messages.map((turn, index) => {
                const isLast = index === session!.messages.length - 1;
                const approval = turn.pendingApproval;
                return (
                  <div key={index} className="flex flex-col gap-2 self-stretch">
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                        turn.role === "user"
                          ? "self-end bg-slate-900 text-white whitespace-pre-wrap"
                          : "self-start border border-slate-200 bg-slate-50 text-slate-800"
                      }`}
                    >
                      {turn.role === "user" ? turn.content : <MarkdownMessage content={turn.content} />}
                    </div>
                    {approval && !approval.resolved && isLast && (
                      <div className="self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                        <p className="text-slate-600">{approval.preview}</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={sending || accessState !== "active"}
                            onClick={() => void handleApprove(approval)}
                            className="rounded-lg bg-[#FE7F2D] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={sending}
                            onClick={() => handleReject(approval)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
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
                <div className="self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-400">
                  Thinking…
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 bg-white px-6 pb-24 pt-3 lg:pb-8">
            <div className="mx-auto w-full max-w-2xl">
              {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
              <ChatInputForm
                accessState={accessState}
                message={message}
                sending={sending}
                onMessageChange={setMessage}
                onSubmit={sendMessage}
              />
            </div>
          </div>
        </>
      ) : (
        <div
          className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pb-24 lg:pb-16"
          style={{
            background:
              "radial-gradient(60% 45% at 50% 0%, rgba(254,127,45,0.08), transparent 62%), radial-gradient(42% 34% at 88% 6%, rgba(96,165,250,0.06), transparent 60%), radial-gradient(42% 34% at 10% 12%, rgba(244,114,182,0.06), transparent 60%), #fbfbfa",
          }}
        >
          {/* Ambient dotted texture */}
          <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,rgba(15,23,42,0.045)_1px,transparent_1px)] [background-size:18px_18px]" />

          <div className="relative z-10 flex w-full flex-col items-center">
            {/* Search section — 80vh tall, input bar centered */}
            <div className="flex h-[80vh] w-full max-w-2xl flex-col items-center justify-center">
              <h1 className="text-center text-[26px] font-bold tracking-tight text-slate-900 sm:text-[32px]">
                {firstName ? `What's on your mind today, ${firstName}?` : "What's on your mind today?"}
              </h1>

              {/* Copilot-style input card */}
              <div className="mt-8 w-full">
                {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
                <ChatInputForm
                  accessState={accessState}
                  message={message}
                  sending={sending}
                  onMessageChange={setMessage}
                  onSubmit={sendMessage}
                />
                <p className="mt-2.5 text-center text-xs text-slate-400">
                  Riz is AI and can make mistakes. Double-check important actions.
                </p>
              </div>

              {/* Question prompts — directly below the input */}
              <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={accessState !== "active"}
                    onClick={() => sendMessage(suggestion)}
                    className="rounded-lg border border-slate-200 bg-white/70 px-4 py-2 text-sm text-slate-700 backdrop-blur-sm transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {suggestion}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={openChatSearch}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/70 px-4 py-2 text-sm text-slate-700 backdrop-blur-sm transition hover:border-slate-300 hover:bg-white"
                >
                  <LibraryIcon className="h-4 w-4 text-slate-400" />
                  Chat library
                </button>
              </div>
            </div>

            {/* Connect your tools — the "Start from scratch" section */}
            <div className="w-full max-w-6xl">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="text-base font-bold text-slate-900">Connect your tools</p>
                <span className="text-xs font-medium text-slate-400 tabular-nums">
                  {connectTiles.filter((t) => t.connected).length} of {connectTiles.length} connected
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {connectTiles.map((t) => {
                  const Icon = t.Icon;
                  return (
                    <Link
                      key={t.title}
                      href={t.href}
                      className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-sm transition-all hover:border-slate-300 hover:bg-white hover:shadow-md"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{t.title}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{t.subtitle}</p>
                      </div>
                      {t.connected ? (
                        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Connected
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] font-semibold text-[#FE7F2D] transition-transform group-hover:translate-x-0.5">
                          Connect →
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ChatInputForm({
  accessState,
  message,
  sending,
  onMessageChange,
  onSubmit,
}: {
  accessState: AccessState;
  message: string;
  sending: boolean;
  onMessageChange: (v: string) => void;
  onSubmit: (v: string) => void;
}) {
  if (accessState === "blocked") {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center border-2 border-black bg-white px-5 py-5 text-center">
        <p className="text-sm font-bold text-slate-900">Your free trial has ended</p>
        <p className="mt-1 text-sm text-slate-500">Choose a paid plan to continue using Riz.</p>
        <Link
          href="/dashboard/upgrade"
          className="mt-4 bg-[#FE7F2D] px-5 py-2 text-sm font-bold text-white transition hover:brightness-105"
        >
          View plans
        </Link>
      </div>
    );
  }

  const accessLoading = accessState === "loading";

  return (
    <form
      className="border-2 border-black bg-white transition"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(message);
      }}
    >
      <div className="flex items-center gap-2 border-b-2 border-black px-4 py-3">
        <span className="flex h-6 w-6 items-center justify-center border-2 border-black bg-[#FE7F2D]/10 text-[#FE7F2D]">
          <SparkIcon className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-bold text-slate-900">Ask Riz</span>
      </div>
      <div className="p-3">
        <textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit(message);
            }
          }}
          placeholder={accessLoading ? "Checking plan access…" : "Ask anything, or tell me what to handle…"}
          rows={3}
          disabled={sending || accessLoading}
          className="w-full resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={!message.trim() || sending || accessLoading}
            className="flex h-8 w-8 items-center justify-center border-2 border-black bg-[#FE7F2D] text-white transition hover:brightness-105 disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </form>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.9 5.6a4 4 0 0 0 2.5 2.5L22 12l-5.6 1.9a4 4 0 0 0-2.5 2.5L12 22l-1.9-5.6a4 4 0 0 0-2.5-2.5L2 12l5.6-1.9a4 4 0 0 0 2.5-2.5L12 2z" />
    </svg>
  );
}
