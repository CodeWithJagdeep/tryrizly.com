import {
  CalendarIcon,
  GitHubIcon,
  GmailIcon,
  NotionIcon,
  SlackIcon,
  StripeIcon,
  TelegramIcon,
} from "../ConnectorIcons";

function RizlyMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" />
    </svg>
  );
}

const connectors = [
  { name: "Gmail", icon: <GmailIcon className="h-5 w-5" /> },
  { name: "Calendar", icon: <CalendarIcon className="h-5 w-5" /> },
  { name: "Slack", icon: <SlackIcon className="h-5 w-5" /> },
  { name: "Telegram", icon: <TelegramIcon className="h-5 w-5" /> },
  { name: "Notion", icon: <NotionIcon className="h-5 w-5" /> },
  { name: "GitHub", icon: <GitHubIcon className="h-5 w-5" /> },
  { name: "Stripe", icon: <StripeIcon className="h-5 w-5" /> },
];

const outcomes = [
  { label: "Reply drafted", meta: "Gmail · ready to approve", tone: "bg-[#E6EFE2]" },
  { label: "Meeting booked", meta: "Calendar · Tuesday, 10:30", tone: "bg-[#E3EAF2]" },
  { label: "Team notified", meta: "Slack · #customer-success", tone: "bg-[#EFE5F2]" },
];

