'use client';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#ffffff]">
      <div className="relative z-10 flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        {/* Hooked Text */}
        <div className="mb-12 max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Approval-first automation</p>
          <h1 className="mt-4 text-4xl font-normal text-black sm:text-5xl lg:text-6xl" style={{ fontFamily: 'Nunito Sans, sans-serif' }}>
            Never miss a moment.
            <br />
            Never lose control.
          </h1>
          <p className="mt-8 text-xl leading-relaxed text-slate-700">
            Riz watches your inbox, calendar, and revenue metrics 24/7. Surfaces critical decisions with drafted responses — all in Telegram, all with your approval. Automation that actually listens.
          </p>

          {/* OAuth Buttons */}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <a
              href="/api/auth/google?return_to=%2Fdashboard"
              className="inline-flex h-12 items-center justify-center gap-3 rounded-lg bg-[#FE7F2D] px-6 text-sm font-medium text-white transition hover:opacity-90"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#ffffff"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#ffffff"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#ffffff"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ffffff"/>
              </svg>
              Sign up with Google
            </a>
            <a
              href="/signup"
              className="inline-flex h-12 items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-6 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            >
              Sign up with email
            </a>
          </div>

          <p className="mt-4 text-xs text-slate-500">No credit card required · 15-day free trial</p>
        </div>

        {/* Metrics Section */}
        <div className="mt-20 flex justify-center w-full">
          <div className="w-[1408px] px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border-t-2 border-b-2 border-l-2 border-r-2 border-black bg-white overflow-hidden">
              {/* Metric 1 */}
              <div className="border-r-2 border-black px-6 py-10 text-center hover:bg-[#FE7F2D]/5 transition-colors group">
                <p className="text-xs font-bold tracking-widest text-[#FE7F2D] mb-3 group-hover:translate-x-1 transition-transform uppercase">
                  Time Saved
                </p>
                <p className="text-4xl font-bold text-black leading-tight">
                  10+ hrs
                </p>
                <p className="text-sm text-slate-500 mt-2 font-normal">per week</p>
              </div>

              {/* Metric 2 */}
              <div className="border-r-2 border-black px-6 py-10 text-center hover:bg-[#FE7F2D]/5 transition-colors group">
                <p className="text-xs font-bold tracking-widest text-[#FE7F2D] mb-3 group-hover:translate-x-1 transition-transform uppercase">
                  Accuracy Rate
                </p>
                <p className="text-4xl font-bold text-black leading-tight">
                  99.8%
                </p>
                <p className="text-sm text-slate-500 mt-2 font-normal">decisions correct</p>
              </div>

              {/* Metric 3 */}
              <div className="border-r-2 border-black px-6 py-10 text-center hover:bg-[#FE7F2D]/5 transition-colors group">
                <p className="text-xs font-bold tracking-widest text-[#FE7F2D] mb-3 group-hover:translate-x-1 transition-transform uppercase">
                  Response Time
                </p>
                <p className="text-4xl font-bold text-black leading-tight">
                  &lt; 2 sec
                </p>
                <p className="text-sm text-slate-500 mt-2 font-normal">instant alerts</p>
              </div>

              {/* Metric 4 */}
              <div className="px-6 py-10 text-center hover:bg-[#FE7F2D]/5 transition-colors group">
                <p className="text-xs font-bold tracking-widest text-[#FE7F2D] mb-3 group-hover:translate-x-1 transition-transform uppercase">
                  Setup Time
                </p>
                <p className="text-4xl font-bold text-black leading-tight">
                  &lt; 5 min
                </p>
                <p className="text-sm text-slate-500 mt-2 font-normal">get started now</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
