export function Hero() {
  return (
    <section className="relative overflow-hidden border-b-2 border-black bg-white font-neue-haas">
      {/* dot grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 py-16 md:py-24 lg:grid-cols-12 lg:gap-8">
          {/* Copy */}
          <div className="lg:col-span-6">
            <span className="inline-block border-2 border-[#D9BEF4] px-3 py-1 text-[12px] font-black uppercase tracking-[0.2em] text-[#D9BEF4]">
              Approval-first automation
            </span>
            <h1 className="mt-7 text-balance text-5xl font-medium leading-[1.05] tracking-tight text-black sm:text-6xl lg:text-[64px]">
              Your day, handled.
              <br />
              Nothing sent without your <span className="text-[#D9BEF4]">yes</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              Riz watches your inbox, calendar, and revenue, then puts drafted decisions in
              Telegram. You approve in seconds, from your phone.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="/api/auth/google?return_to=%2Fdashboard"
                className="inline-flex h-13 items-center justify-center gap-3 border-2 border-black bg-black px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#D9BEF4] hover:border-[#D9BEF4]"
              >
                <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign up with Google
              </a>
              <a
                href="/signup"
                className="inline-flex h-13 items-center justify-center border-2 border-black bg-white px-7 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-black hover:text-white"
              >
                Sign up with email
              </a>
            </div>
          </div>

          {/* Telegram approval mock */}
          <div className="lg:col-span-6">
            <div className="mx-auto w-full max-w-md border-2 border-black bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
              {/* chat header */}
              <div className="flex items-center gap-3 border-b-2 border-black bg-black px-5 py-3.5">
                <span className="flex h-8 w-8 items-center justify-center bg-[#D9BEF4] text-[13px] font-black text-white">R</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight text-white">Riz</p>
                  <p className="flex items-center gap-1.5 text-[11px] text-white/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Telegram · online
                  </p>
                </div>
                <span className="ml-auto text-[11px] font-medium tabular-nums text-white/40">07:58</span>
              </div>

              {/* messages */}
              <div className="flex flex-col gap-3 bg-[#fcfcfc] p-5">
                <div className="max-w-[92%] border-2 border-black bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#D9BEF4]">Morning brief</p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-slate-700">
                    3 emails need you today. Invoice <span className="font-semibold text-black">#1042 ($2,350)</span> from
                    Meridian Design is 6 days overdue — I&apos;ve drafted a polite nudge. Your 10:00
                    standup moved to 9:30.
                  </p>
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    <span className="border-2 border-black bg-[#D9BEF4] px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white">
                      Approve draft
                    </span>
                    <span className="border-2 border-black bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-black">
                      Edit
                    </span>
                    <span className="border-2 border-black/20 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-black/40">
                      Skip
                    </span>
                  </div>
                </div>

                <div className="ml-auto max-w-[70%] border-2 border-black bg-black p-3.5">
                  <p className="text-[13.5px] font-medium leading-snug text-white">Approve — and remind me if they don&apos;t reply.</p>
                </div>

                <div className="max-w-[92%] border-2 border-black bg-white p-4">
                  <p className="text-[13.5px] leading-relaxed text-slate-700">
                    Sent to Meridian Design. I&apos;ll follow up <span className="font-semibold text-black">Monday 9:00</span> if
                    there&apos;s no reply.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
