import { Reveal } from '../Reveal';

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
    title: 'Inbox handled before you look',
    detail: 'Triaged, drafted, and archived overnight. You open Telegram to decisions, not 40 unread emails.',
  },
  {
    Icon: CalendarShieldIcon,
    title: 'Calendar defends itself',
    detail: 'Conflicts get flagged and prep packets get built before the meeting you almost double-booked.',
  },
  {
    Icon: PulseIcon,
    title: 'Revenue risk surfaces early',
    detail: 'A lapsed payment or silent client turns into a drafted nudge, not a surprise next quarter.',
  },
  {
    Icon: HandCheckIcon,
    title: 'You approve everything',
    detail: 'Every draft, reply, and action waits in Telegram for a yes. Riz never sends on its own.',
  },
];

export function AtAGlance() {
  return (
    <section className="border-y-2 border-black bg-white font-neue-haas">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 divide-y-2 divide-black sm:grid-cols-2 sm:divide-y-0 sm:divide-x-2 lg:grid-cols-4">
          {points.map((point, index) => (
            <Reveal key={point.title} delay={index * 0.06} className="group">
              <div className="relative flex h-full flex-col gap-4 px-6 py-10 transition-colors hover:bg-[#D9BEF4]/[0.04]">
                <span className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-[#D9BEF4] transition-transform duration-300 group-hover:scale-x-100" aria-hidden="true" />
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center border-2 border-black bg-[#D9BEF4]/10 text-[#D9BEF4] transition-transform duration-300 group-hover:-translate-y-0.5">
                    <point.Icon />
                  </span>
                  <span className="font-mono text-xs font-bold tracking-widest text-black/15 transition-colors duration-300 group-hover:text-[#D9BEF4]/40">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <h3 className="text-[15px] font-black uppercase tracking-tight leading-snug text-black">{point.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-gray-500">{point.detail}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
