'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

type MsgFrom = 'riz' | 'user';

interface ChatMessage {
  id: number;
  from: MsgFrom;
  text: string;
  time: string;
  actions?: string[];
  tag?: 'completed' | 'warning';
  delayMs: number;
}

const conversation: ChatMessage[] = [
  {
    id: 1,
    from: 'riz',
    text: "Good morning. I've triaged overnight email. 3 newsletters archived, 1 investor reply flagged. Your day has 2 calendar conflicts I've already resolved.",
    time: '7:42 AM',
    delayMs: 600,
  },
  {
    id: 2,
    from: 'riz',
    text: "Markus from Gradient Ventures replied about Series A. He wants Tuesday 10 AM. I've drafted a reply confirming and built a prep packet - ARR, churn rate, and the last thread are all attached to the calendar hold.",
    time: '11:03 AM',
    actions: ['Approve reply', 'Edit draft', 'Skip for now'],
    delayMs: 2200,
  },
  {
    id: 3,
    from: 'user',
    text: 'Approve reply',
    time: '11:04 AM',
    delayMs: 4000,
  },
  {
    id: 4,
    from: 'riz',
    text: "Done. Reply sent to Markus. Tuesday 10 AM is locked with a full prep packet. I'll remind you 30 minutes before.",
    time: '11:04 AM',
    tag: 'completed',
    delayMs: 4800,
  },
  {
    id: 5,
    from: 'riz',
    text: "One more thing - your Stripe dashboard shows a renewal coming up Friday. Champion hasn't replied in 6 days. I've drafted a nudge.",
    time: '11:04 AM',
    actions: ['Send nudge', 'Edit', 'Remind me tomorrow'],
    tag: 'warning',
    delayMs: 6400,
  },
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-slate-500"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

function RizBubble({
  msg,
  onAction,
  actionDone,
}: {
  msg: ChatMessage;
  onAction?: (action: string) => void;
  actionDone?: boolean;
}) {
  return (
    <div className="flex max-w-[88%] self-start">
      <div className="rounded-2xl rounded-tl-sm bg-[#182533] px-4 py-3">
        <p className="text-[13px] leading-relaxed text-slate-200">{msg.text}</p>

        {msg.tag === 'completed' && (
          <div className="mt-2 flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 7l3.5 3.5L12 3" />
            </svg>
            <span className="text-[11px] font-semibold text-emerald-400">Action completed</span>
          </div>
        )}

        {msg.tag === 'warning' && !actionDone && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="text-[11px] font-semibold text-amber-400">Action needed</span>
          </div>
        )}

        {msg.actions && !actionDone && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => onAction?.(msg.actions![0])}
              className="rounded-lg bg-[#3784ff] px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#2c72e5] active:scale-[0.97]"
            >
              {msg.actions[0]}
            </button>
            {msg.actions.slice(1).map((a) => (
              <button
                key={a}
                onClick={() => onAction?.(a)}
                className="rounded-lg border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08]"
              >
                {a}
              </button>
            ))}
          </div>
        )}

        {msg.actions && actionDone && (
          <div className="mt-2 flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 7l3.5 3.5L12 3" />
            </svg>
            <span className="text-[11px] font-semibold text-emerald-400">Handled</span>
          </div>
        )}

        <p className="mt-2 text-[10px] text-slate-500">{msg.time}</p>
      </div>
    </div>
  );
}

function UserBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex max-w-[70%] self-end">
      <div className="rounded-2xl rounded-tr-sm bg-[#2b5278] px-4 py-3">
        <p className="text-[13px] text-white">{msg.text}</p>
        <p className="mt-1.5 text-[10px] text-blue-300/70">{msg.time} ✓✓</p>
      </div>
    </div>
  );
}

