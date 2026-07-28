import { Reveal } from '../Reveal';

function SunriseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M4.93 10.93l1.41 1.41M2 18h2M20 18h2M17.66 12.34l1.41-1.41" />
      <path d="M6 18a6 6 0 0 1 12 0" />
      <path d="M2 22h20" />
    </svg>
  );
}

function CalendarClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M12 13v3l2 1.5" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}

const moments = [
  {
    time: '7:40 AM',
    title: 'Before you open your laptop',
    detail:
      'Riz already triaged overnight email. Three newsletters archived, one investor reply flagged, a Telegram message waiting with a suggested response.',
    Icon: SunriseIcon,
  },
  {
    time: '11:15 AM',
    title: 'A meeting request lands mid-focus',
    detail:
      'It checks your calendar, sees the conflict, and asks in Telegram whether to reschedule, so you can stay in flow instead of context-switching.',
    Icon: CalendarClockIcon,
  },
  {
    time: '9:05 PM',
    title: 'The day closes with one message, not twelve tabs',
    detail:
      "Revenue movement from Stripe, a renewal risk that needs a nudge, and tomorrow's first meeting prepped and ready, all in one brief.",
    Icon: MoonIcon,
  },
];

export function DayInLife() {
  return (
    <section className="bg-[#fcfcfc] py-20 md:py-28 font-neue-haas">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D9BEF4]">A day in the life</p>
          <h2 className="mt-4 max-w-lg text-3xl font-black uppercase tracking-tight text-black md:text-4xl">
            A day with Riz running in the background.
          </h2>
        </Reveal>

        {/* timeline rail (desktop) */}
        <div className="mt-12 hidden md:block" aria-hidden="true">
          <div className="relative grid grid-cols-3 gap-6">
            <span className="absolute left-0 right-0 top-[5px] border-t-2 border-dashed border-black/15" />
            {moments.map((moment) => (
              <div key={moment.time} className="relative flex items-center gap-3">
                <span className="relative z-10 h-3 w-3 border-2 border-black bg-[#D9BEF4]" />
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-gray-400">
                  {moment.time}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {moments.map((moment, index) => (
            <Reveal key={moment.time} delay={index * 0.07}>
              <div className="group relative flex h-full flex-col border-2 border-black bg-white p-7 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0px_0px_rgba(217,190,244,1)]">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-[#D9BEF4]/10 text-[#D9BEF4] transition-transform duration-300 group-hover:-translate-y-0.5">
                    <moment.Icon />
                  </span>
                  <span className="font-mono text-xs font-bold tracking-widest uppercase text-gray-400 md:hidden">
                    {moment.time}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-black uppercase leading-snug tracking-tight text-black">
                  {moment.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{moment.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
