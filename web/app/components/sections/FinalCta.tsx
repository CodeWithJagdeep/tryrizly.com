import { Reveal } from '../Reveal';

const points = [
  'Gmail and Calendar connected in under a minute',
  'First brief delivered to Telegram the same day',
  'Nothing sends without your approval - ever',
];

export function FinalCta() {
  return (
    <section className="bg-[#0f172a] py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="font-neue-haas text-3xl font-normal tracking-tight text-white md:text-4xl lg:text-5xl">
            Stop checking tabs. Start reading one Telegram message a day.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-white/55">
            Connect your accounts, tell Riz what matters, and get your first brief this evening.
          </p>

          <ul className="mt-8 flex flex-col items-center gap-3">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-2.5 text-[14px] text-white/65">
                <svg
                  className="h-4 w-4 shrink-0 text-emerald-400"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8l3.5 3.5L13 4" />
                </svg>
                {point}
              </li>
            ))}
          </ul>

          <a
            href="/signup"
            className="mt-10 inline-flex h-12 items-center justify-center rounded-full bg-[#3784ff] px-8 text-base font-semibold text-white shadow-[0_18px_60px_-24px_rgba(55,132,255,0.6)] transition hover:bg-[#2c72e5] active:scale-[0.98]"
          >
            Start free trial
          </a>
          <p className="mt-4 text-[13px] text-white/30">No credit card required during trial</p>
        </Reveal>
      </div>
    </section>
  );
}
