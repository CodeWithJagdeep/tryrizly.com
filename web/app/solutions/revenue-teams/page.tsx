import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "For Revenue Teams",
  description: "Watch Stripe, Razorpay, Postgres, and MongoDB signals in one place.",
  alternates: { canonical: `${SITE_URL}/solutions/revenue-teams` },
  openGraph: {
    title: "For Revenue Teams",
    description: "Watch Stripe, Razorpay, Postgres, and MongoDB signals in one place.",
    url: `${SITE_URL}/solutions/revenue-teams`,
    type: "website",
  },
};

const sources = ["Stripe", "Razorpay", "PostgreSQL", "MongoDB"];

const alerts = [
  { label: "Payment failed", detail: "Invoice #4471 — $2,400 — retry scheduled in 3 days", severity: "#EF4444" },
  { label: "Churn risk", detail: "Acme Co. — usage down 60% over 2 weeks", severity: "#D9BEF4" },
  { label: "MRR milestone", detail: "Crossed $50k MRR this month", severity: "#22c55e" },
  { label: "Renewal due", detail: "3 accounts renewing in the next 7 days", severity: "#3B82F6" },
];

const capabilities = [
  { title: "Revenue signals, watched continuously", description: "Connect Stripe, Razorpay, PostgreSQL, or MongoDB and Riz watches for the movements that actually matter — churn risk, failed payments, and spikes." },
  { title: "Folded into your daily brief", description: "Revenue movement shows up alongside inbox and calendar in the same daily Telegram message, not a separate dashboard you have to remember to check." },
  { title: "A durable log you can query", description: "Ask Riz what happened to MRR last week, or which accounts are at renewal risk, and get an answer pulled from a persistent memory of your data." },
];

const stats = [
  { value: "24/7", label: "Signal monitoring" },
  { value: "4 sources", label: "Supported today" },
  { value: "1 brief", label: "Not five dashboards" },
  { value: "0", label: "Manual spreadsheet checks" },
];

const sourceDetails = [
  { name: "Stripe", detail: "Failed payments, refunds, disputes, and MRR movement, tracked as they happen." },
  { name: "Razorpay", detail: "Same coverage as Stripe, built for teams billing in India and APAC." },
  { name: "PostgreSQL", detail: "Query any table directly — subscription state, usage data, or a custom revenue view." },
  { name: "MongoDB", detail: "Watch collections for the fields that map to your own revenue and usage logic." },
];

const comparison = [
  { without: "Find out about a failed payment days later in a spreadsheet review.", with: "An alert lands in your Telegram brief within minutes of the failure." },
  { without: "Pull together churn risk manually from usage logs once a month.", with: "Usage drop-offs are flagged automatically as they happen, not on a review cycle." },
  { without: "Ask an analyst to run a query for a board update.", with: "Ask Riz directly in plain language and get the number back in seconds." },
  { without: "Check four different dashboards to get the full revenue picture.", with: "One daily brief covering every connected source." },
];

const questions = [
  { q: "Does Riz need write access to my database?", a: "No. Connections are read-only by default. Riz observes and alerts — it never modifies your revenue data." },
  { q: "Can it query historical data?", a: "Yes. Ask about trends over the last week, month, or quarter and Riz pulls from your connected source directly." },
  { q: "What if I only use one revenue tool?", a: "Connect just Stripe, just Postgres, or any single source. Multiple integrations are optional, not required." },
];

