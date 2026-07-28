"use client";

import { CalendarIcon, GmailIcon, GoogleMeetIcon } from "../ConnectorIcons";

const feed = [
  {
    kind: "Meeting",
    icon: <GoogleMeetIcon className="h-4 w-4" />,
    title: "Investor call · Series A follow-up",
    detail: "3 attendees · starts in 15 min",
    time: "10:45",
  },
  {
    kind: "Email",
    icon: <GmailIcon className="h-4 w-4" />,
    title: "Invoice #4521 is overdue",
    detail: "OpenAI · $2,480 · needs a reply",
    time: "9:12",
  },
  {
    kind: "Meeting",
    icon: <CalendarIcon className="h-4 w-4" />,
    title: "Team standup",
    detail: "Recurring · Engineering",
    time: "11:30",
  },
];

function FeedRow({ item }: { item: (typeof feed)[number] }) {
  return (
    <div className="dash-row flex min-w-[220px] flex-1 items-center gap-3.5 rounded-[1.1rem] border border-black/[0.06] bg-white p-3 shadow-[0_10px_28px_rgba(42,35,29,.06)]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#F1EFEA] text-[#171717]">{item.icon}</span>
      <div className="min-w-0 flex-1">
        <span className="block text-[8px] font-semibold uppercase tracking-[0.14em] text-[#8C5DB5]">{item.kind}</span>
        <span className="mt-0.5 block truncate text-[12px] font-semibold text-black">{item.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-black/45">{item.detail}</span>
      </div>
      <span className="shrink-0 font-mono text-[9px] text-black/35">{item.time}</span>
    </div>
  );
}

function DashboardDemo() {
  return (
    <div className="dash-shell relative w-full overflow-hidden rounded-[2rem] bg-[#F1EFEA] p-4 shadow-[0_40px_120px_rgba(0,0,0,.5)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-[#9CC59F] opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-[#9CC59F]" />
          </span>
          <span className="text-xs tracking-[-0.01em] text-black/60">Today</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#171717] px-3 py-1 text-[10px] font-semibold text-white">All</span>
          <span className="rounded-full bg-black/[0.05] px-3 py-1 text-[10px] font-semibold text-black/50">Meetings</span>
          <span className="rounded-full bg-black/[0.05] px-3 py-1 text-[10px] font-semibold text-black/50">Emails</span>
        </div>
      </div>

      <div className="mt-2 px-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/30">3 items · 1 dashboard</span>
      </div>

      <div className="mt-4 flex flex-row flex-wrap gap-2.5 rounded-[1.55rem] border border-black/[0.07] bg-white/40 p-3">
        {feed.map((item) => (
          <FeedRow key={item.title} item={item} />
        ))}
      </div>
    </div>
  );
}

export function DashboardSection() {
  return (
    <section className="relative overflow-hidden bg-[#090909] px-6 py-14 md:px-10 md:py-20 lg:px-14">
      <div className="pointer-events-none absolute -left-32 bottom-10 h-80 w-80 rounded-full bg-[#D9BEF4]/10 blur-[110px]" aria-hidden="true" />
      <div className="relative mx-auto grid w-full max-w-[88rem] items-center gap-10 md:grid-cols-2 md:gap-14">
        <div className="flex flex-col items-start text-left">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-[#D9BEF4]/25 bg-[#D9BEF4]/10 text-xs font-bold text-[#D9BEF4]">
              3
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">Everything, in one place.</span>
          </div>
          <h2 className="max-w-lg text-3xl font-medium leading-[1.08] tracking-[-0.04em] text-white [text-wrap:balance] md:text-5xl">
            Meetings and emails <span className="text-[#D9BEF4]">in a single dashboard.</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/55 md:text-lg">
            Stop checking five apps to know what's going on. Rizly pulls it all into one feed, so you can see&mdash;and act on&mdash;your whole day at a glance.
          </p>
        </div>
        <DashboardDemo />
      </div>
    </section>
  );
}
