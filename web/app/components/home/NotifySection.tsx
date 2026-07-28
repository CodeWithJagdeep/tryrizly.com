"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalendarIcon, GmailIcon, SlackIcon, TelegramIcon } from "../ConnectorIcons";

const signals = [
  {
    source: "Gmail",
    eyebrow: "Revenue risk",
    title: "Invoice #4521 is now overdue",
    detail: "OpenAI · $2,480 · due yesterday",
    decision: "High priority · owner should know now",
    destination: "Slack",
    message: "Invoice #4521 from OpenAI is overdue. Want me to draft a follow-up?",
    time: "Now",
    icon: <GmailIcon className="h-5 w-5" />,
    channelIcon: <SlackIcon className="h-4 w-4" />,
  },
  {
    source: "Calendar",
    eyebrow: "Meeting prep",
    title: "Investor call starts in 15 minutes",
    detail: "Series A follow-up · 3 attendees",
    decision: "Brief ready · send before the call",
    destination: "Telegram",
    message: "Your investor call starts in 15 min. I pulled the last notes and open questions.",
    time: "10:45",
    icon: <CalendarIcon className="h-5 w-5" />,
    channelIcon: <TelegramIcon className="h-4 w-4" />,
  },
  {
    source: "Rizly",
    eyebrow: "Promise remembered",
    title: "Follow up with legal on the NDA",
    detail: "You asked yesterday · due this morning",
    decision: "Due now · surface with context",
    destination: "Telegram",
    message: "Quick reminder: follow up with legal about the NDA. I have the thread ready.",
    time: "09:00",
    icon: <RizlyMark />,
    channelIcon: <TelegramIcon className="h-4 w-4" />,
  },
];

function RizlyMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" />
    </svg>
  );
}