function TelegramChat() {
  const reduce = useReducedMotion();
  const [visibleIds, setVisibleIds] = useState<number[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [actionDone, setActionDone] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (reduce) {
      setVisibleIds(conversation.map((m) => m.id));
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    conversation.forEach((msg, i) => {
      const rizNext = conversation[i + 1];

      // Show typing indicator before this message
      timers.push(
        setTimeout(() => setIsTyping(msg.from === 'riz'), msg.delayMs - (msg.from === 'riz' ? 700 : 0))
      );

      timers.push(
        setTimeout(() => {
          setIsTyping(false);
          setVisibleIds((prev) => [...prev, msg.id]);
        }, msg.delayMs)
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const handleAction = (msgId: number, action: string) => {
    setActionDone((prev) => ({ ...prev, [msgId]: true }));
    // Add user reply
    const idx = visibleIds.indexOf(msgId);
    // Inject the user reply bubble (msg id 3) after msg id 2 approval
    if (msgId === 2) {
      setTimeout(() => setVisibleIds((prev) => (prev.includes(3) ? prev : [...prev, 3])), 200);
      setTimeout(() => setVisibleIds((prev) => (prev.includes(4) ? prev : [...prev, 4])), 900);
    } else if (msgId === 5) {
      // just mark done
    }
  };

  return (
    <div className="relative mx-auto max-w-[420px] lg:max-w-none">
      <div className="pointer-events-none absolute -inset-12 rounded-[3rem] bg-[#3784ff]/10 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#17212b] shadow-[0_48px_120px_-32px_rgba(0,0,0,0.9)]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] bg-[#212d3b] px-4 py-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3784ff]">
            <img src="/logos/telegram.svg" alt="" className="h-5 w-5 brightness-0 invert" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-white">Riz</p>
            <p className="text-[11px] text-emerald-400">Your AI operator</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-medium text-slate-400">online</span>
          </div>
        </div>

        {/* Date stamp */}
        <div className="flex justify-center py-3">
          <span className="rounded-full bg-white/[0.05] px-3 py-1 text-[11px] text-slate-500">Today</span>
        </div>

        {/* Messages */}
        <div className="flex flex-col gap-3 px-3 pb-4">
          <AnimatePresence>
            {conversation
              .filter((msg) => {
                // msg 3 and 4 are handled by handleAction for msg 2
                if (msg.id === 3 || msg.id === 4) return visibleIds.includes(msg.id);
                return visibleIds.includes(msg.id);
              })
              .map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.from === 'riz' ? (
                    <RizBubble
                      msg={msg}
                      onAction={(action) => handleAction(msg.id, action)}
                      actionDone={actionDone[msg.id]}
                    />
                  ) : (
                    <UserBubble msg={msg} />
                  )}
                </motion.div>
              ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.25 }}
                className="flex self-start"
              >
                <div className="rounded-2xl rounded-tl-sm bg-[#182533]">
                  <TypingDots />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input bar */}
        <div className="border-t border-white/[0.07] px-3 pb-4 pt-3">
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#212d3b] px-4 py-2.5">
            <p className="flex-1 text-[13px] text-slate-500">Message Riz...</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3784ff]">
              <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_75%_40%,rgba(55,132,255,0.11),transparent)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid min-h-[100dvh] items-center gap-10 py-24 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
          {/* Left - copy */}
          <div className="flex flex-col items-start">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Approval-first AI for founders
            </div>

            <h1 className="font-neue-haas text-4xl font-normal leading-[0.96] tracking-tighter text-white sm:text-5xl lg:text-[3.5rem]">
              The AI that handles your ops. You just approve.
            </h1>

            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-slate-400">
              Connects to Gmail, Calendar, Stripe, and your business data. Monitors everything in the background, drafts what needs action, and asks you in Telegram before anything sends.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-full bg-[#3784ff] px-7 text-sm font-semibold text-white shadow-[0_18px_60px_-24px_rgba(55,132,255,0.85)] transition hover:bg-[#2c72e5] active:scale-[0.98]"
              >
                Start free trial
              </a>
              <a
                href="/pricing"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-7 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                See pricing
              </a>
            </div>

            <p className="mt-5 text-[13px] text-white/30">No credit card required to get started</p>

            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/[0.08] pt-8">
              <div>
                <p className="font-neue-haas text-2xl font-normal tracking-tight text-white">1 min</p>
                <p className="mt-1 text-[12px] text-slate-500">to connect Gmail</p>
              </div>
              <div>
                <p className="font-neue-haas text-2xl font-normal tracking-tight text-white">0 tabs</p>
                <p className="mt-1 text-[12px] text-slate-500">new to check</p>
              </div>
              <div>
                <p className="font-neue-haas text-2xl font-normal tracking-tight text-white">100%</p>
                <p className="mt-1 text-[12px] text-slate-500">approval-first</p>
              </div>
            </div>
          </div>

          {/* Right - Telegram chat */}
          <div className="w-full">
            <TelegramChat />
          </div>
        </div>
      </div>
    </section>
  );
}
