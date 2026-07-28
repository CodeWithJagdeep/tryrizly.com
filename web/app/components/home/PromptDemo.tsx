"use client";

import { useEffect, useRef, useState } from "react";

type Approval = { preview: string };

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; text: string; approval?: Approval; resolved?: "approved" | "rejected" };

const SUGGESTIONS = [
  "Check Stripe revenue for today",
  "Summarize unread emails from this morning",
  "What's on my calendar tomorrow?",
  "Remind me to call mom at 6 PM",
];

const RESPONSES: Array<{ match: RegExp; text: string; approval?: Approval }> = [
  {
    match: /stripe|razorpay|payment|payout|revenue|sales|income/i,
    text: "Revenue today is ₹18,400 across 4 Stripe payments. One payment of ₹2,300 failed (card declined). I drafted a follow-up email to the customer.",
    approval: {
      preview: "Send the drafted follow-up email about the failed ₹2,300 payment?",
    },
  },
  {
    match: /email|inbox|unread|reply|draft/i,
    text: "You have 14 unread emails. 3 need you: Sam is asking about the contract, Priya moved the design review, and a client invoice needs a reply. I drafted the reply to Sam in your tone.",
    approval: {
      preview: "Send the drafted reply to Sam confirming the contract timeline?",
    },
  },
  {
    match: /calendar|meeting|tomorrow|schedule|agenda/i,
    text: "Tomorrow you have 3 meetings: 9:30 client call (brief is ready with the last thread and 2 open action items), 13:00 design review, 16:00 investor sync. No conflicts found.",
  },
  {
    match: /remind|reminder|call mom|follow.?up/i,
    text: "Done. I'll ping you on Telegram at 6:00 PM today: \"Call mom\". If you're still in a meeting then, I'll wait until it ends.",
  },
];

const FALLBACK =
  "I'll check your inbox, calendar, and connected tools and prepare the answer. Anything outbound waits in your approval queue first.";

function respond(text: string): { text: string; approval?: Approval } {
  const hit = RESPONSES.find((r) => r.match.test(text));
  return hit ? { text: hit.text, approval: hit.approval } : { text: FALLBACK };
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.9 5.6a4 4 0 0 0 2.5 2.5L22 12l-5.6 1.9a4 4 0 0 0-2.5 2.5L12 22l-1.9-5.6a4 4 0 0 0-2.5-2.5L2 12l5.6-1.9a4 4 0 0 0 2.5-2.5L12 2z" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

/**
 * Interactive replica of the real dashboard "Ask Riz" experience:
 * same input card, same chat bubbles, same approve/reject flow.
 * Runs on sample data only.
 */
export function AskRizDemo() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setMessages((m) => [...m, { id: ++idRef.current, role: "user", text: trimmed }]);
    setInput("");
    setThinking(true);
    timerRef.current = setTimeout(() => {
      const reply = respond(trimmed);
      setMessages((m) => [
        ...m,
        { id: ++idRef.current, role: "assistant", text: reply.text, approval: reply.approval },
      ]);
      setThinking(false);
    }, 850);
  }

  function decide(id: number, decision: "approved" | "rejected") {
    setMessages((m) => [
      ...m.map((msg) => (msg.id === id ? { ...msg, resolved: decision } : msg)),
      {
        id: ++idRef.current,
        role: "assistant",
        text:
          decision === "approved"
            ? "Sent. You'll find it in your approvals history."
            : "Cancelled. Nothing was sent.",
      },
    ]);
  }

  const hasMessages = messages.length > 0 || thinking;

  return (
    <div className="w-full text-left">
      <div className="border-2 border-black bg-white shadow-[8px_8px_0_rgba(15,23,42,0.12)]">
        {/* Header, exactly like the dashboard input card */}
        <div className="flex items-center gap-2 border-b-2 border-black px-4 py-3">
          <span className="flex h-6 w-6 items-center justify-center border-2 border-black bg-[#D9BEF4]/10 text-[#D9BEF4]">
            <SparkIcon className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-bold text-slate-900">Ask Riz</span>
          <span className="ml-auto text-[11px] font-medium text-slate-400">
            Live demo · sample data
          </span>
        </div>

        {/* Conversation */}
        {hasMessages ? (
          <div
            ref={scrollRef}
            aria-live="polite"
            className="flex max-h-[300px] min-h-[160px] flex-col gap-3 overflow-y-auto border-b border-slate-200 bg-[#fbfbfa] px-4 py-4 sm:max-h-[340px]"
          >
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div
                  key={msg.id}
                  className="max-w-[85%] self-end rounded-2xl bg-slate-900 px-4 py-2.5 text-sm leading-6 text-white"
                >
                  {msg.text}
                </div>
              ) : (
                <div key={msg.id} className="flex max-w-[90%] flex-col gap-2 self-start">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm leading-6 text-slate-800">
                    {msg.text}
                  </div>
                  {msg.approval ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <p className="text-slate-600">{msg.approval.preview}</p>
                      {msg.resolved ? (
                        <p
                          className={`mt-2 text-xs font-semibold ${
                            msg.resolved === "approved" ? "text-[#D9BEF4]" : "text-slate-400"
                          }`}
                        >
                          {msg.resolved === "approved" ? "Approved" : "Rejected"}
                        </p>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => decide(msg.id, "approved")}
                            className="rounded-lg bg-[#D9BEF4] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-105"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => decide(msg.id, "rejected")}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ),
            )}
            {thinking ? (
              <div className="self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-400">
                Thinking…
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Input */}
        <form
          className="p-3"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <label htmlFor="ask-riz-demo" className="sr-only">
            Ask Riz a question
          </label>
          <textarea
            id="ask-riz-demo"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder="Ask anything, or tell me what to handle…"
            rows={2}
            disabled={thinking}
            className="w-full resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Riz is AI and can make mistakes. Actions wait for your approval.
            </span>
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              aria-label="Send"
              className="flex h-8 w-8 items-center justify-center border-2 border-black bg-[#D9BEF4] text-white transition hover:brightness-105 disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400"
            >
              <ArrowUpIcon className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Real dashboard suggestion chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ask(s)}
            className="rounded-lg border border-slate-200 bg-white/70 px-3.5 py-2 text-[13px] text-slate-700 backdrop-blur-sm transition hover:border-slate-300 hover:bg-white"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
