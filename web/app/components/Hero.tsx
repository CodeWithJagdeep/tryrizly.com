'use client';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#ffffff]">
      <div className="relative z-10 flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        {/* Hooked Text */}
        <div className="mb-12 max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Approval-first automation</p>
          <h2 className="mt-4 text-4xl font-normal text-black sm:text-5xl lg:text-6xl" style={{ fontFamily: 'Nunito Sans, sans-serif' }}>
            Never miss a moment.
            <br />
            Never lose control.
          </h2>
          <p className="mt-8 text-xl leading-relaxed text-slate-700">
            Riz watches your inbox, calendar, and revenue metrics 24/7. Surfaces critical decisions with drafted responses — all in Telegram, all with your approval. Automation that actually listens.
          </p>

          {/* OAuth Buttons */}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <button className="inline-flex h-12 items-center justify-center gap-3 rounded-lg bg-[#FE7F2D] px-6 text-sm font-medium text-white transition hover:opacity-90">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#ffffff"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#ffffff"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#ffffff"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ffffff"/>
              </svg>
              Sign up with Google
            </button>
            <button className="inline-flex h-12 items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-6 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Sign up with GitHub
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-500">No credit card required · 14-day free trial</p>
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

        {/* Value Proposition Section */}
        <div className="mt-32 flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-3xl text-center">
            <h2 className="text-4xl font-normal text-black sm:text-5xl lg:text-6xl" style={{ fontFamily: 'Nunito Sans, sans-serif' }}>
              Every team has AI.
              <br />
              Now they need a system.
            </h2>
            <p className="mt-8 text-xl leading-relaxed text-slate-700">
              Your teams are connecting AI tools to your business systems. Each one works great alone. The question is whether they work together — safely, visibly, without collisions.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
