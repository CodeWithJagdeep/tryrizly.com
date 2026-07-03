import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Stay updated with the latest Rizly features and improvements.",
  alternates: { canonical: `${SITE_URL}/changelog` },
  openGraph: {
    title: "Changelog",
    description: "Latest Rizly updates and releases.",
    url: `${SITE_URL}/changelog`,
    type: "website",
  },
};

export default function ChangelogPage() {
  return (
    <main>
      {/* Hero Section */}
      <section className="pt-32 pb-24 px-10 text-center relative border-b-2 border-black/10">
        <div className="absolute inset-0 pointer-events-none -z-10 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-3 py-1 border-2 border-[#FE7F2D] text-[#FE7F2D] text-[12px] font-semibold uppercase tracking-[0.2em] mb-8">Shipping weekly</span>
          <h1 className="text-5xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-10">Constant <br /><span className="text-[#FE7F2D]">evolution</span></h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-12 font-normal leading-relaxed">We move as fast as the mission requires. Every week, we ship new capabilities and improvements to Rizly's AI operator engine.</p>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="px-10 md:px-14 py-32 border-b-2 border-black/10 bg-[#111] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-6 block">Engine metrics</span>
            <h2 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight">System performance <br /> <span className="text-[#FE7F2D]">evolution</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="border-l-2 border-[#FE7F2D] pl-8">
              <span className="block text-5xl font-semibold text-[#FE7F2D] mb-4">-73%</span>
              <span className="block text-[14px] font-semibold uppercase tracking-widest mb-2">Processing time</span>
              <p className="text-sm text-gray-400 leading-relaxed">Average time from inbox alert to brief summary</p>
            </div>
            <div className="border-l-2 border-[#FE7F2D] pl-8">
              <span className="block text-5xl font-semibold text-[#FE7F2D] mb-4">99.8%</span>
              <span className="block text-[14px] font-semibold uppercase tracking-widest mb-2">Approval accuracy</span>
              <p className="text-sm text-gray-400 leading-relaxed">Correctly predicted user approvals vs rejections</p>
            </div>
            <div className="border-l-2 border-[#FE7F2D] pl-8">
              <span className="block text-5xl font-semibold text-[#FE7F2D] mb-4">20+hrs</span>
              <span className="block text-[14px] font-semibold uppercase tracking-widest mb-2">Weekly saved</span>
              <p className="text-sm text-gray-400 leading-relaxed">Average time reclaimed per user per week</p>
            </div>
            <div className="border-l-2 border-[#FE7F2D] pl-8">
              <span className="block text-5xl font-semibold text-[#FE7F2D] mb-4">5.2x</span>
              <span className="block text-[14px] font-semibold uppercase tracking-widest mb-2">Decision ROI</span>
              <p className="text-sm text-gray-400 leading-relaxed">Value created vs time spent with Rizly</p>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="px-10 md:px-14 py-32 border-b-2 border-black/10 bg-white">
        <div className="max-w-4xl mx-auto space-y-32">
          {/* Entry 1 */}
          <div className="relative pl-12 border-l-4 border-black">
            <div className="absolute top-0 -left-[22px] w-10 h-10 border-4 border-black bg-[#FE7F2D] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center text-white font-semibold text-lg">
              ★
            </div>
            <div>
              <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.3em] mb-4 block">July 01, 2026</span>
              <div className="inline-block px-2 py-1 bg-black text-white text-[10px] font-semibold uppercase tracking-widest mb-4">Intelligence</div>
              <h3 className="text-3xl font-semibold uppercase tracking-normal mb-6">Smart decision learning</h3>
              <p className="text-lg text-gray-500 leading-relaxed mb-8">Rizly now learns from your approval patterns and automatically handles similar decisions in the future, adapting to your preferences over time.</p>
              <div className="p-4 bg-[#FE7F2D]/5 border-2 border-dashed border-[#FE7F2D]">
                <p className="text-[12px] font-semibold uppercase text-[#FE7F2D]">Impact: 50% reduction in manual approvals required.</p>
              </div>
            </div>
          </div>

          {/* Entry 2 */}
          <div className="relative pl-12 border-l-4 border-black">
            <div className="absolute top-0 -left-[22px] w-10 h-10 border-4 border-black bg-[#FE7F2D] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center text-white font-semibold text-lg">
              ⚙
            </div>
            <div>
              <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.3em] mb-4 block">June 24, 2026</span>
              <div className="inline-block px-2 py-1 bg-black text-white text-[10px] font-semibold uppercase tracking-widest mb-4">Integrations</div>
              <h3 className="text-3xl font-semibold uppercase tracking-normal mb-6">Custom webhook system</h3>
              <p className="text-lg text-gray-500 leading-relaxed mb-8">Send briefs and approvals to any custom system via webhooks. Build your own integrations without waiting for us to build them.</p>
              <div className="p-4 bg-[#FE7F2D]/5 border-2 border-dashed border-[#FE7F2D]">
                <p className="text-[12px] font-semibold uppercase text-[#FE7F2D]">Impact: Infinite integration possibilities.</p>
              </div>
            </div>
          </div>

          {/* Entry 3 */}
          <div className="relative pl-12 border-l-4 border-black">
            <div className="absolute top-0 -left-[22px] w-10 h-10 border-4 border-black bg-[#FE7F2D] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center text-white font-semibold text-lg">
              ⚡
            </div>
            <div>
              <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.3em] mb-4 block">June 17, 2026</span>
              <div className="inline-block px-2 py-1 bg-black text-white text-[10px] font-semibold uppercase tracking-widest mb-4">Performance</div>
              <h3 className="text-3xl font-semibold uppercase tracking-normal mb-6">Multi-timezone optimization</h3>
              <p className="text-lg text-gray-500 leading-relaxed mb-8">Rizly now optimizes briefing times across global teams, delivering summaries when team members are most active in their timezones.</p>
              <div className="p-4 bg-[#FE7F2D]/5 border-2 border-dashed border-[#FE7F2D]">
                <p className="text-[12px] font-semibold uppercase text-[#FE7F2D]">Impact: Better engagement for distributed teams.</p>
              </div>
            </div>
          </div>

          {/* Entry 4 */}
          <div className="relative pl-12 border-l-4 border-black">
            <div className="absolute top-0 -left-[22px] w-10 h-10 border-4 border-black bg-[#FE7F2D] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center text-white font-semibold text-lg">
              🎙
            </div>
            <div>
              <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.3em] mb-4 block">June 10, 2026</span>
              <div className="inline-block px-2 py-1 bg-black text-white text-[10px] font-semibold uppercase tracking-widest mb-4">Feature</div>
              <h3 className="text-3xl font-semibold uppercase tracking-normal mb-6">Voice approvals beta</h3>
              <p className="text-lg text-gray-500 leading-relaxed mb-8">Approve decisions via voice command through Telegram. "Approve" or "reject" and Rizly executes instantly while you're on the move.</p>
              <div className="p-4 bg-[#FE7F2D]/5 border-2 border-dashed border-[#FE7F2D]">
                <p className="text-[12px] font-semibold uppercase text-[#FE7F2D]">Impact: Stay in control without being at your desk.</p>
              </div>
            </div>
          </div>

          {/* Entry 5 */}
          <div className="relative pl-12 border-l-4 border-black">
            <div className="absolute top-0 -left-[22px] w-10 h-10 border-4 border-black bg-[#FE7F2D] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center text-white font-semibold text-lg">
              ●
            </div>
            <div>
              <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.3em] mb-4 block">May 28, 2026</span>
              <div className="inline-block px-2 py-1 bg-black text-white text-[10px] font-semibold uppercase tracking-widest mb-4">Major release</div>
              <h3 className="text-3xl font-semibold uppercase tracking-normal mb-6">Rizly Kernel v2.0</h3>
              <p className="text-lg text-gray-500 leading-relaxed mb-8">Complete rewrite of the core reasoning engine. 3x faster processing, better understanding of context, and improved decision accuracy across all integrations.</p>
              <div className="p-4 bg-[#FE7F2D]/5 border-2 border-dashed border-[#FE7F2D]">
                <p className="text-[12px] font-semibold uppercase text-[#FE7F2D]">Impact: Processing speed increased 3x, accuracy up 15%.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Archive Section */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-[#f4f4f5]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-6 block">The archive</span>
            <h2 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight">The path to <br /> <span className="text-[#FE7F2D]">Rizly v1.0</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1">
            <div className="p-12 border-2 border-black bg-white group hover:bg-black hover:text-white transition-all">
              <span className="text-sm font-semibold text-[#FE7F2D] mb-4 block">v0.1</span>
              <h4 className="text-xl font-semibold uppercase mb-4 tracking-normal">Genesis</h4>
              <p className="text-sm leading-relaxed opacity-60 mb-8">First approval-first automation for email triage.</p>
              <span className="text-[10px] font-semibold tracking-widest opacity-40">Jan 2025</span>
            </div>
            <div className="p-12 border-2 border-black bg-white group hover:bg-black hover:text-white transition-all">
              <span className="text-sm font-semibold text-[#FE7F2D] mb-4 block">v0.4</span>
              <h4 className="text-xl font-semibold uppercase mb-4 tracking-normal">Calendar ready</h4>
              <p className="text-sm leading-relaxed opacity-60 mb-8">Calendar conflict detection launch.</p>
              <span className="text-[10px] font-semibold tracking-widest opacity-40">May 2025</span>
            </div>
            <div className="p-12 border-2 border-black bg-white group hover:bg-black hover:text-white transition-all">
              <span className="text-sm font-semibold text-[#FE7F2D] mb-4 block">v0.7</span>
              <h4 className="text-xl font-semibold uppercase mb-4 tracking-normal">Revenue watch</h4>
              <p className="text-sm leading-relaxed opacity-60 mb-8">Stripe integration and revenue monitoring.</p>
              <span className="text-[10px] font-semibold tracking-widest opacity-40">Sep 2025</span>
            </div>
            <div className="p-12 border-2 border-black bg-white group hover:bg-black hover:text-white transition-all">
              <span className="text-sm font-semibold text-[#FE7F2D] mb-4 block">v1.0</span>
              <h4 className="text-xl font-semibold uppercase mb-4 tracking-normal">The operator</h4>
              <p className="text-sm leading-relaxed opacity-60 mb-8">Full AI operator with complete integrations.</p>
              <span className="text-[10px] font-semibold tracking-widest opacity-40">May 2026</span>
            </div>
          </div>
        </div>
      </section>

      {/* Future Section */}
      <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-[#fcfcfc]">
        <div className="max-w-4xl mx-auto">
          <div className="mb-20 text-center">
            <span className="text-[#FE7F2D] text-[13px] font-semibold uppercase tracking-[0.4em] mb-6 block">Looking ahead</span>
            <h2 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight">The future <br /> of Rizly</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-10 border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h4 className="text-xl font-semibold uppercase mb-4">Full autonomy</h4>
              <p className="text-sm text-gray-500 leading-relaxed">Execute pre-approved patterns without asking. Rizly will handle routine decisions while you focus on strategy.</p>
            </div>
            <div className="p-10 border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h4 className="text-xl font-semibold uppercase mb-4">Team protocols</h4>
              <p className="text-sm text-gray-500 leading-relaxed">Define approval workflows for your entire team. Rizly becomes the central decision-maker coordinating across operations.</p>
            </div>
            <div className="p-10 border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h4 className="text-xl font-semibold uppercase mb-4">Predictive analytics</h4>
              <p className="text-sm text-gray-500 leading-relaxed">Rizly will forecast issues before they happen and proactively alert you to opportunities you might miss.</p>
            </div>
            <div className="p-10 border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h4 className="text-xl font-semibold uppercase mb-4">Cross-platform sync</h4>
              <p className="text-sm text-gray-500 leading-relaxed">Seamless synchronization across all your communication tools, ensuring no signal is ever missed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-40 px-10 text-center bg-white">
        <h2 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-12">Stay in the <br /> <span className="text-[#FE7F2D]">loop</span></h2>
        <a
          href="/signup"
          className="inline-flex items-center gap-3 border-2 border-black bg-black px-16 py-8 text-[18px] font-semibold text-white transition-all shadow-[10px_10px_0px_0px_rgba(254,127,45,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[16px_16px_0px_0px_rgba(254,127,45,1)] active:translate-x-0 active:translate-y-0 active:shadow-none"
        >
          Subscribe to updates
          <span className="text-3xl">→</span>
        </a>
      </section>
    </main>
  );
}
