import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "For Busy Operators | Rizly",
  description: "Turn scattered tasks into one approval flow.",
  alternates: { canonical: `${SITE_URL}/solutions/busy-operators` },
  openGraph: {
    title: "For Busy Operators | Rizly",
    description: "Turn scattered tasks into one approval flow.",
    url: `${SITE_URL}/solutions/busy-operators`,
    type: "website",
  },
};

const queue = [
  { source: "Gmail", task: "Reply to vendor about contract renewal", priority: "High" },
  { source: "Calendar", task: "Confirm reschedule for Thursday's sync", priority: "Medium" },
  { source: "Stripe", task: "Follow up on failed payment retry", priority: "High" },
  { source: "Telegram", task: "Route customer escalation to support lead", priority: "Medium" },
];

const priorityColor: Record<string, string> = {
  High: "#EF4444",
  Medium: "#FE7F2D",
  Low: "#9CA3AF",
};

const stages = [
  { step: "01", title: "Connect your accounts", detail: "Gmail and Calendar link in under a minute. Connect Stripe, Razorpay, or a database when you want it watching revenue too." },
  { step: "02", title: "Riz reads, triages, and drafts", detail: "Every inbound message and meeting gets weighed against what you actually care about, quietly, in the background." },
  { step: "03", title: "You approve from Telegram", detail: "Drafts and decisions land as a Telegram message you can approve, edit, or reject. Nothing sends without you." },
];

const stats = [
  { value: "1 queue", label: "Instead of five apps" },
  { value: "100%", label: "Approval required" },
  { value: "24/7", label: "Tasks triaged" },
  { value: "1 tap", label: "To decide" },
];

const questions = [
  { q: "Does it replace my task manager?", a: "Not necessarily — Riz surfaces decisions that come from your inbox, calendar, and revenue tools. You can still use a separate task manager for planned work." },
  { q: "Can multiple people use the same queue?", a: "Each connected account has its own approval queue. Team-wide routing is on the roadmap." },
  { q: "What if I fall behind on approvals?", a: "Nothing expires. Pending items simply wait in the queue until you have time to work through them." },
];

const comparison = [
  { without: "Switch between five different apps to figure out what needs attention today.", with: "One queue, ranked by priority, pulled from every connected source." },
  { without: "Miss a task because it was buried in a tool you didn't check that day.", with: "Everything routes into the same place, whether it started in Gmail, Calendar, or Stripe." },
  { without: "Decide what's urgent by gut feeling, scrolling through unread counts.", with: "Riz ranks by priority automatically, based on deadlines and context." },
  { without: "Approve or reject from a dashboard you have to remember to open.", with: "Decide from Telegram, wherever you already are." },
];

const sources = [
  { name: "Gmail", detail: "Replies, follow-ups, and threads that need a decision." },
  { name: "Google Calendar", detail: "Conflicts, reschedules, and meeting confirmations." },
  { name: "Stripe / Razorpay", detail: "Failed payments and renewal follow-ups." },
  { name: "Telegram", detail: "Team routing and escalations that need your call." },
];

export default function BusyOperatorsPage() {
  return (
    <main>
      <section className="pt-32 pb-16 px-10 text-center relative border-b-2 border-black/10 overflow-hidden bg-white">
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        ></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 border-2 border-black bg-black text-white text-[11px] font-semibold uppercase tracking-[0.3em] mb-8">
            Rizly / For Busy Operators
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-8">
            Turn scattered tasks into <br /><span className="text-[#FE7F2D]">one approval flow</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            You don't need another tab. You need one place to say yes or no. Riz turns everything running across your tools into a single decision stream.
          </p>
        </div>
      </section>

      {/* Queue visual */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">One queue, every source</span>
            <h2 className="text-2xl md:text-3xl font-semibold">What's waiting for you right now</h2>
          </div>
          <div className="border-2 border-black bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] divide-y divide-black/10">
            {queue.map((item) => (
              <div key={item.task} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">{item.source}</span>
                  <p className="text-sm font-semibold truncate">{item.task}</p>
                </div>
                <span
                  className="shrink-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white"
                  style={{ backgroundColor: priorityColor[item.priority] }}
                >
                  {item.priority}
                </span>
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
              <span className="block text-3xl font-semibold text-[#FE7F2D] mb-2">{stat.value}</span>
              <span className="block text-[12px] font-semibold uppercase tracking-widest text-white/60">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Flow */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">The flow</span>
            <h2 className="text-2xl md:text-4xl font-semibold">From connected to handled</h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
            {stages.map((stage) => (
              <div key={stage.step} className="flex flex-col gap-5">
                <span className="text-4xl font-semibold leading-none tracking-tighter text-black/10 md:text-5xl">{stage.step}</span>
                <div>
                  <h3 className="text-lg font-semibold mb-2">{stage.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{stage.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sources feeding the queue */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Where tasks come from</span>
            <h2 className="text-2xl md:text-4xl font-semibold">Every source, one queue</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sources.map((source) => (
              <div key={source.name} className="p-6 border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-base font-semibold mb-3">{source.name}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{source.detail}</p>
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
            <h2 className="text-2xl md:text-4xl font-semibold">What changes with one queue</h2>
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

      {/* Trust */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Why it's safe to hand off</span>
          <h2 className="text-2xl md:text-4xl font-semibold mb-8">Every decision stays yours</h2>
          <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-2xl mx-auto">
            Riz surfaces and drafts. Nothing executes until you tap approve. Your queue is a proposal list, not an action log.
          </p>
          <a href="/trust" className="text-[#FE7F2D] font-semibold hover:text-black transition-colors">
            See how trust works →
          </a>
        </div>
      </section>

      {/* Testimonial */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xl md:text-2xl font-medium leading-relaxed mb-6">
            "I used to juggle five different tools to keep ops running. Now it's one queue, and I clear it during coffee."
          </p>
          <span className="text-[12px] font-semibold uppercase tracking-widest text-gray-400">— Early access operator</span>
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
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Turn the noise into one flow</h2>
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