const benefits = [
  {
    title: "One place to ask",
    copy: "Use one conversation to find an email, check your calendar, or follow up in Slack.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 5.5h16v11H9l-5 3v-14Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8 9h8M8 12.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Context crosses tools",
    copy: "Rizly connects the details between your inbox, meetings, projects, and customer activity.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="18" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="m8.4 10.8 7.2-3.6M8.4 13.2l7.2 3.6" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    title: "You approve the action",
    copy: "Rizly prepares the next step and keeps you in control before anything important happens.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 12a8 8 0 1 1-4.1-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
];

function Rail() {
  return (
    <div className="relative hidden h-full min-h-40 justify-center md:flex">
      <div className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-[#7357A2]/20" aria-hidden="true" />
      <div className="integrations-train absolute left-1/2 top-0 z-10 flex h-8 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-[#7357A2] shadow-[0_8px_20px_rgba(115,87,162,.28)]">
        <span className="h-3.5 w-1 rounded-full bg-white/80" />
      </div>
      <div className="relative mt-20 grid size-16 -translate-y-1/4 place-items-center rounded-full border border-[#7357A2]/20 bg-white/40">
        <span className="integrations-station grid size-4 place-items-center rounded-full border-2 border-[#7357A2]/80 bg-[#ECE9E2]">
          <span className="size-1 rounded-full bg-[#7357A2]" />
        </span>
      </div>
    </div>
  );
}

function IntegrationsMap() {
  return (
    <div className="relative h-full min-w-[760px] overflow-hidden rounded-[1.05rem] border border-black/10 bg-[#DCD8D0] p-6 md:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,.9),transparent_36%)]" />
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(36,33,30,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(36,33,30,.06)_1px,transparent_1px)] [background-size:32px_32px]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1172 608" preserveAspectRatio="none" aria-hidden="true">
        <path d="M310 304 C390 304 405 304 468 304" className="integrations-line integrations-line-live" />
        <path d="M704 304 C770 304 790 304 860 304" className="integrations-line integrations-line-live integrations-line-delay" />
      </svg>

      <div className="relative z-10 grid h-full grid-cols-[1fr_1.08fr_1fr] items-center gap-16">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#24211E]/45">01 · Plug in</span>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#547B5A]">
              <span className="size-1.5 rounded-full bg-[#6D9C75]" />
              Connected
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-black/10 bg-[#F0EDE7]/80 p-3 shadow-[0_18px_45px_rgba(73,62,50,.08)] backdrop-blur">
            {connectors.map((connector) => (
              <div key={connector.name} className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white/80 p-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#F4F1EB]">{connector.icon}</span>
                <span className="text-[11px] font-semibold">{connector.name}</span>
              </div>
            ))}
            <div className="flex items-center justify-center rounded-lg border border-dashed border-black/15 bg-white/30 p-2.5 text-[10px] font-semibold text-black/40">
              +9 more
            </div>
          </div>
        </div>

        <div>
          <div className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7357A2]">02 · Automate</div>
          <div className="integrations-automation relative overflow-hidden rounded-2xl border border-black/10 bg-[#F4F0F7] p-5 text-black shadow-[0_28px_70px_rgba(36,33,30,.14)]">
            <div className="absolute -right-8 -top-8 size-32 rounded-full bg-[#A988C7]/20 blur-2xl" />
            <div className="relative flex items-center gap-3 border-b border-black/10 pb-4">
              <span className="grid size-11 place-items-center rounded-xl bg-[#D8C5EB] text-[#24211E]">
                <RizlyMark className="size-6" />
              </span>
              <div>
                <div className="text-sm font-semibold">Rizly operator</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-black">
                  <span className="integrations-thinking size-1.5 rounded-full bg-[#9EC6A4]" />
                  Working across your tools
                </div>
              </div>
            </div>
            <div className="relative mt-4 space-y-2">
              {["Read the request", "Gather context", "Prepare actions"].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-lg border border-black/[0.06] bg-white/70 px-3 py-2.5">
                  <span className="grid size-5 place-items-center rounded-full border border-black/15 font-mono text-[9px] text-black">0{index + 1}</span>
                  <span className="text-xs font-medium text-black">{step}</span>
                  <span className="ml-auto text-[10px] font-semibold text-black">Done</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#24211E]/45">03 · Move faster</div>
          <div className="space-y-2.5">
            {outcomes.map((outcome, index) => (
              <div
                key={outcome.label}
                className={`integrations-result flex items-center gap-3 rounded-xl border border-black/10 ${outcome.tone} p-3.5 shadow-[0_12px_32px_rgba(73,62,50,.07)]`}
                style={{ animationDelay: `${index * 160}ms` }}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/70 text-[#55795B]">
                  <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
                    <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <div className="text-xs font-semibold">{outcome.label}</div>
                  <div className="mt-0.5 text-[10px] text-black/45">{outcome.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-black/10 bg-white/75 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-black/40 backdrop-blur">
        Connect once · automate repeatedly
      </div>
    </div>
  );
}

export function IntegrationsSection() {
  return (
    <section className="relative bg-[#090909] px-3 py-4 sm:px-4">
      <style>{`
        @keyframes integrations-dash { to { stroke-dashoffset: -34 } }
        @keyframes integrations-orbit { to { transform: rotate(360deg) } }
        @keyframes integrations-train { 0%, 12% { transform: translate(-50%, 0) } 88%, 100% { transform: translate(-50%, 300px) } }
        @keyframes integrations-station { 50% { transform: scale(1.12) } }
        @keyframes integrations-thinking { 50% { opacity: .3; transform: scale(.75) } }
        @keyframes integrations-result { from { opacity: .55; transform: translateX(-8px) } to { opacity: 1; transform: translateX(0) } }
        .integrations-line { fill: none; stroke: rgba(36,33,30,.17); stroke-width: 1.3; stroke-dasharray: 5 7 }
        .integrations-line-live { stroke: rgba(115,87,162,.72); stroke-width: 1.8; animation: integrations-dash 1.5s linear infinite }
        .integrations-line-delay { animation-delay: -.75s }
        .integrations-orbit { animation: integrations-orbit 16s linear infinite }
        .integrations-train { animation: integrations-train 8s ease-in-out infinite alternate }
        .integrations-station { animation: integrations-station 2.4s ease-in-out infinite }
        .integrations-thinking { animation: integrations-thinking 1.4s ease-in-out infinite }
        .integrations-result { animation: integrations-result .65s cubic-bezier(.22,1,.36,1) both }
        .home-dark > section:not(:first-child) .integrations-light :where(h2, h3, p, a, span) { color: #111111 !important }
        .home-dark > section:not(:first-child) .integrations-light .integrations-automation :where(p, span) { color: #111111 !important }
        @media (prefers-reduced-motion: reduce) {
          .integrations-line-live, .integrations-orbit, .integrations-train, .integrations-station, .integrations-thinking, .integrations-result { animation: none !important }
        }
      `}</style>

      <div className="integrations-light relative mx-auto max-w-[105rem] overflow-hidden rounded-2xl bg-[#ECE9E2] text-black">
        <div className="relative z-10 mx-auto max-w-[88rem] px-5 sm:px-8 md:px-4 lg:px-8">
          <div className="md:grid md:grid-cols-12 md:gap-x-8">
            <div className="md:col-start-1 md:row-span-2">
              <Rail />
            </div>

            <div className="py-16 md:col-start-2 md:col-span-7 md:px-6 md:py-20 lg:py-24">
              <div className="max-w-[36rem]">
                <div className="inline-flex items-center justify-center rounded-lg bg-[#7357A2]/10 px-3 py-1.5 text-sm font-semibold tracking-[-0.01em] text-[#7357A2]">
                  16+ integrations
                </div>
                <div className="mt-10 md:mt-12">
                  <h2 className="max-w-[34rem] text-[2.25rem] font-medium leading-[1.14] tracking-[-0.035em] text-[#24211E] md:text-[3rem]">
                    Every tool you run, finally working as one.
                  </h2>
                  <div className="mt-4 max-w-[34rem] text-lg font-medium leading-[1.65] tracking-[-0.01em] text-[#24211E]/60">
                    <p>
                      Gmail, Calendar, Slack, Telegram, Notion, GitHub, and Stripe give Rizly the context to find what matters and prepare the next move.
                    </p>
                    <p className="mt-2 text-[#24211E]">
                      <a href="/integrations" className="inline-flex items-center font-semibold transition-opacity duration-200 hover:opacity-60">
                        Explore integrations&nbsp;→
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-20 col-span-12 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="aspect-[1172/608] min-h-[29rem]">
                <IntegrationsMap />
              </div>
            </div>

            <div className="relative hidden h-full justify-center md:col-start-1 md:block">
              <div className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-[#7357A2]/20" aria-hidden="true" />
            </div>

            <div className="mb-20 px-1 md:col-start-2 md:col-span-11 md:mb-24 md:px-6">
              <div className="grid grid-cols-1 gap-y-2 md:grid-cols-3 md:gap-8">
                {benefits.map((benefit) => (
                  <article key={benefit.title} className="py-8 md:py-16">
                    <div className="size-6 text-[#24211E]">{benefit.icon}</div>
                    <div className="mt-4">
                      <h3 className="text-base font-semibold leading-6">{benefit.title}</h3>
                      <p className="mt-1 max-w-[20rem] text-base leading-6 text-[#24211E]/50">{benefit.copy}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mb-6 h-px w-full bg-[#24211E]/10" />
              <div className="flex flex-col items-start gap-3 opacity-45 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex items-center gap-3 text-base font-medium">
                  <svg viewBox="0 0 20 20" fill="none" className="size-5" aria-hidden="true">
                    <path d="M3 3h4M3 3v4m0-4 6 6m8-6h-4m4 0v4m0-4-5 5m-2 1v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Works across
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
                  <span>Communication</span>
                  <span>Calendar</span>
                  <span>Knowledge</span>
                  <span>Payments</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
