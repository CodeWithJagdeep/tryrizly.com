import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "For Founders | Rizly",
  description: "Keep investor, customer, and ops work from slipping through the cracks.",
  alternates: { canonical: `${SITE_URL}/solutions/founders` },
  openGraph: {
    title: "For Founders | Rizly",
    description: "Keep investor, customer, and ops work from slipping through the cracks.",
    url: `${SITE_URL}/solutions/founders`,
    type: "website",
  },
};

const stats = [
  { value: "15+ hrs", label: "Reclaimed weekly" },
  { value: "100%", label: "Approval required" },
  { value: "< 1 min", label: "To connect Gmail" },
  { value: "0", label: "Dropped commitments" },
];

const painPoints = [
  { title: "Investor threads go cold", description: "A term sheet reply sits unanswered for two days because it got buried under forty other emails." },
  { title: "Calendar conflicts sneak in", description: "You accept a call, then realize it overlaps with a board prep block you'd already set aside." },
  { title: "Revenue signals arrive late", description: "A failed payment or a churn signal shows up in a spreadsheet review a week after it happened." },
];

const moments = [
  { time: "7:40 AM", title: "Before you open your laptop", detail: "Riz already triaged overnight email. Three newsletters archived, one investor reply flagged, a Telegram message waiting with a suggested response." },
  { time: "11:15 AM", title: "A meeting request lands mid-focus", detail: "It checks your calendar, sees the conflict, and asks in Telegram whether to reschedule, so you can stay in flow instead of context-switching." },
  { time: "9:05 PM", title: "The day closes with one message, not twelve tabs", detail: "Revenue movement from Stripe, a renewal risk that needs a nudge, and tomorrow's first meeting prepped and ready, all in one brief." },
];

const questions = [
  { q: "Will Riz reply to investors on its own?", a: "Never without your approval. It drafts a reply and waits for you to review, edit, or send it yourself." },
  { q: "Can it handle fundraising-specific context?", a: "Yes. Riz tracks your ARR, churn, and key metrics from connected sources so drafts and prep packets have real numbers, not placeholders." },
  { q: "What if I only want it watching my inbox?", a: "That's fine. Connect Gmail and Calendar alone — revenue monitoring and other integrations are entirely optional." },
];

const comparison = [
  { without: "Reread a whole investor thread to remember where things stand before replying.", with: "Riz surfaces a one-line summary and a drafted reply, ready in seconds." },
  { without: "Discover a double-booked board call the morning it happens.", with: "Conflicts are flagged the moment the invite lands, not after you've already accepted." },
  { without: "Chase your own memory for what you promised a customer three weeks ago.", with: "Every commitment is tracked automatically and resurfaced before it's overdue." },
  { without: "Piece together your runway from three different tabs before a board update.", with: "ARR, churn, and burn are already summarized and ready to drop into the deck." },
];

const stages = [
  { title: "Fundraising", detail: "Investor threads triaged by urgency, term sheet replies drafted with your real metrics attached." },
  { title: "Customer ops", detail: "Support escalations and renewal risk surfaced before they become churn." },
  { title: "Day-to-day", detail: "Calendar conflicts caught early, commitments tracked, inbox reduced to what needs you." },
];

export default function FoundersPage() {
  return (
    <main>
      <section className="pt-32 pb-16 px-10 text-center relative border-b-2 border-black/10 overflow-hidden bg-white">
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        ></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 border-2 border-black bg-black text-white text-[11px] font-semibold uppercase tracking-[0.3em] mb-8">
            Rizly / For Founders
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-8">
            Keep investor, customer, <br /><span className="text-[#FE7F2D]">and ops work from slipping</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Founders wear a hundred hats. Riz runs quietly in the background so nothing important gets lost between them.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="px-10 md:px-14 py-16 border-b-2 border-black/10 bg-black text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <span className="block text-3xl font-semibold text-[#FE7F2D] mb-2">{stat.value}</span>
              <span className="block text-[12px] font-semibold uppercase tracking-widest text-white/60">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Pain points */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">The problem</span>
            <h2 className="text-2xl md:text-4xl font-semibold">Where founders lose time and trust</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {painPoints.map((point) => (
              <div key={point.title} className="p-8 border-2 border-black bg-[#fcfcfc] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-lg font-semibold mb-3">{point.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Day in the life — timeline */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">A day with Riz</span>
            <h2 className="text-2xl md:text-4xl font-semibold">Running quietly in the background</h2>
          </div>
          <div className="relative border-l-2 border-black/10 ml-3">
            {moments.map((moment) => (
              <div key={moment.time} className="relative pl-10 pb-14 last:pb-0">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-[#FE7F2D] border-2 border-black"></div>
                <span className="font-mono text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2 block">{moment.time}</span>
                <h3 className="text-lg font-semibold mb-2">{moment.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xl">{moment.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before / after */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Before and after</span>
            <h2 className="text-2xl md:text-4xl font-semibold">What changes once Riz is running</h2>
          </div>
          <div className="border-2 border-black bg-[#fcfcfc] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] divide-y-2 divide-black">
            {comparison.map((row) => (
              <div key={row.without} className="grid grid-cols-1 md:grid-cols-2 divide-y-2 md:divide-y-0 md:divide-x-2 divide-black">
                <div className="p-6">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 block">Without Riz</span>
                  <p className="text-sm text-gray-500 leading-relaxed">{row.without}</p>
                </div>
                <div className="p-6 bg-[#FE7F2D]/5">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[#FE7F2D] mb-2 block">With Riz</span>
                  <p className="text-sm text-gray-700 leading-relaxed">{row.with}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Covers the whole founder journey */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Coverage</span>
            <h2 className="text-2xl md:text-4xl font-semibold">From fundraising to day-to-day ops</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stages.map((stage) => (
              <div key={stage.title} className="p-8 border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-lg font-semibold mb-3">{stage.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{stage.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Why founders trust it</span>
          <h2 className="text-2xl md:text-4xl font-semibold mb-8">Your inbox stays yours</h2>
          <p className="text-lg text-white/50 leading-relaxed mb-10 max-w-2xl mx-auto">
            OAuth tokens are encrypted at rest. Every draft waits for your review. Riz never sends
            anything to an investor, customer, or teammate without you saying go.
          </p>
          <a href="/trust" className="text-[#FE7F2D] font-semibold hover:text-white transition-colors">
            See how trust works →
          </a>
        </div>
      </section>

      {/* Testimonial */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xl md:text-2xl font-medium leading-relaxed mb-6">
            "I raised my seed round while running three other fires. Riz was the only reason I didn't drop a single investor thread."
          </p>
          <span className="text-[12px] font-semibold uppercase tracking-widest text-gray-400">— Early access founder</span>
        </div>
      </section>

      {/* Mini FAQ */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold mb-10 text-center">Common questions</h2>
          <div className="space-y-6">
            {questions.map((item) => (
              <div key={item.q} className="border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-base font-semibold mb-2">{item.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-10 md:px-14 py-24 bg-white text-center">
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Reclaim your day</h2>
        <a
          href="/signup"
          className="inline-flex items-center gap-2 border-2 border-black bg-[#FE7F2D] px-8 py-4 text-white font-semibold shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
        >
          Start free trial
        </a>
      </section>
    </main>
  );
}
