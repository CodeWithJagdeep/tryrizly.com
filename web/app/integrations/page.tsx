import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect Rizly to your existing stack — Gmail, Calendar, Stripe, Telegram, Slack, and more.",
  alternates: { canonical: `${SITE_URL}/integrations` },
  openGraph: {
    title: "Integrations",
    description: "Connect Rizly to your existing stack.",
    url: `${SITE_URL}/integrations`,
    type: "website",
  },
};

type Integration = {
  name: string;
  category: string;
  status: "Live" | "Beta";
  description: string;
  letter: string;
  color: string;
};

const integrations: Integration[] = [
  {
    name: "Gmail",
    category: "Email",
    status: "Live",
    description: "Every inbox signal is triaged automatically. Rizly drafts replies and flags what actually needs your attention.",
    letter: "G",
    color: "#EA4335",
  },
  {
    name: "Google Calendar",
    category: "Scheduling",
    status: "Live",
    description: "Conflicts and double-bookings are caught before they happen. Meetings get prepped context ahead of time.",
    letter: "C",
    color: "#4285F4",
  },
  {
    name: "Telegram",
    category: "Communication",
    status: "Live",
    description: "Your daily brief and every approval request lands in one chat. Approve or reject with a single reply.",
    letter: "T",
    color: "#26A5E4",
  },
  {
    name: "Stripe",
    category: "Revenue",
    status: "Live",
    description: "Failed payments, refunds, and revenue anomalies are surfaced the moment they happen, not at month end.",
    letter: "S",
    color: "#635BFF",
  },
  {
    name: "Slack",
    category: "Communication",
    status: "Live",
    description: "Keep your team aligned. High-priority approvals and outcomes get posted straight to the right channel.",
    letter: "S",
    color: "#4A154B",
  },
  {
    name: "PostgreSQL",
    category: "Data",
    status: "Beta",
    description: "Monitor business-critical tables directly. Get alerted when key metrics drift outside expected ranges.",
    letter: "P",
    color: "#336791",
  },
];

export default function IntegrationsPage() {
  return (
    <main className="w-full">
      {/* Hero */}
      <section className="pt-32 pb-24 px-10 text-center relative border-b-2 border-black/10 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        ></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-3 py-1 border-2 border-[#FE7F2D] text-[#FE7F2D] text-[12px] font-semibold uppercase tracking-[0.2em] mb-8">
            Frictionless workflow
          </span>
          <h1 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-10">
            Amplify your <br />
            <span className="text-[#FE7F2D]">existing stack</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-6 leading-relaxed">
            Don't change how you work. Just watch your current tools become exponentially more powerful overnight.
          </p>
        </div>
      </section>

      {/* Integration cards */}
      <section className="py-32 px-10 md:px-14 border-b-2 border-black/10 bg-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="flex flex-col md:flex-row items-start md:items-center gap-8 p-10 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(254,127,45,1)] hover:border-[#FE7F2D] transition-all group bg-[#fcfcfc]"
            >
              <div className="w-20 h-20 shrink-0 border-2 border-black bg-white flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:scale-105 transition-transform">
                <span className="font-semibold text-3xl" style={{ color: integration.color }}>
                  {integration.letter}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-semibold uppercase tracking-normal">{integration.name}</h3>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest border-2 border-black ${
                      integration.status === "Live" ? "bg-[#22c55e] text-white" : "bg-[#eab308] text-black"
                    }`}
                  >
                    {integration.status}
                  </span>
                </div>
                <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-4 block">
                  {integration.category}
                </span>
                <p className="text-gray-500 leading-relaxed">{integration.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why connect */}
      <section className="py-32 px-10 border-b-2 border-black/10 bg-[#FE7F2D]/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-4 block">The compounding effect</span>
            <h2 className="text-3xl md:text-5xl font-semibold uppercase tracking-normal">Why connect your tools?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="p-10 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-9xl font-semibold">→</div>
              <h4 className="text-xl font-semibold uppercase mb-4 relative z-10">Eliminate context switching</h4>
              <p className="text-gray-500 leading-relaxed relative z-10">
                Every time you switch from your inbox to your calendar to Telegram, momentum dies. By connecting your stack, Rizly handles the context synchronization automatically. You approve; we update everything else.
              </p>
            </div>
            <div className="p-10 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-9xl font-semibold">→</div>
              <h4 className="text-xl font-semibold uppercase mb-4 relative z-10">Shrink the decision loop</h4>
              <p className="text-gray-500 leading-relaxed relative z-10">
                Waiting hours to notice a failed payment or a scheduling conflict kills momentum. Connecting your stack means within seconds of something happening, a clear, actionable brief lands right where you're already looking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Access control */}
      <section className="py-32 px-10 border-b-2 border-black/10 bg-black text-white">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold uppercase tracking-normal mb-8">Granular access control</h2>
          <p className="text-lg text-gray-400 leading-relaxed max-w-3xl mx-auto mb-12">
            You dictate exactly what Rizly can see and touch. Every integration uses precise, scoped OAuth permissions, ensuring your data remains safe and your secrets remain yours.
          </p>
          <div className="inline-flex items-center gap-6 justify-center flex-wrap">
            <div className="w-16 h-16 border-2 border-[#FE7F2D] flex items-center justify-center text-[#FE7F2D] bg-[#FE7F2D]/10 shadow-[4px_4px_0px_0px_rgba(254,127,45,1)]">
              <span className="font-semibold text-xs">OAuth</span>
            </div>
            <div className="w-16 h-16 border-2 border-[#FE7F2D] flex items-center justify-center text-[#FE7F2D] bg-[#FE7F2D]/10 shadow-[4px_4px_0px_0px_rgba(254,127,45,1)]">
              <span className="font-semibold text-xs">SAML</span>
            </div>
            <div className="w-16 h-16 border-2 border-[#FE7F2D] flex items-center justify-center text-[#FE7F2D] bg-[#FE7F2D]/10 shadow-[4px_4px_0px_0px_rgba(254,127,45,1)]">
              <span className="font-semibold text-xs">2FA</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-10 text-center bg-[#fcfcfc]">
        <h2 className="text-3xl md:text-5xl font-semibold uppercase tracking-normal leading-tight mb-10">
          Need help or want to <span className="text-[#FE7F2D]">expand?</span>
        </h2>
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <a
            href="/security-guide"
            className="inline-flex items-center gap-3 border-2 border-black bg-white text-black px-12 py-6 text-[16px] font-semibold uppercase transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] active:translate-x-0 active:translate-y-0 active:shadow-none"
          >
            View documentation
          </a>
          <a
            href="/contact"
            className="inline-flex items-center gap-3 border-2 border-black bg-[#FE7F2D] text-white px-12 py-6 text-[16px] font-semibold uppercase transition-all shadow-[8px_8px_0px_0px_rgba(254,127,45,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(254,127,45,1)] active:translate-x-0 active:translate-y-0 active:shadow-none"
          >
            Request integration
            <span className="text-2xl">→</span>
          </a>
        </div>
      </section>
    </main>
  );
}
