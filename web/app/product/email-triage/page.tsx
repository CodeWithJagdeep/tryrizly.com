import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Email Triage",
  description: "Classify, summarize, draft, and route important messages automatically.",
  alternates: { canonical: `${SITE_URL}/product/email-triage` },
  openGraph: {
    title: "Email Triage",
    description: "Classify, summarize, draft, and route important messages automatically.",
    url: `${SITE_URL}/product/email-triage`,
    type: "website",
  },
};

const inbox = [
  { from: "Priya Shah — Lightspeed", subject: "Re: Intro call next week", tag: "Needs a decision", color: "#FE7F2D" },
  { from: "Calendly", subject: "New meeting request: Thu 2pm", tag: "Meeting request", color: "#3B82F6" },
  { from: "Stripe", subject: "Payment failed for invoice #4471", tag: "Payment", color: "#22c55e" },
  { from: "Product Hunt Weekly", subject: "This week's top launches", tag: "Noise", color: "#9CA3AF" },
  { from: "Markus — Gradient Ventures", subject: "Term sheet — let's close by Friday", tag: "Needs a decision", color: "#FE7F2D" },
  { from: "LinkedIn", subject: "5 people viewed your profile", tag: "Noise", color: "#9CA3AF" },
];

const capabilities = [
  { title: "Triaged by what it actually is", description: "Every new email is classified — noise, payment due, meeting request, or investor update — not just marked read or unread." },
  { title: "Drafts in your voice", description: "Riz drafts replies that sound like you, learned from how you actually write. Nothing sends until you approve it." },
  { title: "Tracks commitments", description: "Promises and follow-ups mentioned in threads are tracked automatically, so nothing quietly slips through the cracks." },
];

const questions = [
  { q: "Does it read everything in my inbox?", a: "Riz processes messages to classify and draft, but nothing is stored beyond what's needed for triage and your durable memory." },
  { q: "Can I correct a misclassified email?", a: "Yes. Every classification is visible and you can reclassify or give feedback in Telegram, which Riz factors into future triage." },
  { q: "Will it accidentally send something?", a: "No. Drafts wait for your explicit approval unless you turn on auto-act for a specific, narrow category yourself." },
];

const stats = [
  { value: "-73%", label: "Time in inbox" },
  { value: "< 1 min", label: "To connect Gmail" },
  { value: "100%", label: "Approval required" },
  { value: "24/7", label: "Watching your inbox" },
];

const audiences = [
  { title: "Solo founders", description: "No assistant, no ops hire. Riz becomes the first line of defense on your inbox." },
  { title: "Founding teams", description: "Shared inboxes and handoffs get messy fast. Riz keeps triage consistent no matter who's watching." },
  { title: "Busy operators", description: "Running day-to-day ops without a founder title. Riz turns your inbox into a decision queue, not a chore." },
];

export default function EmailTriagePage() {
  return (
    <main>
      <section className="pt-32 pb-16 px-10 text-center relative border-b-2 border-black/10 overflow-hidden bg-white">
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        ></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 border-2 border-black bg-black text-white text-[11px] font-semibold uppercase tracking-[0.3em] mb-8">
            Rizly / Email Triage
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-8">
            Your inbox, <br /><span className="text-[#FE7F2D]">already sorted</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Stop opening your inbox to guess what matters. Riz reads every message first and tells you only what needs a decision.
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

      {/* Live inbox visual */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-3xl mx-auto">
          <div className="border-2 border-black bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            <div className="border-b-2 border-black bg-black/[0.02] px-5 py-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold">Inbox — 6 new</span>
              <span className="text-[11px] font-semibold text-[#FE7F2D] uppercase tracking-widest">Triaged by Riz</span>
            </div>
            <div className="divide-y divide-black/10">
              {inbox.map((mail) => (
                <div key={mail.subject} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-black/[0.02] transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{mail.from}</p>
                    <p className="text-sm text-gray-500 truncate">{mail.subject}</p>
                  </div>
                  <span
                    className="shrink-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white"
                    style={{ backgroundColor: mail.color }}
                  >
                    {mail.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
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

      {/* Drafted reply mockup */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Then it drafts</span>
            <h2 className="text-2xl md:text-3xl font-semibold">A reply, ready to approve</h2>
          </div>
          <div className="overflow-hidden border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 border-b-2 border-black bg-black/[0.02] px-5 py-3">
              <span className="text-[13px] font-semibold text-black">Riz</span>
              <span className="text-[12px] font-medium text-gray-400">via Telegram</span>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm leading-relaxed text-gray-600">
                Priya from Lightspeed wants to schedule a call this week. I've drafted a reply offering
                Wednesday or Thursday afternoon and pulled the two open slots from your calendar.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="border-2 border-black bg-[#FE7F2D] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-black">
                  Approve reply
                </button>
                <button className="border-2 border-black bg-white px-4 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-black hover:text-white">
                  Edit before sending
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Who it's for</span>
            <h2 className="text-2xl md:text-4xl font-semibold">Built for inboxes that never stop</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {audiences.map((audience) => (
              <div key={audience.title} className="p-8 border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-lg font-semibold mb-3">{audience.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{audience.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Why founders trust it</span>
          <h2 className="text-2xl md:text-4xl font-semibold mb-8">Nothing sends without you</h2>
          <p className="text-lg text-white/50 leading-relaxed mb-10">
            Riz drafts every reply and waits. Your Gmail OAuth token is encrypted at rest and only used
            server-side to process the messages you've authorized.
          </p>
          <a href="/trust" className="text-[#FE7F2D] font-semibold hover:text-white transition-colors">
            See how trust works →
          </a>
        </div>
      </section>

      {/* Testimonial */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xl md:text-2xl font-medium leading-relaxed mb-6">
            "My inbox used to be the first thing I dreaded every morning. Now I get a Telegram message with the three things that actually need me."
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
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Connect Gmail in under a minute</h2>
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
