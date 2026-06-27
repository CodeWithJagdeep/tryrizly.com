import { Reveal } from '../Reveal';

const stages = [
  {
    step: '01',
    title: 'Connect your accounts',
    detail:
      'Gmail and Calendar link in under a minute. Connect Stripe, Razorpay, or a database when you want it watching revenue too.',
  },
  {
    step: '02',
    title: 'Riz reads, triages, and drafts',
    detail:
      'Every inbound message and meeting gets weighed against what you actually care about - quietly, in the background.',
  },
  {
    step: '03',
    title: 'You approve from Telegram',
    detail:
      'Drafts and decisions land as a Telegram message you can approve, edit, or reject. Nothing sends without you.',
  },
];

export function HowItWorks() {
  return (
    <section className="bg-[#f8fafc] py-20 md:py-28" id="how-it-works">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="font-neue-haas max-w-lg text-3xl font-normal tracking-tight text-[#0f172a] md:text-4xl">
            From connected to handled, in three moves.
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
          {stages.map((stage, index) => (
            <Reveal key={stage.step} delay={index * 0.08}>
              <div className="relative flex flex-col gap-5">
                {/* Step number + connector line */}
                <div className="flex items-center gap-4">
                  <span className="font-neue-haas text-4xl font-normal leading-none tracking-tighter text-slate-200 md:text-5xl">
                    {stage.step}
                  </span>
                  {index < stages.length - 1 && (
                    <div className="hidden flex-1 border-t border-dashed border-slate-300 md:block" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{stage.detail}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Telegram message example */}
        <Reveal delay={0.28}>
          <div className="mt-14 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
              <img src="/logos/telegram.svg" alt="Telegram" className="h-4 w-4" />
              <span className="text-[13px] font-semibold text-slate-700">Riz</span>
              <span className="text-[12px] text-slate-400">via Telegram</span>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm leading-relaxed text-slate-700">
                Markus from Gradient Ventures replied to your Series A thread. He wants to lock Tuesday 10 AM.
                I&apos;ve drafted a reply confirming the slot and added a prep packet to the calendar hold with
                your ARR, churn rate, and the last investor thread.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="rounded-lg bg-[#3784ff] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#2c72e5]">
                  Approve reply
                </button>
                <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50">
                  Edit before sending
                </button>
                <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-50">
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
