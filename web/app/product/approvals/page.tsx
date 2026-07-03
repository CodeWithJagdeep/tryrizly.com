import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Approvals | Rizly",
  description: "Approve outbound actions before anything is sent.",
  alternates: { canonical: `${SITE_URL}/product/approvals` },
  openGraph: {
    title: "Approvals | Rizly",
    description: "Approve outbound actions before anything is sent.",
    url: `${SITE_URL}/product/approvals`,
    type: "website",
  },
};

const history = [
  { time: "9:41 AM", action: "Reply to Markus (Gradient Ventures)", status: "Approved" },
  { time: "9:38 AM", action: "Reschedule Thursday 2pm call", status: "Edited" },
  { time: "8:55 AM", action: "Follow-up to failed payment #4471", status: "Approved" },
  { time: "8:20 AM", action: "Archive 3 newsletter threads", status: "Auto (opted in)" },
  { time: "Yesterday", action: "Reply to Priya (Lightspeed)", status: "Rejected" },
];

const statusColor: Record<string, string> = {
  Approved: "#22c55e",
  Edited: "#3B82F6",
  Rejected: "#EF4444",
  "Auto (opted in)": "#9CA3AF",
};

const stages = [
  { step: "01", title: "Riz drafts the action", detail: "A reply, a reschedule, a follow-up — prepared with full context from every connected system." },
  { step: "02", title: "It waits for you", detail: "The draft lands in Telegram with the context that led to it, not just a bare notification." },
  { step: "03", title: "You decide", detail: "One tap sends it. Edit if it's not quite right. Reject and Riz learns for next time." },
];

const questions = [
  { q: "Can I let some actions run automatically?", a: "Yes. You can opt a specific, narrow category into auto-act once you trust it — nothing broad is ever turned on by default." },
  { q: "What happens if I don't respond?", a: "It simply waits. Riz doesn't assume silence means yes. Pending approvals stay queued until you act." },
  { q: "Is there a record of what I approved?", a: "Every approval, edit, and rejection is logged with a timestamp, giving you a full audit trail." },
];

const actionTypes = ["Email replies", "Calendar changes", "Revenue actions", "Team routing"];

const audiences = [
  { title: "Solo founders", description: "No one to double-check your sends. The approval step is your safety net." },
  { title: "Founding teams", description: "Multiple people touching the same inbox. A single, visible approval queue keeps everyone aligned." },
  { title: "Busy operators", description: "Too many decisions, too little time. One place to say yes or no, from your phone." },
];

export default function ApprovalsPage() {
  return (
    <main>
      <section className="pt-32 pb-16 px-10 text-center relative border-b-2 border-black/10 overflow-hidden bg-white">
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        ></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 border-2 border-black bg-black text-white text-[11px] font-semibold uppercase tracking-[0.3em] mb-8">
            Rizly / Approvals
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-8">
            Nothing sends <br /><span className="text-[#FE7F2D]">without you</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Every draft, reply, and scheduling change waits for your approval in Telegram. Approve, edit, or reject with a single reply.
          </p>
        </div>
      </section>

      {/* Approval history feed */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10 text-center">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Full audit trail</span>
            <h2 className="text-2xl md:text-3xl font-semibold">Every decision, logged</h2>
          </div>
          <div className="border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] divide-y divide-black/10">
            {history.map((item) => (
              <div key={item.action + item.time} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{item.action}</p>
                  <p className="text-[12px] text-gray-400">{item.time}</p>
                </div>
                <span
                  className="shrink-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white"
                  style={{ backgroundColor: statusColor[item.status] }}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What goes through approval */}
      <section className="px-10 md:px-14 py-16 border-b-2 border-black/10 bg-black text-white text-center">
        <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-6 block">Every category, always visible</span>
        <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
          {actionTypes.map((type) => (
            <span key={type} className="border-2 border-white/20 px-4 py-2 text-[13px] font-semibold">
              {type}
            </span>
          ))}
        </div>
      </section>

      {/* Approval mockup */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">One of those decisions</span>
            <h2 className="text-2xl md:text-3xl font-semibold">What it looks like to decide</h2>
          </div>
          <div className="overflow-hidden border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 border-b-2 border-black bg-black/[0.02] px-5 py-3">
              <span className="text-[13px] font-semibold text-black">Riz</span>
              <span className="text-[12px] font-medium text-gray-400">via Telegram</span>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm leading-relaxed text-gray-600">
                Markus from Gradient Ventures replied to your Series A thread. He wants to lock Tuesday 10 AM.
                I've drafted a reply confirming the slot and added a prep packet to the calendar hold.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="border-2 border-black bg-[#FE7F2D] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-black">
                  Approve reply
                </button>
                <button className="border-2 border-black bg-white px-4 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-black hover:text-white">
                  Edit before sending
                </button>
                <button className="border-2 border-black/20 bg-white px-4 py-2 text-[13px] font-semibold text-gray-400 transition-colors hover:border-black hover:text-black">
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">The flow</span>
            <h2 className="text-2xl md:text-4xl font-semibold">From drafted to decided</h2>
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

      {/* Who it's for */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Who it's for</span>
            <h2 className="text-2xl md:text-4xl font-semibold">Built for people who don't want surprises</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {audiences.map((audience) => (
              <div key={audience.title} className="p-8 border-2 border-black bg-[#fcfcfc] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-lg font-semibold mb-3">{audience.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{audience.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Why it's safe by design</span>
          <h2 className="text-2xl md:text-4xl font-semibold mb-8">Approval isn't a setting, it's the default</h2>
          <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-2xl mx-auto">
            Rizly was built approval-first from day one, not bolted on after the fact. Every integration
            respects the same rule: draft, wait, confirm.
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
            "I was nervous about connecting my inbox to an AI. The approval step is what made it actually feel safe to try."
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
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Try approval-first automation</h2>
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
