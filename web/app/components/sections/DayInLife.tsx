import { Reveal } from '../Reveal';

const moments = [
  {
    time: '7:40 AM',
    title: 'Before you open your laptop',
    detail:
      'Riz already triaged overnight email. Three newsletters archived, one investor reply flagged, a Telegram message waiting with a suggested response.',
    bg: 'bg-white',
    timeCls: 'text-[#3784ff]',
    border: 'border-slate-200',
    titleCls: 'text-slate-950',
    bodyCls: 'text-slate-500',
  },
  {
    time: '11:15 AM',
    title: 'A meeting request lands mid-focus',
    detail:
      'It checks your calendar, sees the conflict, and asks in Telegram whether to reschedule - so you can stay in flow instead of context-switching.',
    bg: 'bg-slate-50',
    timeCls: 'text-[#3784ff]',
    border: 'border-slate-200',
    titleCls: 'text-slate-950',
    bodyCls: 'text-slate-500',
  },
  {
    time: '9:05 PM',
    title: 'The day closes with one message, not twelve tabs',
    detail:
      'Revenue movement from Stripe, a renewal risk that needs a nudge, and tomorrow\'s first meeting prepped and ready - all in one brief.',
    bg: 'bg-[#0f172a]',
    timeCls: 'text-emerald-400',
    border: 'border-slate-800',
    titleCls: 'text-white',
    bodyCls: 'text-slate-400',
  },
];

export function DayInLife() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="font-neue-haas max-w-lg text-3xl font-normal tracking-tight text-[#0f172a] md:text-4xl">
            A day with Riz running in the background.
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200 md:grid-cols-3">
          {moments.map((moment, index) => (
            <Reveal
              key={moment.time}
              delay={index * 0.07}
              className={`${moment.bg} border-0 p-7`}
            >
              <span className={`font-mono text-xs font-semibold tracking-widest uppercase ${moment.timeCls}`}>
                {moment.time}
              </span>
              <h3 className={`mt-4 text-lg font-semibold leading-snug ${moment.titleCls}`}>
                {moment.title}
              </h3>
              <p className={`mt-3 text-sm leading-relaxed ${moment.bodyCls}`}>{moment.detail}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