export default function RevenueTeamsPage() {
  return (
    <main>
      <section className="pt-32 pb-16 px-10 text-center relative border-b-2 border-black/10 overflow-hidden bg-white">
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        ></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 border-2 border-black bg-black text-white text-[11px] font-semibold uppercase tracking-[0.3em] mb-8">
            Rizly / For Revenue Teams
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-8">
            Watch your revenue signals, <br /><span className="text-[#D9BEF4]">without a new dashboard</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Connect the systems your revenue already runs on. Riz watches them and brings what matters straight to you.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {sources.map((source) => (
              <span key={source} className="border-2 border-black bg-white px-4 py-2 text-[13px] font-semibold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                {source}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Live alert feed */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-[#D9BEF4] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">What you'd see today</span>
            <h2 className="text-2xl md:text-3xl font-semibold">Signals, ranked by urgency</h2>
          </div>
          <div className="border-2 border-black bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] divide-y divide-black/10">
            {alerts.map((alert) => (
              <div key={alert.label} className="flex items-center gap-4 px-6 py-4">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: alert.severity }}></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{alert.label}</p>
                  <p className="text-sm text-gray-500 truncate">{alert.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-10 md:px-14 py-16 border-b-2 border-black/10 bg-black text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <span className="block text-3xl font-semibold text-[#D9BEF4] mb-2">{stat.value}</span>
              <span className="block text-[12px] font-semibold uppercase tracking-widest text-white/60">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {capabilities.map((item) => (
            <div key={item.title} className="p-8 border-2 border-black bg-[#fcfcfc] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Query mockup */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[#D9BEF4] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Ask it anything</span>
            <h2 className="text-2xl md:text-3xl font-semibold">Real answers, from your real data</h2>
          </div>
          <div className="overflow-hidden border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 border-b-2 border-black bg-black/[0.02] px-5 py-3">
              <span className="text-[13px] font-semibold text-black">Riz</span>
              <span className="text-[12px] font-medium text-gray-400">via Telegram</span>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="flex justify-end">
                <div className="bg-[#D9BEF4] text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-sm text-sm">
                  How's MRR trending this month?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-gray-100 text-black px-4 py-3 rounded-2xl rounded-tl-sm max-w-sm text-sm leading-relaxed">
                  Up 8% from last month, now at $52,300. Two accounts churned but three new upgrades more than offset it. Want the breakdown by plan?
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Per-source breakdown */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#D9BEF4] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Per-source coverage</span>
            <h2 className="text-2xl md:text-4xl font-semibold">What Riz watches, source by source</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sourceDetails.map((source) => (
              <div key={source.name} className="p-6 border-2 border-black bg-[#fcfcfc] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-base font-semibold mb-3">{source.name}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{source.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before / after */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#D9BEF4] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Before and after</span>
            <h2 className="text-2xl md:text-4xl font-semibold">What changes once Riz is watching</h2>
          </div>
          <div className="border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] divide-y-2 divide-black">
            {comparison.map((row) => (
              <div key={row.without} className="grid grid-cols-1 md:grid-cols-2 divide-y-2 md:divide-y-0 md:divide-x-2 divide-black">
                <div className="p-6">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 block">Without Riz</span>
                  <p className="text-sm text-gray-500 leading-relaxed">{row.without}</p>
                </div>
                <div className="p-6 bg-[#D9BEF4]/5">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[#D9BEF4] mb-2 block">With Riz</span>
                  <p className="text-sm text-gray-700 leading-relaxed">{row.with}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[#D9BEF4] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Read-only by default</span>
          <h2 className="text-2xl md:text-4xl font-semibold mb-8">Riz observes. It doesn't touch your data.</h2>
          <p className="text-lg text-white/50 leading-relaxed mb-10 max-w-2xl mx-auto">
            Database connections are scoped read-only unless you explicitly grant more. Credentials are
            encrypted at rest and only used server-side for the queries you've authorized.
          </p>
          <a href="/trust" className="text-[#D9BEF4] font-semibold hover:text-white transition-colors">
            See how trust works →
          </a>
        </div>
      </section>

      {/* Testimonial */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xl md:text-2xl font-medium leading-relaxed mb-6">
            "I stopped exporting CSVs to check churn every week. Riz just tells me when something's wrong."
          </p>
          <span className="text-[12px] font-semibold uppercase tracking-widest text-gray-400">— Early access founder</span>
        </div>
      </section>

      {/* Mini FAQ */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold mb-10 text-center">Common questions</h2>
          <div className="space-y-6">
            {questions.map((item) => (
              <div key={item.q} className="border-2 border-black p-6 bg-[#fcfcfc] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-base font-semibold mb-2">{item.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-10 md:px-14 py-24 bg-[#fcfcfc] text-center">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Connect your revenue stack</h2>
        <a
          href="/signup"
          className="inline-flex items-center gap-2 border-2 border-black bg-[#D9BEF4] px-8 py-4 text-white font-semibold shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
        >
          Start free trial
        </a>
      </section>
    </main>
  );
}
