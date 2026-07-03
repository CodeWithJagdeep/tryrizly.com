import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Meet Riz",
  description: "Riz is the AI agent behind Rizly — it watches, reasons, drafts, and waits for your approval.",
  alternates: { canonical: `${SITE_URL}/agent` },
  openGraph: {
    title: "Meet Riz",
    description: "Riz is the AI agent behind Rizly — it watches, reasons, drafts, and waits for your approval.",
    url: `${SITE_URL}/agent`,
    type: "website",
  },
};

const domains = [
  {
    label: "Email",
    watches: "Every new message in your inbox, the moment it arrives.",
    notifies: "Priya from Lightspeed wants to schedule a call this week. I've drafted a reply offering Wednesday or Thursday afternoon.",
    actions: ["Approve reply", "Edit before sending"],
  },
  {
    label: "Calendar & meetings",
    watches: "New invites, reschedules, and conflicts across every connected calendar.",
    notifies: "Thursday's board prep block now overlaps with a new call request from Markus. Want me to suggest moving the call to Friday?",
    actions: ["Move the call", "Keep both, I'll manage"],
  },
  {
    label: "Revenue",
    watches: "Stripe, Razorpay, and your connected databases for payment and usage signals.",
    notifies: "Payment failed for invoice #4471 ($2,400). Retry is scheduled in 3 days — want me to send a heads-up to the customer now?",
    actions: ["Send heads-up", "Wait for retry"],
  },
];

const principles = [
  { number: "01", title: "Approval-first", description: "Riz suggests. You decide. This is not a setting you have to find — it's the default behavior of the entire agent." },
  { number: "02", title: "Transparent reasoning", description: "Every draft comes with the context that produced it, so you're never approving a black box." },
  { number: "03", title: "Narrow autonomy, opt-in", description: "You can grant Riz auto-act on specific, narrow categories once you trust it. Nothing broad is ever assumed." },
  { number: "04", title: "Durable memory", description: "Riz remembers commitments, decisions, and patterns across every connected system, not just the current conversation." },
];

const stats = [
  { value: "3 systems", label: "Watched at once" },
  { value: "100%", label: "Approval required" },
  { value: "24/7", label: "Always monitoring" },
  { value: "1 memory", label: "Across everything" },
];

const sources = ["Gmail", "Google Calendar", "Telegram", "Stripe", "Razorpay", "PostgreSQL", "MongoDB"];

const questions = [
  { q: "Is Riz autonomous?", a: "Riz reasons and drafts autonomously, but action is gated by your approval. It's an agent with a hard boundary you control." },
  { q: "What model powers Riz?", a: "Rizly routes tasks across multiple LLM providers depending on the job — fast classification, careful drafting, and long-context reasoning each use the right tool." },
  { q: "Can Riz make mistakes?", a: "Yes, and that's exactly why nothing executes without your approval. Every draft is reviewable before it becomes real." },
  { q: "How long does it take to see value?", a: "Most founders see their first useful triage or draft within minutes of connecting Gmail — no training period required." },
  { q: "Does Riz get smarter over time?", a: "Yes. Every approval, edit, and rejection feeds back into how Riz prioritizes and drafts for you going forward." },
];

const capabilities = [
  {
    icon: "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V6c0-1.1-.9-2-2-2z",
    title: "Natural language",
    description: "Ask questions in plain English across every connected system. No query language, no dashboards to learn.",
  },
  {
    icon: "M12 2L20.2169 2.82598L20.2169 12C20.2169 16.0504 16.7569 19.5104 12.7065 19.5104C8.75585 19.5104 5.36535 16.1199 5.36535 12.169L5.36535 2.82598L12 2ZM7.34255 11.0273L5.5 9.18477L4.08578 10.599L7.34255 13.8557L15.9143 5.28393L14.5001 3.86972L7.34255 11.0273Z",
    title: "Approval gate",
    description: "A hard boundary built into the architecture, not a checkbox. Every action passes through it, every time.",
  },
  {
    icon: "M12 11C14.7614 11 17 13.2386 17 16V22H15V16C15 14.4023 13.7511 13.0963 12.1763 13.0051L12 13C10.4023 13 9.09634 14.2489 9.00509 15.8237L9 16V22H7V16C7 13.2386 9.23858 11 12 11Z",
    title: "Multi-system reasoning",
    description: "Considers your inbox, calendar, and revenue data together, not as isolated silos, when deciding what matters.",
  },
  {
    icon: "M6 21.5C4.067 21.5 2.5 19.933 2.5 18C2.5 16.067 4.067 14.5 6 14.5C7.5852 14.5 8.92427 15.5539 9.35481 16.9992L15 16.9994V15L17 14.9994V9.24339L14.757 6.99938H9V9.00003H3V3.00003H9V4.99939H14.757L18 1.75739L22.2426 6.00003L19 9.24139V14.9994L21 15V21H15V18.9994L9.35499 19.0003C8.92464 20.4459 7.58543 21.5 6 21.5Z",
    title: "Deep integrations",
    description: "Gmail, Calendar, Stripe, Razorpay, PostgreSQL, MongoDB, and Telegram — connected natively, not through brittle Zapier chains.",
  },
  {
    icon: "M13 9H21L11 24V15H4L13 0V9ZM11 11V7.22063L7.53238 13H13V17.3944L17.263 11H11Z",
    title: "Fast triage",
    description: "New signals are classified and prioritized the moment they arrive, not on a batch schedule.",
  },
  {
    icon: "M4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12ZM12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM17.4571 9.45711L16.0429 8.04289L11 13.0858L8.20711 10.2929L6.79289 11.7071L11 15.9142L17.4571 9.45711Z",
    title: "Learns from feedback",
    description: "Every edit and rejection is a signal. Riz refines its drafts and priorities based on what you actually approve.",
  },
];

