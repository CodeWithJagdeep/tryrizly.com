"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpIcon, CalendarIcon, ClockIcon, MailIcon, PlugIcon, UsersIcon, VideoIcon } from "./icons";
import { SlackIcon, TelegramIcon } from "../../components/ConnectorIcons";
import { MarkdownMessage } from "./MarkdownMessage";
import { ChannelConnectModal } from "./ChannelConnectModal";
import { ConnectorShowcase } from "./ConnectorShowcase";
import { CreditsBadge } from "./CreditsBadge";
import {
  type ChatSession,
  type PendingApproval,
  type StoredMessage,
  deriveTitle,
  getSession,
  isContextPaused,
  saveSession,
} from "../lib/chat-store";

const starters = [
  { label: "Connectors", desc: "Connect Gmail, Slack, Stripe & more", href: "/dashboard/connectors", icon: PlugIcon },
  { label: "Emails", desc: "Inbox triage & approved replies", href: "/dashboard/emails", icon: MailIcon },
  { label: "Calendar", desc: "Bookings & reminders", href: "/dashboard/calendar", icon: CalendarIcon },
  { label: "Meetings", desc: "Notes & follow-ups", href: "/dashboard/meetings", icon: VideoIcon },
  { label: "People", desc: "Contacts Riz keeps track of", href: "/dashboard/people", icon: UsersIcon },
  { label: "Scheduled", desc: "Upcoming automated runs", href: "/dashboard/scheduled", icon: ClockIcon },
];

type AccessState = "loading" | "active" | "blocked";

