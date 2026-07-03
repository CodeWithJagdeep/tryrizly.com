import type { Metadata } from "next";
import { integrations } from "@/lib/brandfetch";
import FAQSection from "./FAQSection";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "About Us | rizly",
  description: "Learn about rizly and our mission to build proactive AI for founders.",
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: "About Us | rizly",
    description: "Learn about rizly and our mission.",
    url: `${SITE_URL}/about`,
    type: "website",
  },
};

function IntegrationCard({
  letter,
  color,
  label,
}: {
  letter: string;
  color: string;
  label: string;
}) {
  return (
    <div className="border border-gray-200 p-6 rounded text-center hover:border-[#FE7F2D] transition-colors">
      <div className="flex justify-center mb-3 h-8 items-center">
        <span className="font-semibold text-2xl" style={{ color }}>
          {letter}
        </span>
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-600">
        {label}
      </span>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main>
      {/* Hero Section */}
      <section className="pt-24 pb-24 px-10 text-center relative border-b-2 border-black/10 overflow-hidden bg-white">
        <div className="absolute inset-0 pointer-events-none -z-10 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        <div className="max-w-6xl mx-auto">
          <span className="inline-block px-4 py-1.5 border-2 border-black bg-black text-white text-[11px] font-black uppercase tracking-[0.3em] mb-4">rizly / About Us</span>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight mb-12">We're building <br /><span className="text-[#FE7F2D]">the AI operator</span></h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-16 font-medium tracking-normal leading-relaxed">For founders drowning in decisions. rizly monitors your inbox, calendar, and revenue — then waits for your approval. Automation that actually listens.</p>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white">
          <div className="p-16 lg:p-24 flex flex-col justify-between border-r border-gray-200 lg:border-r lg:border-b-0 border-b lg:border-b-0">
            <div>
              <span className="text-[#FE7F2D] text-[13px] font-black uppercase tracking-[0.4em] mb-8 block">Section 01 / Mission</span>
              <h2 className="text-4xl font-semibold tracking-tight mb-10 leading-tight">Approval <br /> first</h2>
              <p className="text-lg text-gray-500 font-medium tracking-normal leading-relaxed mb-8">Every action rizly takes requires your explicit approval. This is the core principle. We don't believe in AI that acts without asking. We believe in operators that suggest, wait for approval, and respect your final decision.</p>
            </div>
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-black opacity-10" height="80" width="80" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z"></path></svg>
          </div>
          <div className="p-16 lg:p-24 flex flex-col justify-between bg-[#FE7F2D]/5">
            <div>
              <span className="text-[#FE7F2D] text-[13px] font-black uppercase tracking-[0.4em] mb-8 block">Section 02 / Vision</span>
              <h2 className="text-4xl font-semibold tracking-tighter mb-10 leading-tight">Fewer <br /> decisions</h2>
              <p className="text-lg text-gray-500 font-medium tracking-tight leading-relaxed mb-8">We're building a future where founders don't drown in decisions. rizly handles the noise, triages the chaos, and surfaces only what matters — leaving your brain for strategy, creativity, and what's truly important.</p>
            </div>
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D] opacity-20" height="80" width="80" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22Z"></path></svg>
          </div>
        </div>
      </section>

      {/* Why We Built This */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-32 items-center">
          <div>
            <span className="text-[#FE7F2D] text-[13px] font-black uppercase tracking-[0.4em] mb-6 block">Our Motive</span>
            <h2 className="text-4xl font-semibold tracking-tight mb-12 leading-tight">Built for <br /> <span className="text-[#FE7F2D]">operators</span></h2>
            <p className="text-xl text-gray-500 font-medium tracking-normal leading-relaxed mb-12">Founders wear a hundred hats. Email, calendar, revenue, customer issues, hiring — it never stops. Most AI tools add one more thing to manage. rizly removes things from your plate.</p>
            <p className="text-lg text-gray-400 font-medium tracking-normal leading-relaxed mb-12">We watched founders lose 15+ hours every week to context-switching and information chaos. Not because the tasks are hard — they're not. Because there are too many of them.</p>
            <div className="flex gap-12">
              <div>
                <span className="block text-3xl font-semibold mb-1">100%</span>
                <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Approval Required</span>
              </div>
              <div>
                <span className="block text-3xl font-semibold mb-1">0</span>
                <span className="block text-[11px] font-black uppercase tracking-widest text-gray-400">Surprise Actions</span>
              </div>
            </div>
          </div>
          <div className="space-y-8">
            <div className="border border-gray-200 p-12 bg-[#fcfcfc] rounded-lg">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D] mb-8" height="60" width="60" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM9.71002 19.6674C8.74743 17.6259 8.15732 15.3742 8.02731 13H4.06189C4.458 16.1765 6.71639 18.7747 9.71002 19.6674ZM10.0307 13C10.1811 15.4388 10.8778 17.7297 12 19.752C13.1222 17.7297 13.8189 15.4388 13.9693 13H10.0307ZM19.9381 13H15.9727C15.8427 15.3742 15.2526 17.6259 14.29 19.6674C17.2836 18.7747 19.542 16.1765 19.9381 13ZM4.06189 11H8.02731C8.15732 8.62577 8.74743 6.37407 9.71002 4.33256C6.71639 5.22533 4.458 7.8235 4.06189 11ZM10.0307 11H13.9693C13.8189 8.56122 13.1222 6.27025 12 4.24799C10.8778 6.27025 10.1811 8.56122 10.0307 11ZM14.29 4.33256C15.2526 6.37407 15.8427 8.62577 15.9727 11H19.9381C19.542 7.8235 17.2836 5.22533 14.29 4.33256Z"></path></svg>
              <p className="text-lg font-semibold leading-relaxed mb-6">"Founders don't need another tool. They need one tool that handles everything."</p>
              <span className="text-[12px] font-semibold uppercase tracking-widest text-gray-400">— The rizly Team</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 border border-gray-200 bg-white rounded">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FE7F2D] mb-2">Email Triage</h4>
                <p className="text-[11px] font-bold text-gray-400">Learn what matters. Never miss important decisions.</p>
              </div>
              <div className="p-6 border border-gray-200 bg-white rounded">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FE7F2D] mb-2">Calendar Smart</h4>
                <p className="text-[11px] font-bold text-gray-400">Detect conflicts before they happen.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-black text-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="mb-32">
            <h2 className="text-4xl font-semibold tracking-tight mb-8 leading-tight">Our <br /> <span className="text-[#FE7F2D]">principles</span></h2>
            <p className="text-lg text-white/40 max-w-2xl font-medium tracking-normal">The values that guide how we build rizly.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="flex gap-10 items-start group">
              <div className="w-20 h-20 border-2 border-white/20 flex items-center justify-center shrink-0 group-hover:bg-[#FE7F2D] group-hover:border-[#FE7F2D] transition-all">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-white" height="40" width="40" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22Z"></path></svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4">Transparency</h3>
                <p className="text-lg text-white/50 font-medium tracking-tight leading-tight">Every action is visible. You always know what rizly is doing and why.</p>
              </div>
            </div>
            <div className="flex gap-10 items-start group">
              <div className="w-20 h-20 border-2 border-white/20 flex items-center justify-center shrink-0 group-hover:bg-[#FE7F2D] group-hover:border-[#FE7F2D] transition-all">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-white" height="40" width="40" xmlns="http://www.w3.org/2000/svg"><path d="M12 1L20.2169 2.82598C20.6745 2.92766 21 3.33347 21 3.80217V13.7889C21 15.795 19.9974 17.6684 18.3282 18.7812L12 23L5.6718 18.7812C4.00261 17.6684 3 15.795 3 13.7889V3.80217C3 3.33347 3.32553 2.92766 3.78307 2.82598L12 1Z"></path></svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4">Security first</h3>
                <p className="text-lg text-white/50 font-medium tracking-tight leading-tight">Your data is encrypted. Your tokens are secure. Privacy is foundational.</p>
              </div>
            </div>
            <div className="flex gap-10 items-start group">
              <div className="w-20 h-20 border-2 border-white/20 flex items-center justify-center shrink-0 group-hover:bg-[#FE7F2D] group-hover:border-[#FE7F2D] transition-all">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-white" height="40" width="40" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22Z"></path></svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4">Always human</h3>
                <p className="text-lg text-white/50 font-medium tracking-tight leading-tight">You decide. AI suggests. You approve. This is how it always works.</p>
              </div>
            </div>
            <div className="flex gap-10 items-start group">
              <div className="w-20 h-20 border-2 border-white/20 flex items-center justify-center shrink-0 group-hover:bg-[#FE7F2D] group-hover:border-[#FE7F2D] transition-all">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-white" height="40" width="40" xmlns="http://www.w3.org/2000/svg"><path d="M13 9H21L11 24V15H4L13 0V9Z"></path></svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4">Speed matters</h3>
                <p className="text-lg text-white/50 font-medium tracking-tight leading-tight">Slow AI is useless AI. We optimize for speed without sacrificing safety.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-end gap-12 mb-24">
            <div className="max-w-2xl">
              <span className="text-[#FE7F2D] text-[13px] font-black uppercase tracking-[0.4em] mb-6 block">Our Ecosystem</span>
              <h2 className="text-4xl font-semibold uppercase tracking-tight leading-tight mb-6">Works with <br /> your stack</h2>
            </div>
            <p className="text-lg text-gray-500 font-medium tracking-normal leading-relaxed max-w-md">Rizly integrates deeply with the tools you already use — from Gmail and Stripe to your databases and beyond.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.name}
                letter={integration.letter}
                color={integration.color}
                label={integration.label}
              />
            ))}
          </div>
        </div>
      </section>

      <FAQSection />

    </main>
  );
}
