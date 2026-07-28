import { Reveal } from '../Reveal';

export function FinalCta() {
  return (
    <section className="border-t-2 border-black bg-black font-neue-haas">
      <div className="relative mx-auto max-w-7xl overflow-hidden px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        {/* dot grid backdrop */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
          aria-hidden="true"
        />

        <Reveal>
          <div className="relative flex flex-col items-start gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D9BEF4]">
                Start today
              </p>
              <h2 className="mt-5 text-balance text-4xl font-medium leading-[1.08] tracking-tight text-white md:text-5xl">
                Give Riz your inbox for 10 days.
                <br />
                <span className="text-white/40">Take back your mornings.</span>
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/50">
                Full product, every connector, no credit card. If it doesn&apos;t save you time in the
                first week, walk away — you land on Free, not a lock-out.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <a
                href="/signup"
                className="inline-flex h-13 items-center justify-center border-2 border-[#D9BEF4] bg-[#D9BEF4] px-8 text-sm font-semibold text-white transition-colors hover:bg-white hover:border-white hover:text-black"
              >
                Start free trial
              </a>
              <a
                href="/pricing"
                className="inline-flex h-13 items-center justify-center border-2 border-white/25 bg-transparent px-8 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white hover:text-black"
              >
                See pricing
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