export function ChatHome({ userName }: { userName?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [session, setSession] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [accessState, setAccessState] = useState<AccessState>("loading");
  const [channelModal, setChannelModal] = useState<{ open: boolean; tab: "telegram" | "slack" }>({ open: false, tab: "telegram" });

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
  }, []);


  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.messages.length, sending]);

  const hasMessages = (session?.messages.length ?? 0) > 0;
  const firstName = userName?.trim().split(/\s+/)[0];

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
          sessionId: withUserTurn.id,
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
    <main className="my-2 mr-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[15px] border border-[#2d2e31] bg-[#111315] text-[#d1d0d3] lg:h-[calc(100dvh-1rem)] lg:flex-none">
      <div className="flex h-14 shrink-0 items-center justify-end border-b border-[#2d2e31] px-4 md:px-6">
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
                          ? "self-end bg-[#2b2b2e] text-white whitespace-pre-wrap"
                          : "self-start border border-[#39393d] bg-[#202124] text-[#e5e4e7]"
                      }`}
                    >
                      {turn.role === "user" ? turn.content : <MarkdownMessage content={turn.content} />}
                    </div>
                    {approval && !approval.resolved && isLast && (
                      <div className="self-start rounded-2xl border border-[#39393d] bg-[#202124] px-4 py-3 text-sm text-[#e5e4e7]">
                        <p className="text-[#aaa9ad]">{approval.preview}</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={sending || accessState !== "active"}
                            onClick={() => void handleApprove(approval)}
                            className="rounded-lg bg-[#D9BEF4] px-3 py-1.5 text-xs font-medium text-[#1a1a1c] transition hover:brightness-95 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={sending}
                            onClick={() => handleReject(approval)}
                            className="rounded-lg border border-[#39393d] px-3 py-1.5 text-xs font-medium text-[#aaa9ad] transition hover:bg-white/5 disabled:opacity-50"
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
                <div className="self-start rounded-2xl border border-[#39393d] bg-[#202124] px-4 py-2.5 text-sm text-[#aaa9ad]">
                  Thinking…
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-[#212226] bg-[#111315] px-6 pb-24 pt-3 lg:pb-8">
            <div className="mx-auto w-full max-w-2xl">
              <ChannelToggleRow onOpen={(tab) => setChannelModal({ open: true, tab })} />
              {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
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
          className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-[#111315] px-6 pb-16"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        >
          <div className="relative z-10 flex w-full flex-col items-center">
            <div className="flex w-full max-w-5xl flex-col items-center justify-end pb-0 pt-16">
              <div className="mt-18 w-full max-w-2xl">
                <h1 className="mb-8 text-center text-[30px] font-semibold tracking-tight text-white sm:text-[34px]">
                  {firstName ? `What's on your list today, ${firstName}?` : "What can I help with?"}
                </h1>
                <ChannelToggleRow onOpen={(tab) => setChannelModal({ open: true, tab })} />
                {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
                <ChatInputForm
                  accessState={accessState}
                  message={message}
                  sending={sending}
                  onMessageChange={setMessage}
                  onSubmit={sendMessage}
                />
              </div>

              <ConnectorShowcase />

              <p className="mt-8 mb-2 w-full text-left text-[15px] font-semibold text-white">Start from scratch</p>
              <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
                {starters.map((starter) => {
                  const Icon = starter.icon;
                  return (
                    <Link
                      key={starter.label}
                      href={starter.href}
                      className="flex items-start gap-3 rounded-xl border border-[#2d2e31] bg-[#18191b] px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#D9BEF4]/60 hover:bg-[#1c1d20]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2a223a] text-[#D9BEF4]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-white">{starter.label}</span>
                        <span className="block truncate text-[12.5px] text-[#8a898f]">{starter.desc}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      <ChannelConnectModal
        open={channelModal.open}
        initialTab={channelModal.tab}
        onClose={() => setChannelModal((prev) => ({ ...prev, open: false }))}
      />
    </main>
  );
}

function ChannelToggleRow({ onOpen }: { onOpen: (tab: "telegram" | "slack") => void }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-[13px] text-[#77767b]">Continue in</span>
      <button
        type="button"
        onClick={() => onOpen("telegram")}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#2d2e31] bg-[#18191b] px-3 py-1.5 text-[13px] font-medium text-[#c9c8cb] transition hover:border-[#D9BEF4]/60 hover:text-white"
      >
        <TelegramIcon className="h-4 w-4" />
        Telegram
      </button>
      <button
        type="button"
        onClick={() => onOpen("slack")}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#2d2e31] bg-[#18191b] px-3 py-1.5 text-[13px] font-medium text-[#c9c8cb] transition hover:border-[#D9BEF4]/60 hover:text-white"
      >
        <SlackIcon className="h-4 w-4" />
        Slack
      </button>
    </div>
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
      <div className="flex min-h-32 flex-col items-center justify-center rounded-[20px] border border-[#48484c] bg-[#202124] px-5 py-5 text-center">
        <p className="text-sm font-medium text-white">Your free trial has ended</p>
        <p className="mt-1 text-sm text-[#aaa9ad]">Choose a paid plan to continue using Riz.</p>
        <Link
          href="/dashboard/upgrade"
          className="mt-4 rounded-full bg-[#1683ff] px-5 py-2 text-sm font-medium text-white transition hover:brightness-105"
        >
          View plans
        </Link>
      </div>
    );
  }

  const accessLoading = accessState === "loading";

  const canSubmit = Boolean(message.trim()) && !sending && !accessLoading;

  return (
    <form
      className="overflow-hidden rounded-[20px] border border-[#39393d] bg-[#1a1b1d] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] transition focus-within:border-[#D9BEF4]/50 focus-within:shadow-[0_8px_30px_-10px_rgba(217,190,244,0.15)]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(message);
      }}
    >
      <div className="flex items-center gap-2 border-b border-[#2a2b2e] px-5 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2a223a] text-[13px] text-[#D9BEF4]">✦</span>
        <span className="text-[13px] font-semibold uppercase tracking-wide text-[#c9c8cb]">Ask Riz</span>
      </div>
      <textarea
        value={message}
        onChange={(event) => onMessageChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit(message);
          }
        }}
        placeholder={accessLoading ? "Checking plan access…" : 'Type "/" to invoke plugins and skills'}
        rows={1}
        disabled={sending || accessLoading}
        className="min-h-[82px] max-h-[216px] w-full resize-none bg-transparent px-5 pt-3 text-[16px] leading-6 text-white placeholder:text-[#77767b] focus:outline-none disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-2 border-t border-[#2a2b2e]/60 px-5 py-2.5">
        <span className="text-[12px] text-[#5c5b60]">Shift + Enter for a new line</span>
        <button
          type="submit"
          disabled={!canSubmit}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
            canSubmit
              ? "bg-[#D9BEF4] text-[#1a1a1c] hover:brightness-95"
              : "bg-[#2d2e31] text-[#5c5b60]"
          }`}
        >
          <ArrowUpIcon className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