const onboarding = [
  { step: "01", title: "Sign up", detail: "Create your account in under a minute. No credit card required to start." },
  { step: "02", title: "Connect Gmail & Calendar", detail: "A standard OAuth flow. Riz starts reading and triaging immediately." },
  { step: "03", title: "Connect Telegram", detail: "Link your Telegram account so drafts and approvals land where you already check messages." },
  { step: "04", title: "Review your first brief", detail: "Within minutes, get your first triaged summary and see exactly how Riz reasons." },
  { step: "05", title: "Approve, edit, or reject", detail: "Every response you give teaches Riz more about what matters to you." },
];

export default function AgentPage() {
  return (
    <main>
      <section className="pt-32 pb-20 px-10 text-center relative border-b-2 border-black/10 overflow-hidden bg-white">
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        ></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 border-2 border-black bg-black text-white text-[11px] font-semibold uppercase tracking-[0.3em] mb-8">
            Rizly / The Agent
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-8">
            Meet <span className="text-[#FE7F2D]">Riz</span>. <br />
            Your inbox stops being your job.
          </h1>
          <p className="text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto mb-10">
            Riz watches your inbox, calendar, and revenue data around the clock, drafts what needs to happen next,
            and waits for you to say go. No dashboards. No context-switching. Just decisions.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-14">
            <a
              href="/signup"
              className="inline-flex items-center justify-center gap-2 border-2 border-black bg-[#FE7F2D] px-8 py-4 text-white font-semibold shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
            >
              Talk to Riz free
            </a>
            <a
              href="#domains"
              className="inline-flex items-center justify-center gap-2 border-2 border-black bg-white px-8 py-4 text-black font-semibold hover:bg-black hover:text-white transition-colors"
            >
              See it in action
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 border-t-2 border-black/10 pt-8 max-w-2xl mx-auto">
            <div>
              <span className="block text-2xl font-semibold text-[#FE7F2D]">24/7</span>
              <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Watching</span>
            </div>
            <div>
              <span className="block text-2xl font-semibold text-[#FE7F2D]">100%</span>
              <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Approval required</span>
            </div>
            <div>
              <span className="block text-2xl font-semibold text-[#FE7F2D]">3</span>
              <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Systems, one memory</span>
            </div>
            <div>
              <span className="block text-2xl font-semibold text-[#FE7F2D]">&lt; 1 min</span>
              <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">To connect Gmail</span>
            </div>
          </div>
        </div>
      </section>

      {/* What it does for your day */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">What it actually does</span>
            <h2 className="text-2xl md:text-4xl font-semibold">How Riz makes your day easier</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-lg font-semibold mb-3">Fewer decisions to make</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Instead of opening five apps to figure out what needs you, Riz reads everything first and hands you a short list of real decisions.
              </p>
            </div>
            <div className="p-8 border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-lg font-semibold mb-3">Nothing important gets missed</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Commitments, conflicts, and revenue signals are tracked automatically, so they surface before they become a problem, not after.
              </p>
            </div>
            <div className="p-8 border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-lg font-semibold mb-3">You stay in control</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Every draft waits for your approval. Riz does the reading and writing — you make the calls, from your phone, in seconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works across your day, per domain */}
      <section id="domains" className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-black text-white scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">How Riz operates</span>
            <h2 className="text-2xl md:text-4xl font-semibold">Watches, notifies, and waits for you</h2>
            <p className="text-white/40 max-w-2xl mx-auto mt-4">
              The same pattern runs across every system Riz is connected to — here's what it actually looks like for email, meetings, and revenue.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {domains.map((domain) => (
              <div key={domain.label} className="border-2 border-white/15 bg-white/[0.03]">
                <div className="border-b-2 border-white/15 px-6 py-4">
                  <h3 className="text-lg font-semibold">{domain.label}</h3>
                </div>
                <div className="px-6 py-6 space-y-5">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-[#FE7F2D] mb-2 block">Riz watches</span>
                    <p className="text-sm text-white/60 leading-relaxed">{domain.watches}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-[#FE7F2D] mb-2 block">It notifies you</span>
                    <div className="bg-white text-black rounded-xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
                      {domain.notifies}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-[#FE7F2D] mb-2 block">You review</span>
                    <div className="flex flex-wrap gap-2">
                      {domain.actions.map((action, index) => (
                        <button
                          key={action}
                          className={
                            index === 0
                              ? "border-2 border-[#FE7F2D] bg-[#FE7F2D] px-3 py-1.5 text-[12px] font-semibold text-white"
                              : "border-2 border-white/20 px-3 py-1.5 text-[12px] font-semibold text-white/70"
                          }
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-10 md:px-14 py-16 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <span className="block text-3xl font-semibold text-[#FE7F2D] mb-2">{stat.value}</span>
              <span className="block text-[12px] font-semibold uppercase tracking-widest text-gray-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Reasoning mockup */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">See it reason</span>
            <h2 className="text-2xl md:text-3xl font-semibold">A question, answered with context</h2>
          </div>
          <div className="overflow-hidden border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 border-b-2 border-black bg-black/[0.02] px-5 py-3">
              <span className="text-[13px] font-semibold text-black">Riz</span>
              <span className="text-[12px] font-medium text-gray-400">via Telegram</span>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="flex justify-end">
                <div className="bg-[#FE7F2D] text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-sm text-sm">
                  Anything I need to worry about this week?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-gray-100 text-black px-4 py-3 rounded-2xl rounded-tl-sm max-w-sm text-sm leading-relaxed">
                  Three things: a renewal at risk (churned once before, flagged for outreach), a calendar
                  conflict Thursday I haven't resolved, and Markus wants to close the term sheet by Friday.
                  Want me to draft replies for all three?
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button className="border-2 border-black bg-[#FE7F2D] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-black">
                  Draft all three
                </button>
                <button className="border-2 border-black bg-white px-4 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-black hover:text-white">
                  Just the renewal
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full capability grid */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Under the hood</span>
            <h2 className="text-2xl md:text-4xl font-semibold">Every capability, in detail</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {capabilities.map((item) => (
              <div key={item.title} className="p-8 border-2 border-black bg-[#fcfcfc] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <div className="w-12 h-12 border-2 border-black mb-6 flex items-center justify-center bg-white">
                  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D]" height="22" width="22" xmlns="http://www.w3.org/2000/svg">
                    <path d={item.icon}></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles — numbered list, not cards */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Design principles</span>
            <h2 className="text-2xl md:text-4xl font-semibold">What makes Riz different</h2>
          </div>
          <div className="space-y-10">
            {principles.map((principle) => (
              <div key={principle.number} className="flex gap-8 items-start border-b border-black/10 pb-10 last:border-b-0 last:pb-0">
                <span className="text-3xl font-semibold text-black/10 shrink-0 w-14">{principle.number}</span>
                <div>
                  <h3 className="text-lg font-semibold mb-2">{principle.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-xl">{principle.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-white text-center">
        <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-6 block">What Riz can see</span>
        <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
          {sources.map((source) => (
            <span key={source} className="border-2 border-black bg-[#fcfcfc] px-4 py-2 text-[13px] font-semibold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              {source}
            </span>
          ))}
        </div>
      </section>

      {/* Getting started */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Getting started</span>
            <h2 className="text-2xl md:text-4xl font-semibold">From sign-up to your first brief</h2>
          </div>
          <div className="space-y-6">
            {onboarding.map((item) => (
              <div key={item.step} className="flex gap-6 items-start border-2 border-black p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <span className="text-2xl font-semibold text-[#FE7F2D] shrink-0 w-10">{item.step}</span>
                <div>
                  <h3 className="text-base font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="px-10 md:px-14 py-24 border-b-2 border-black/10 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">Boundaries by design</span>
          <h2 className="text-2xl md:text-4xl font-semibold mb-8">An agent with a hard stop</h2>
          <p className="text-lg text-white/50 leading-relaxed mb-10">
            Riz can reason across every connected system, but it can only act with your explicit approval.
            That boundary isn't a setting you have to configure — it's how the agent was built.
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
            "It doesn't feel like using a tool. It feels like I finally have someone triaging for me before I even open my laptop."
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
        <h2 className="text-2xl md:text-3xl font-semibold mb-6">Talk to Riz for yourself</h2>
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
