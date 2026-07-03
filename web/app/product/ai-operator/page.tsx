import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "AI Operator | Rizly",
  description: "Chat with Riz across your inbox, calendar, and business data.",
  alternates: { canonical: `${SITE_URL}/product/ai-operator` },
  openGraph: {
    title: "AI Operator | Rizly",
    description: "Chat with Riz across your inbox, calendar, and business data.",
    url: `${SITE_URL}/product/ai-operator`,
    type: "website",
  },
};

const systems = [
  { label: "Inbox", detail: "Every thread, triaged and drafted." },
  { label: "Calendar", detail: "Conflicts caught before you see them." },
  { label: "Revenue", detail: "Stripe, Razorpay, and your databases." },
];

const moments = [
  { time: "7:40 AM", title: "Before you open your laptop", detail: "Overnight email is already triaged. Newsletters archived, one investor reply flagged, a suggested response waiting in Telegram." },
  { time: "11:15 AM", title: "A meeting request lands mid-focus", detail: "Riz checks your calendar, sees the conflict, and asks in Telegram whether to reschedule — so you stay in flow." },
  { time: "9:05 PM", title: "The day closes with one message", detail: "Revenue movement, a renewal risk, and tomorrow's first meeting prepped, all in a single brief." },
];

const sources = ["Gmail", "Google Calendar", "Telegram", "Stripe", "Razorpay", "PostgreSQL", "MongoDB"];

const comparison = [
  { app: "Five different apps", detail: "A separate tab for inbox, calendar, revenue dashboard, and messaging. Context lives nowhere." },
  { app: "One operator", detail: "Riz holds the context across all of it and brings you only what needs a decision, in one thread." },
];

const questions = [
  { q: "Does Riz replace my other tools?", a: "No. It sits on top of Gmail, Calendar, and your revenue tools and reasons across them — you keep using what you already have." },
  { q: "How does it know what I care about?", a: "It learns from your approvals, edits, and rejections over time, building a durable memory of your preferences." },
  { q: "Can I use it without Telegram?", a: "Gmail and Calendar still get triaged in the background, but you'll miss real-time approve/reject prompts without Telegram connected." },
];

export default function AiOperatorPage() {
  return (
    <main>
      {/* Split hero: copy left, live conversation right */}
      <section className="border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 px-10 md:px-14 pt-32 pb-20 items-center">
          <div>
            <span className="inline-block px-4 py-1.5 border-2 border-black bg-black text-white text-[11px] font-semibold uppercase tracking-[0.3em] mb-8">
              Rizly / AI Operator
            </span>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-8">
              One operator across <span className="text-[#FE7F2D]">everything you run</span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Riz isn't a chatbot bolted onto a dashboard. It's a single operator that watches every
              connected system and talks to you where you already are — Telegram.
            </p>
            <div className="flex flex-wrap gap-3">
              {systems.map((system) => (
                <div key={system.label} className="border-2 border-black px-4 py-2 bg-[#fcfcfc]">
                  <span className="text-[13px] font-semibold block">{system.label}</span>
                  <span className="text-[11px] text-gray-500">{system.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden border-2 border-black bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 border-b-2 border-black bg-black/[0.02] px-5 py-3">
              <span className="text-[13px] font-semibold text-black">Riz</span>
              <span className="text-[12px] font-medium text-gray-400">via Telegram</span>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="flex justify-end">
                <div className="bg-[#FE7F2D] text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-xs text-sm">
                  Did Markus get back to us on the term sheet?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-gray-100 text-black px-4 py-3 rounded-2xl rounded-tl-sm max-w-xs text-sm leading-relaxed">
                  Yes — 20 minutes ago. He confirmed and wants to close by Friday. I've drafted a reply and pulled your ARR into a summary for the call. Send it?
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button className="border-2 border-black bg-[#FE7F2D] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-black">
                  Send reply
                </button>
                <button className="border-2 border-black bg-white px-4 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-black hover:text-white">
                  Let me edit
                </button>
              </div>
            </div>
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

      {/* Integrations */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white text-center">
        <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-6 block">Works with your stack</span>
        <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
          {sources.map((source) => (
            <span key={source} className="border-2 border-black bg-[#fcfcfc] px-4 py-2 text-[13px] font-semibold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              {source}
            </span>
          ))}
        </div>
      </section>

      {/* Why one operator */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Why one operator</span>
            <h2 className="text-2xl md:text-4xl font-semibold">Not another tab to check</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] divide-y-2 md:divide-y-0 md:divide-x-2 divide-black">
            {comparison.map((item, index) => (
              <div key={item.app} className={`p-8 ${index === 1 ? "bg-[#FE7F2D]/5" : "bg-white"}`}>
                <h3 className="text-lg font-semibold mb-3">{item.app}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xl md:text-2xl font-medium leading-relaxed mb-6">
            "I stopped checking four different tabs every morning. I ask Riz one question in Telegram and I have the full picture."
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

      {/* Dark CTA */}
      <section className="px-10 md:px-14 py-32 bg-black text-white text-center">
        <h2 className="text-2xl md:text-4xl font-semibold mb-8">Ready to connect your first account?</h2>
        <p className="text-white/40 max-w-md mx-auto mb-10">Under a minute to connect Gmail. See what Riz finds in your inbox today.</p>
        <a
          href="/signup"
          className="inline-flex items-center gap-2 border-2 border-[#FE7F2D] bg-[#FE7F2D] px-8 py-4 text-white font-semibold shadow-[6px_6px_0px_0px_rgba(255,255,255,0.15)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
        >
          Start free trial
        </a>
      </section>
    </main>
  );
}
