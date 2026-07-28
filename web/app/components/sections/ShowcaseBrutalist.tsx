'use client';

import Link from 'next/link';

function MailIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-5" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 6l8 5 8-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-5" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L3 5.5v4.5c0 4.14 2.98 8.02 7 9 4.02-.98 7-4.86 7-9V5.5L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 10l2 2 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 8h9m0 0L9 4.5M12.5 8L9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeatureItem({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <li className="flex items-start gap-3 text-[15px] leading-relaxed text-gray-600">
      <span
        className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center border-2 border-black"
        style={{ background: `${accent}1a` }}
      >
        <svg viewBox="0 0 12 12" fill="none" className="size-3" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.5 6l2.5 2.5 4.5-5" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

function TriageMockup() {
  const alerts = [
    {
      tag: 'Gmail',
      tagColor: '#3784ff',
      sender: 'Markus, Gradient Ventures',
      body: 'Wants to lock Tuesday 10 AM for the Series A call. Confirmation draft and investor prep packet ready.',
      time: 'Just now',
      priority: true,
    },
    {
      tag: 'Stripe',
      tagColor: '#D9BEF4',
      sender: 'Acme Corp, Payment Failed',
      body: 'Enterprise plan payment past due. Drafted a renewal nudge to Priya with relationship context.',
      time: '14 min ago',
      priority: true,
    },
    {
      tag: 'Newsletter',
      tagColor: '#9ca3af',
      sender: 'Substack Weekly',
      body: 'Archived automatically, matches your rule: "Archive all Substacks".',
      time: '32 min ago',
      priority: false,
    },
  ];

  return (
    <div className="relative border-2 border-black bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-black bg-black/[0.02]">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center border-2 border-black bg-[#D9BEF4] text-white">
            <svg viewBox="0 0 16 16" fill="none" className="size-3.5" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 4.5l5.5 3.5 5.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </span>
          <span className="text-[13px] font-black uppercase tracking-tight text-black">Inbox Triage</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-bold uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </div>
      </div>

      <div className="divide-y-2 divide-black/10">
        {alerts.map((alert, i) => (
          <div
            key={i}
            className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-black/[0.02] ${!alert.priority ? 'opacity-50' : ''}`}
          >
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border-2 border-black text-[11px] font-bold text-white"
              style={{ backgroundColor: alert.tagColor }}
            >
              {alert.tag[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-bold text-black truncate">{alert.sender}</p>
                <span className="shrink-0 text-[11px] text-gray-400">{alert.time}</span>
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-gray-500">{alert.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t-2 border-black bg-black/[0.02]">
        <p className="text-[12px] text-gray-500">
          <span className="font-bold text-black">2 drafts</span> waiting for approval
        </p>
        <span className="inline-flex items-center gap-1 border-2 border-black bg-emerald-500 px-2.5 py-1 text-[11px] font-black uppercase text-white">
          <svg viewBox="0 0 12 12" fill="none" className="size-3" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          3 items parsed
        </span>
      </div>
    </div>
  );
}

function OperationsMockup() {
  return (
    <div className="relative border-2 border-black bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-black bg-black/[0.02]">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center border-2 border-black bg-[#a78bfa] text-white">
            <svg viewBox="0 0 16 16" fill="none" className="size-3.5" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1.5L2 4.5v4c0 3.5 2.5 6.7 6 7.5 3.5-.8 6-4 6-7.5v-4L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-[13px] font-black uppercase tracking-tight text-black">Proactive Action</span>
        </div>
        <span className="inline-flex items-center gap-1 border-2 border-black bg-[#a78bfa]/10 px-2.5 py-1 text-[11px] font-black uppercase text-[#7c5cd4]">
          Surfaced by Riz
        </span>
      </div>

      <div className="px-5 py-4 border-b-2 border-black/10">
        <p className="text-[13px] font-black text-black mb-1">Acme Corp: Renewal at Risk</p>
        <p className="text-[12px] text-gray-500 leading-relaxed">
          Riz detected a lapsed payment and no reply in 8 days. Here&apos;s the investigation and proposed action.
        </p>
      </div>

      <div className="px-5 py-4 space-y-2 font-mono text-[12.5px]">
        <div className="flex items-start gap-2.5 border-2 border-rose-200 bg-rose-50 px-3.5 py-2.5 text-rose-700">
          <span className="font-bold text-rose-500 select-none mt-px">−</span>
          <span>Last interaction: 8 days ago (no reply)</span>
        </div>
        <div className="flex items-start gap-2.5 border-2 border-rose-200 bg-rose-50 px-3.5 py-2.5 text-rose-700">
          <span className="font-bold text-rose-500 select-none mt-px">−</span>
          <span>Stripe: Past Due, Acme Enterprise Plan</span>
        </div>
        <div className="flex items-start gap-2.5 border-2 border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-emerald-800">
          <span className="font-bold text-emerald-600 select-none mt-px">+</span>
          <span className="font-medium">Send renewal nudge to Priya (Champion)</span>
        </div>
        <div className="flex items-start gap-2.5 border-2 border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-emerald-800">
          <span className="font-bold text-emerald-600 select-none mt-px">+</span>
          <span className="font-medium">Calendar: Hold Fri 2 PM for follow-up</span>
        </div>
      </div>

      <div className="flex gap-3 px-5 py-4 border-t-2 border-black bg-black/[0.02]">
        <button className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 border-2 border-black bg-[#D9BEF4] hover:bg-black text-[13px] font-black uppercase tracking-tight text-white transition-colors">
          Approve
        </button>
        <button className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 border-2 border-black bg-white hover:bg-black hover:text-white text-[13px] font-black uppercase tracking-tight text-black transition-colors">
          Edit draft
        </button>
      </div>
    </div>
  );
}

export function ShowcaseBrutalist() {
  return (
    <section className="relative bg-[#fcfcfc] font-neue-haas">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 md:py-28">
        <div className="mx-auto max-w-2xl text-center mb-20 lg:mb-24">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D9BEF4] mb-4">
            See it in action
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black uppercase text-black leading-[1.15] tracking-tight">
            One operator. Every signal.
            <br />
            <span className="text-gray-300">Nothing slips.</span>
          </h2>
          <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-xl mx-auto">
            Riz connects your inbox, calendar, payments, and databases, then surfaces what matters, drafts the response, and waits for you to approve.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center mb-24 lg:mb-28">
          <div className="lg:col-span-5 flex flex-col">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="flex h-9 w-9 items-center justify-center border-2 border-black bg-[#D9BEF4]/10 text-[#D9BEF4]">
                <MailIcon />
              </span>
              <span className="text-[12px] font-black uppercase tracking-[0.14em] text-[#D9BEF4]">
                Inbox Triage
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black uppercase leading-snug tracking-tight text-black mb-4">
              Your inbox is triaged before you open your laptop
            </h3>

            <p className="text-[15px] text-gray-500 leading-relaxed mb-8">
              Riz classifies every message by priority, drafts context-aware replies in your voice, and sends them to Telegram for approval. Newsletters get archived. Investor threads get drafted. You approve in 5 seconds.
            </p>

            <ul className="space-y-3.5 mb-8">
              <FeatureItem accent="#D9BEF4">Drafts land in Telegram, not another dashboard</FeatureItem>
              <FeatureItem accent="#D9BEF4">Noise auto-archived based on your learned rules</FeatureItem>
              <FeatureItem accent="#D9BEF4">Context-aware drafts in your voice and tone</FeatureItem>
              <FeatureItem accent="#D9BEF4">Remembers every preference and decision</FeatureItem>
            </ul>

            <Link
              href="/pricing"
              className="group inline-flex w-fit items-center gap-2 text-[14px] font-black uppercase tracking-tight text-[#D9BEF4] hover:text-black transition-colors"
            >
              See pricing
              <span className="transition-transform group-hover:translate-x-0.5">
                <ArrowRight />
              </span>
            </Link>
          </div>

          <div className="lg:col-span-7">
            <TriageMockup />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7 order-2 lg:order-1">
            <OperationsMockup />
          </div>

          <div className="lg:col-span-5 order-1 lg:order-2 flex flex-col">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="flex h-9 w-9 items-center justify-center border-2 border-black bg-[#a78bfa]/10 text-[#7c5cd4]">
                <ShieldIcon />
              </span>
              <span className="text-[12px] font-black uppercase tracking-[0.14em] text-[#7c5cd4]">
                Proactive Operations
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black uppercase leading-snug tracking-tight text-black mb-4">
              Spots revenue risks, drafts the fix, waits for you
            </h3>

            <p className="text-[15px] text-gray-500 leading-relaxed mb-8">
              Riz connects Stripe, Razorpay, databases, and calendars into one system. When a payment lapses or a client goes silent, it investigates across tools, drafts outreach, and presents you a ready-to-approve action.
            </p>

            <ul className="space-y-3.5 mb-8">
              <FeatureItem accent="#7c5cd4">Cross-tool workflows: Stripe, Email, Calendar</FeatureItem>
              <FeatureItem accent="#7c5cd4">Auto-preps client dossiers before calls</FeatureItem>
              <FeatureItem accent="#7c5cd4">Daily brief: revenue, renewals, hiring loops</FeatureItem>
              <FeatureItem accent="#7c5cd4">Budget ceiling stops runaway API costs</FeatureItem>
            </ul>

            <Link
              href="/pricing"
              className="group inline-flex w-fit items-center gap-2 text-[14px] font-black uppercase tracking-tight text-[#7c5cd4] hover:text-black transition-colors"
            >
              See pricing
              <span className="transition-transform group-hover:translate-x-0.5">
                <ArrowRight />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
