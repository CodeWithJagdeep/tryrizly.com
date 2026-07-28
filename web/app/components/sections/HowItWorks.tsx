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
      'Every inbound message and meeting gets weighed against what you actually care about, quietly, in the background.',
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
    <section className="border-t-2 border-black/10 bg-[#fcfcfc] py-20 md:py-28 font-neue-haas" id="how-it-works">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D9BEF4]">How it works</p>
          <h2 className="mt-4 max-w-lg text-3xl font-black uppercase tracking-tight text-black md:text-4xl">
            From connected to handled, in three moves.
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
          {stages.map((stage, index) => (
            <Reveal key={stage.step} delay={index * 0.08}>
              <div className="relative flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <span className="font-neue-haas text-4xl font-black leading-none tracking-tighter text-black/10 md:text-5xl">
                    {stage.step}
                  </span>
                  {index < stages.length - 1 && (
                    <div className="hidden flex-1 border-t-2 border-dashed border-black/15 md:block" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-black">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{stage.detail}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.28}>
          <div className="mt-14 overflow-hidden border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 border-b-2 border-black bg-black/[0.02] px-5 py-3">
              <img src="/logos/telegram.svg" alt="Telegram" className="h-4 w-4" />
              <span className="text-[13px] font-bold text-black">Riz</span>
              <span className="text-[12px] font-medium text-gray-400">via Telegram</span>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm leading-relaxed text-gray-600">
                Markus from Gradient Ventures replied to your Series A thread. He wants to lock Tuesday 10 AM.
                I&apos;ve drafted a reply confirming the slot and added a prep packet to the calendar hold with
                your ARR, churn rate, and the last investor thread.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="border-2 border-black bg-[#D9BEF4] px-4 py-2 text-[13px] font-black uppercase tracking-tight text-white transition-colors hover:bg-black">
                  Approve reply
                </button>
                <button className="border-2 border-black bg-white px-4 py-2 text-[13px] font-black uppercase tracking-tight text-black transition-colors hover:bg-black hover:text-white">
                  Edit before sending
                </button>
                <button className="border-2 border-black/20 bg-white px-4 py-2 text-[13px] font-black uppercase tracking-tight text-gray-400 transition-colors hover:border-black hover:text-black">
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
