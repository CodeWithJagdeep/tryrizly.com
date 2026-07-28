function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16l-1.5 9H5.5L4 5z" />
      <path d="M4 5 2.5 3M20 5l1.5-2" />
      <path d="M5.5 14a3 3 0 0 0 3 3h7a3 3 0 0 0 3-3" />
    </svg>
  );
}

function CalendarShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M9.5 14.5 11 16l3.5-3.5" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2 7 4-14 2 7h6" />
    </svg>
  );
}

function HandCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 11V6a2 2 0 1 1 4 0v4" />
      <path d="M11 10V4a2 2 0 1 1 4 0v6" />
      <path d="M15 10.5V6a2 2 0 1 1 4 0v8c0 3.87-3.13 7-7 7h-1c-2.5 0-4-1-5.5-3L3 14.5c-.6-.8-.4-1.9.4-2.4.7-.5 1.6-.4 2.2.2L7 14" />
    </svg>
  );
}

const points = [
  {
    Icon: InboxIcon,
    title: "Inbox handled before you look",
    detail: "Triaged, drafted, and archived overnight. You open Telegram to decisions, not 40 unread emails.",
  },
  {
    Icon: CalendarShieldIcon,
    title: "Calendar defends itself",
    detail: "Conflicts get flagged and prep packets get built before the meeting you almost double-booked.",
  },
  {
    Icon: PulseIcon,
    title: "Revenue risk surfaces early",
    detail: "A lapsed payment or silent client turns into a drafted nudge, not a surprise next quarter.",
  },
  {
    Icon: HandCheckIcon,
    title: "You approve everything",
    detail: "Every draft, reply, and action waits in Telegram for a yes. Riz never sends on its own.",
  },
];

export function AtAGlanceSection() {
  return (
    <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-16 md:px-10 lg:px-14">
      <div className="mx-auto grid max-w-[88rem] grid-cols-1 gap-8 divide-y divide-black/[0.06] sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {points.map((point) => (
          <div key={point.title} className="flex flex-col gap-4 px-0 pt-8 first:pt-0 sm:px-8 sm:pt-0 sm:first:pl-0">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#233D4D] shadow-[0_10px_30px_-20px_rgba(32,21,28,0.4)]">
              <point.Icon />
            </span>
            <div>
              <h3 className="text-base font-normal text-[#233D4D]">{point.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">{point.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