function SignalIcon({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white text-[#171717] shadow-[0_8px_22px_rgba(0,0,0,.16)]">
      {children}
    </span>
  );
}

function NotifyDemo({ active }: { active: number }) {
  const signal = signals[active];
  const positions = [
    "md:left-[6%] md:top-[12%]",
    "md:left-[14%] md:bottom-[12%]",
    "md:right-[7%] md:top-[10%]",
  ];

  return (
    <div className="notify-shell relative mt-8 w-full overflow-hidden rounded-[2rem] bg-[#F1EFEA] p-4 text-[#171717] shadow-[0_40px_120px_rgba(0,0,0,.5)] sm:p-6">
      <div className="notify-paper pointer-events-none absolute inset-0 opacity-55" aria-hidden="true" />
      <div className="relative flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="notify-ping absolute inset-0 rounded-full bg-[#9CC59F]" />
            <span className="relative h-2 w-2 rounded-full bg-[#9CC59F]" />
          </span>
          <span className="text-xs tracking-[-0.01em] text-black/60">Rizly is watching your work</span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/30">12 sources · live</span>
      </div>

      <div className="relative mt-4 min-h-[610px] overflow-hidden rounded-[1.55rem] border border-black/[0.07] bg-white/40 md:min-h-[520px]">
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 1200 520" preserveAspectRatio="none" aria-hidden="true">
          <path d="M260 125 C410 125 420 255 565 255" className="notify-path" />
          <path d="M315 420 C430 420 440 285 565 275" className="notify-path" />
          <path d="M940 120 C790 120 785 235 635 255" className="notify-path" />
          <path d="M635 280 C785 300 820 410 945 410" className="notify-path notify-path-live" />
        </svg>

        <div className="relative flex flex-col gap-3 p-4 md:block md:h-[520px] md:p-0">
          {signals.map((item, index) => {
            const selected = index === active;
            return (
              <article
                key={item.title}
                className={`relative z-10 flex items-center gap-3 overflow-hidden rounded-[1.1rem] border bg-white p-3 shadow-[0_14px_40px_rgba(42,35,29,.08)] transition-[border-color,opacity,transform] duration-300 ease-out md:absolute md:w-[260px] ${positions[index]} ${
                  selected ? "border-[#8C5DB5]/30 opacity-100 md:scale-[1.04]" : "border-black/[0.06] opacity-45"
                }`}
              >
                {selected && <span className="notify-scan absolute inset-y-0 left-0 w-px bg-[#8C5DB5]" aria-hidden="true" />}
                <SignalIcon>{item.icon}</SignalIcon>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#8C5DB5]">{item.source}</span>
                    <span className="font-mono text-[8px] text-black">{item.time}</span>
                  </div>
                  <span className="mt-1 block truncate text-[11px] font-semibold text-black">{item.title}</span>
                </div>
              </article>
            );
          })}

          <div className="notify-core relative z-10 mx-auto my-5 flex h-40 w-40 flex-col items-center justify-center rounded-full bg-[#171717] text-center text-white shadow-[0_28px_70px_rgba(23,23,23,.28)] md:absolute md:left-1/2 md:top-1/2 md:my-0 md:-translate-x-1/2 md:-translate-y-1/2">
            <span className="notify-orbit absolute -inset-3 rounded-full border border-[#8C5DB5]/25" aria-hidden="true" />
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#D9BEF4] text-[#171717]"><RizlyMark /></span>
            <p className="mt-3 text-[9px] uppercase tracking-[0.16em] text-white/35">Rizly decided</p>
            <p key={`decision-${active}`} className="notify-trace mt-1 max-w-[125px] text-[10px] leading-4 text-white/80">{signal.decision}</p>
          </div>

          <div key={`message-${active}`} className="notify-message relative z-10 mt-auto rounded-[1.2rem] bg-[#D9BEF4] p-4 shadow-[0_22px_60px_rgba(140,93,181,.2)] md:absolute md:bottom-[8%] md:right-[5%] md:w-[300px]">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-white/60">{signal.channelIcon}</span>
              <div>
                <span className="block text-[11px] font-semibold text-black">{signal.destination}</span>
                <span className="block text-[9px] text-black">Rizly · delivered now</span>
              </div>
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#507B55]" />
            </div>
            <span className="mt-3 block text-[14px] leading-6 text-black">{signal.message}</span>
            <span className="mt-3 inline-flex rounded-lg bg-[#171717] px-3 py-1.5 text-[9px] font-semibold text-white">Handle it</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotifySection() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % signals.length), 3600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#090909] px-6 pb-24 pt-14 md:px-10 md:pb-32 md:pt-20 lg:px-14">
      <style>{`
        @keyframes notify-ping { from { transform: scale(1); opacity: .65 } to { transform: scale(2.8); opacity: 0 } }
        @keyframes notify-scan { 0% { transform: translateY(-100%); opacity: 0 } 35% { opacity: 1 } 100% { transform: translateY(100%); opacity: 0 } }
        @keyframes notify-trace { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes notify-message { from { transform: translateY(10px) scale(.985); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
        @keyframes notify-dash { to { stroke-dashoffset: -32 } }
        @keyframes notify-orbit { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .notify-ping { animation: notify-ping 1.8s cubic-bezier(.23,1,.32,1) infinite }
        .notify-scan { animation: notify-scan 1.4s cubic-bezier(.77,0,.175,1) infinite }
        .notify-trace { animation: notify-trace .35s cubic-bezier(.23,1,.32,1) both }
        .notify-message { animation: notify-message .4s cubic-bezier(.23,1,.32,1) both }
        .notify-path { fill: none; stroke: rgba(23,23,23,.13); stroke-width: 1.2; stroke-dasharray: 5 8 }
        .notify-path-live { stroke: rgba(140,93,181,.55); stroke-width: 1.6; animation: notify-dash 1.6s linear infinite }
        .notify-orbit { border-style: dashed; animation: notify-orbit 12s linear infinite }
        .notify-paper { background-image: radial-gradient(rgba(23,23,23,.08) .8px, transparent .8px); background-size: 18px 18px }
        @media (prefers-reduced-motion: reduce) {
          .notify-ping, .notify-scan, .notify-trace, .notify-message, .notify-path-live, .notify-orbit { animation: none !important }
        }
      `}</style>
      <div className="pointer-events-none absolute -right-32 top-24 h-80 w-80 rounded-full bg-[#D9BEF4]/10 blur-[110px]" aria-hidden="true" />
      <div className="relative mx-auto flex w-full max-w-[88rem] flex-col items-start text-left">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-7 w-7 place-items-center rounded-full border border-[#D9BEF4]/25 bg-[#D9BEF4]/10 text-xs font-bold text-[#D9BEF4]">2</span>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Rizly watches. You stay ahead.</span>
        </div>
        <div className="grid w-full items-end gap-6 lg:grid-cols-[1fr_auto]">
          <h2 className="max-w-4xl text-3xl font-medium leading-[1.08] tracking-[-0.04em] text-white [text-wrap:balance] md:text-5xl">
            It notices the moment. <span className="text-[#D9BEF4]">Then does the useful part.</span>
          </h2>
          <p className="max-w-md text-base leading-7 text-white/55 lg:pb-1">
            See what changed, why it matters, and where Rizly reached you—without opening another dashboard.
          </p>
        </div>
        <NotifyDemo active={active} />
      </div>
    </section>
  );
}
