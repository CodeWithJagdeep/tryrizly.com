"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpIcon, ChatIcon, LibraryIcon, PlugIcon } from "./icons";
import { CreditsBadge } from "./CreditsBadge";
import { MarkdownMessage } from "./MarkdownMessage";
import { TelegramBanner } from "./TelegramBanner";
import {
  CalendarIcon,
  GitHubIcon,
  GmailIcon,
  NotionIcon,
  PostgresIcon,
  SlackIcon,
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

// Starter prompts, not personalized recommendations — each one just fills
// the composer via sendMessage, same as the suggestion chips above.
const automationIdeas: { title: string; apps: { label: string; Icon: React.ComponentType<{ className?: string }> }[] }[] = [
  {
    title: "Draft replies for every unread email that needs a response",
    apps: [{ label: "Gmail", Icon: GmailIcon }],
  },
  {
    title: "Summarize today's calendar and flag any conflicts",
    apps: [{ label: "Google Calendar", Icon: CalendarIcon }],
  },
  {
    title: "Post a daily standup summary to Slack every morning",
    apps: [{ label: "Slack", Icon: SlackIcon }],
  },
  {
    title: "Notify me on Telegram whenever a PR needs my review",
    apps: [{ label: "GitHub", Icon: GitHubIcon }, { label: "Telegram", Icon: TelegramIcon }],
  },
  {
    title: "Log new Stripe payments into a Notion database",
    apps: [{ label: "Stripe", Icon: StripeIcon }, { label: "Notion", Icon: NotionIcon }],
  },
  {
    title: "Query new signups from Postgres and summarize the week",
    apps: [{ label: "Postgres", Icon: PostgresIcon }],
  },
];

type AccessState = "loading" | "active" | "blocked";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function ChatHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [session, setSession] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [accessState, setAccessState] = useState<AccessState>("loading");
  const [recentSessions, setRecentSessions] = useState<ChatSession[]>([]);

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
    fetch("/api/chat/history")
      .then((r) => r.json())
      .then((d: { sessions?: ChatSession[] }) => setRecentSessions((d.sessions ?? []).slice(0, 4)))
      .catch(() => null);
  }, []);


  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.messages.length, sending]);

  const hasMessages = (session?.messages.length ?? 0) > 0;

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
    <main className="flex min-h-0 flex-1 flex-col bg-[#f8f8f7]">
      <div className="sticky top-0 z-10 flex h-14 w-full shrink-0 items-center justify-between border-b border-transparent bg-[#f8f8f7] px-4 md:px-6">
        <div className="flex h-8 items-center rounded-lg px-2 text-base font-medium text-slate-900 md:text-lg">
          Agent v1
        </div>
        <CreditsBadge />
      </div>
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
                            className="rounded-lg bg-[#FE7F2D] px-3 py-1.5 text-xs font-normal text-white transition hover:brightness-105 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={sending}
                            onClick={() => handleReject(approval)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-normal text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
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

          <div className="sticky bottom-0 bg-[#f8f8f7] px-6 pb-24 pt-3 lg:pb-8">
            <div className="mx-auto w-full max-w-2xl">
              <TelegramBanner />
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
        <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-[#f8f8f7] px-6 pb-24 lg:pb-16">
          {/* Ambient dotted texture */}
          <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,rgba(15,23,42,0.045)_1px,transparent_1px)] [background-size:18px_18px]" />

          <div className="relative z-10 flex w-full flex-col items-center">
            {/* Search section — 80vh tall, input bar centered */}
            <div className="flex h-[80vh] w-full max-w-2xl flex-col items-center justify-center">
              <p className="mb-2 text-center text-xs font-medium uppercase tracking-[0.14em] text-[#FE7F2D]">
                Chat. Automate.
              </p>
              <h1 className="text-center text-[26px] font-normal tracking-tight text-slate-900 sm:text-[32px]">
                What do you want to automate?
              </h1>

              {/* Copilot-style input card */}
              <div className="mt-8 w-full">
                <TelegramBanner />
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

            {/* Ideas to automate — curated starter prompts, not personalized recommendations */}
            <div className="mt-8 w-full max-w-6xl">
              <p className="mb-3 text-base font-normal text-slate-900">Ideas to automate</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {automationIdeas.map((idea) => (
                  <button
                    key={idea.title}
                    type="button"
                    disabled={accessState !== "active"}
                    onClick={() => sendMessage(idea.title)}
                    className="flex flex-col items-start gap-3 rounded-lg border border-slate-200 bg-white/70 px-4 py-3 text-left backdrop-blur-sm transition-all hover:border-slate-300 hover:bg-white hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <p className="text-sm font-normal text-slate-900">{idea.title}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">Works with:</span>
                      {idea.apps.map(({ label, Icon }) => (
                        <span key={label} title={label} className="flex h-5 w-5 items-center justify-center rounded bg-white ring-1 ring-slate-200">
                          <Icon className="h-full w-full" />
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Jump back in — your own recent chats, not fake data */}
            {recentSessions.length > 0 && (
              <div className="mt-8 w-full max-w-6xl">
                <p className="mb-3 text-base font-normal text-slate-900">Jump back in</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {recentSessions.map((s) => (
                    <Link
                      key={s.id}
                      href={`/dashboard?session=${s.id}`}
                      className="group flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/70 p-4 backdrop-blur-sm transition-all hover:border-slate-300 hover:bg-white hover:shadow-md"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#FE7F2D]/10 text-[#FE7F2D]">
                        <ChatIcon className="h-4 w-4" />
                      </span>
                      <p className="truncate text-sm font-normal text-slate-900">{s.title}</p>
                      <p className="text-xs text-slate-400">Edited {timeAgo(s.updatedAt)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
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
      <div className="flex min-h-32 flex-col items-center justify-center rounded-[22px] border border-black/10 bg-white px-5 py-5 text-center shadow-[0px_12px_32px_0px_rgba(0,0,0,0.03)]">
        <p className="text-sm font-normal text-slate-900">Your free trial has ended</p>
        <p className="mt-1 text-sm text-slate-500">Choose a paid plan to continue using Riz.</p>
        <Link
          href="/dashboard/upgrade"
          className="mt-4 rounded-full bg-[#FE7F2D] px-5 py-2 text-sm font-normal text-white transition hover:brightness-105"
        >
          View plans
        </Link>
      </div>
    );
  }

  const accessLoading = accessState === "loading";

  return (
    <form
      className="rounded-[22px] border border-black/10 bg-white py-3 shadow-[0px_12px_32px_0px_rgba(0,0,0,0.03)] transition focus-within:border-black/20"
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
        placeholder={accessLoading ? "Checking plan access…" : "Ask anything, or tell me what to handle…"}
        rows={1}
        disabled={sending || accessLoading}
        className="min-h-[50px] max-h-[216px] w-full resize-none bg-transparent px-4 text-[15px] leading-6 text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
      />
      <div className="mt-2 flex items-center justify-between gap-2 px-3">
        <Link
          href="/dashboard/connectors"
          title="Connectors"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          <PlugIcon className="h-4 w-4" />
          Connectors
        </Link>
        <button
          type="submit"
          disabled={!message.trim() || sending || accessLoading}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white transition hover:opacity-90 disabled:bg-slate-200 disabled:text-slate-400"
        >
          <ArrowUpIcon className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
