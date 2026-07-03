import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Features",
  description: "Discover how Rizly automates your inbox, calendar, and revenue operations.",
  alternates: { canonical: `${SITE_URL}/features` },
  openGraph: {
    title: "Features",
    description: "Automate your operations with approval-first AI.",
    url: `${SITE_URL}/features`,
    type: "website",
  },
};

export default function FeaturesPage() {
  return (
    <main className="w-full">
      {/* Hero Section */}
      <section className="pt-32 pb-24 px-10 text-center relative border-b-2 border-black/10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none -z-10 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-3 py-1 border-2 border-[#FE7F2D] text-[#FE7F2D] text-[12px] font-black uppercase tracking-[0.2em] mb-8">Your AI Operator</span>
          <h1 className="text-4xl md:text-6xl font-semibold uppercase tracking-normal leading-tight mb-10">Reclaim your <br /><span className="text-[#FE7F2D]">most valuable time</span></h1>
          <p className="text-xl md:text-2xl text-gray-500 font-medium max-w-2xl mx-auto mb-14 leading-relaxed tracking-normal">Stop drowning in decisions. Let Rizly handle the noise while you focus on what matters. Every action waits for your approval.</p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-10 md:px-14 border-b-2 border-black/10 bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {/* Feature 1 */}
          <div className="p-10 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(254,127,45,1)] hover:border-[#FE7F2D] transition-all group bg-[#fcfcfc]">
            <div className="w-16 h-16 border-2 border-black mb-8 flex items-center justify-center bg-white group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D]" height="32" width="32" xmlns="http://www.w3.org/2000/svg"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V6c0-1.1-.9-2-2-2z"></path></svg>
            </div>
            <h3 className="text-lg font-semibold uppercase mb-4 tracking-normal">Smart Email Triage</h3>
            <p className="text-gray-500 font-medium leading-relaxed">Never miss an important message again. Rizly learns what matters, classifies emails, and drafts summaries so you only see what needs your attention.</p>
          </div>

          {/* Feature 2 */}
          <div className="p-10 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(254,127,45,1)] hover:border-[#FE7F2D] transition-all group bg-[#fcfcfc]">
            <div className="w-16 h-16 border-2 border-black mb-8 flex items-center justify-center bg-white group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#34A853]" height="32" width="32" xmlns="http://www.w3.org/2000/svg"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"></path></svg>
            </div>
            <h3 className="text-lg font-semibold uppercase mb-4 tracking-normal">Calendar Intelligence</h3>
            <p className="text-gray-500 font-medium leading-relaxed">Detect conflicts before they happen. Rizly monitors your calendar, flags double-bookings, and suggests optimal meeting times across timezones.</p>
          </div>

          {/* Feature 3 */}
          <div className="p-10 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(254,127,45,1)] hover:border-[#FE7F2D] transition-all group bg-[#fcfcfc]">
            <div className="w-16 h-16 border-2 border-black mb-8 flex items-center justify-center bg-white group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#3B82F6]" height="32" width="32" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L20.2169 2.82598L20.2169 12C20.2169 16.0504 16.7569 19.5104 12.7065 19.5104C8.75585 19.5104 5.36535 16.1199 5.36535 12.169L5.36535 2.82598L12 2ZM7.34255 11.0273L5.5 9.18477L4.08578 10.599L7.34255 13.8557L15.9143 5.28393L14.5001 3.86972L7.34255 11.0273Z"></path></svg>
            </div>
            <h3 className="text-lg font-semibold uppercase mb-4 tracking-normal">Approval-First Actions</h3>
            <p className="text-gray-500 font-medium leading-relaxed">Nothing leaves your inbox without your say. Every draft, every approval, every action waits for you. You stay in control.</p>
          </div>

          {/* Feature 4 */}
          <div className="p-10 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(254,127,45,1)] hover:border-[#FE7F2D] transition-all group bg-[#fcfcfc]">
            <div className="w-16 h-16 border-2 border-black mb-8 flex items-center justify-center bg-white group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#A78BFA]" height="32" width="32" xmlns="http://www.w3.org/2000/svg"><path d="M12 11C14.7614 11 17 13.2386 17 16V22H15V16C15 14.4023 13.7511 13.0963 12.1763 13.0051L12 13C10.4023 13 9.09634 14.2489 9.00509 15.8237L9 16V22H7V16C7 13.2386 9.23858 11 12 11ZM5.5 14C5.77885 14 6.05009 14.0326 6.3101 14.0942C6.14202 14.594 6.03873 15.122 6.00896 15.6693L6 16L6.0007 16.0856C5.88757 16.0456 5.76821 16.0187 5.64446 16.0069L5.5 16C4.7203 16 4.07955 16.5949 4.00687 17.3555L4 17.5V22H2V17.5C2 15.567 3.567 14 5.5 14ZM18.5 14C20.433 14 22 15.567 22 17.5V22H20V17.5C20 16.7203 19.4051 16.0796 18.6445 16.0069L18.5 16C18.3248 16 18.1566 16.03 18.0003 16.0852L18 16C18 15.3343 17.8916 14.694 17.6915 14.0956C17.9499 14.0326 18.2211 14 18.5 14ZM5.5 8C6.88071 8 8 9.11929 8 10.5C8 11.8807 6.88071 13 5.5 13C4.11929 13 3 11.8807 3 10.5C3 9.11929 4.11929 8 5.5 8ZM18.5 8C19.8807 8 21 9.11929 21 10.5C21 11.8807 19.8807 13 18.5 13C17.1193 13 16 11.8807 16 10.5C16 9.11929 17.1193 8 18.5 8ZM5.5 10C5.22386 10 5 10.2239 5 10.5C5 10.7761 5.22386 11 5.5 11C5.77614 11 6 10.7761 6 10.5C6 10.2239 5.77614 10 5.5 10ZM18.5 10C18.2239 10 18 10.2239 18 10.5C18 10.7761 18.2239 11 18.5 11C18.7761 11 19 10.7761 19 10.5C19 10.2239 18.7761 10 18.5 10ZM12 2C14.2091 2 16 3.79086 16 6C16 8.20914 14.2091 10 12 10C9.79086 10 8 8.20914 8 6C8 3.79086 9.79086 2 12 2ZM12 4C10.8954 4 10 4.89543 10 6C10 7.10457 10.8954 8 12 8C13.1046 8 14 7.10457 14 6C14 4.89543 13.1046 4 12 4Z"></path></svg>
            </div>
            <h3 className="text-lg font-semibold uppercase mb-4 tracking-normal">Team Coordination</h3>
            <p className="text-gray-500 font-medium leading-relaxed">Keep your team in sync across timezones. Rizly surfaces decisions that need attention and routes them to the right people automatically.</p>
          </div>

          {/* Feature 5 */}
          <div className="p-10 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(254,127,45,1)] hover:border-[#FE7F2D] transition-all group bg-[#fcfcfc]">
            <div className="w-16 h-16 border-2 border-black mb-8 flex items-center justify-center bg-white group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#EC4899]" height="32" width="32" xmlns="http://www.w3.org/2000/svg"><path d="M12 1L20.2169 2.82598C20.6745 2.92766 21 3.33347 21 3.80217V13.7889C21 15.795 19.9974 17.6684 18.3282 18.7812L12 23L5.6718 18.7812C4.00261 17.6684 3 15.795 3 13.7889V3.80217C3 3.33347 3.32553 2.92766 3.78307 2.82598L12 1ZM12 3.04879L5 4.60434V13.7889C5 15.1263 5.6684 16.3752 6.7812 17.1171L12 20.5963L17.2188 17.1171C18.3316 16.3752 19 15.1263 19 13.7889V4.60434L12 3.04879ZM16.4524 8.22183L17.8666 9.63604L11.5026 16L7.25999 11.7574L8.67421 10.3431L11.5019 13.1709L16.4524 8.22183Z"></path></svg>
            </div>
            <h3 className="text-lg font-semibold uppercase mb-4 tracking-normal">Revenue Monitoring</h3>
            <p className="text-gray-500 font-medium leading-relaxed">Watch your Stripe data in real-time. Get alerts on failed payments, churn signals, and revenue opportunities without manual checks.</p>
          </div>

          {/* Feature 6 */}
          <div className="p-10 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(254,127,45,1)] hover:border-[#FE7F2D] transition-all group bg-[#fcfcfc]">
            <div className="w-16 h-16 border-2 border-black mb-8 flex items-center justify-center bg-white group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#EAB308]" height="32" width="32" xmlns="http://www.w3.org/2000/svg"><path d="M6 21.5C4.067 21.5 2.5 19.933 2.5 18C2.5 16.067 4.067 14.5 6 14.5C7.5852 14.5 8.92427 15.5539 9.35481 16.9992L15 16.9994V15L17 14.9994V9.24339L14.757 6.99938H9V9.00003H3V3.00003H9V4.99939H14.757L18 1.75739L22.2426 6.00003L19 9.24139V14.9994L21 15V21H15V18.9994L9.35499 19.0003C8.92464 20.4459 7.58543 21.5 6 21.5ZM6 16.5C5.17157 16.5 4.5 17.1716 4.5 18C4.5 18.8285 5.17157 19.5 6 19.5C6.82843 19.5 7.5 18.8285 7.5 18C7.5 17.1716 6.82843 16.5 6 16.5ZM19 17H17V19H19V17ZM18 4.58581L16.5858 6.00003L18 7.41424L19.4142 6.00003L18 4.58581ZM7 5.00003H5V7.00003H7V5.00003Z"></path></svg>
            </div>
            <h3 className="text-lg font-semibold uppercase mb-4 tracking-normal">Deep Integrations</h3>
            <p className="text-gray-500 font-medium leading-relaxed">Works with everything you use. Gmail, Calendar, Stripe, Postgres, Slack, Telegram — Rizly integrates seamlessly into your stack.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 px-10 border-b-2 border-black/10 bg-[#FE7F2D]/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FE7F2D] text-[13px] font-black uppercase tracking-[0.4em] mb-4 block">The Rizly Flow</span>
            <h2 className="text-3xl md:text-5xl font-semibold uppercase tracking-normal">How Rizly operates</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-white p-10 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
              <div className="absolute -top-6 -left-6 w-12 h-12 bg-[#FE7F2D] text-white font-black text-xl flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">01</div>
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D] mb-6 mt-4" height="40" width="40" xmlns="http://www.w3.org/2000/svg"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V6c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v4z"></path></svg>
              <h4 className="text-2xl font-black uppercase mb-4">Monitor & Learn</h4>
              <p className="text-gray-500 font-medium leading-relaxed">Rizly watches your inbox, calendar, and revenue streams in real-time, learning your patterns and priorities from day one.</p>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-10 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
              <div className="absolute -top-6 -left-6 w-12 h-12 bg-[#FE7F2D] text-white font-black text-xl flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">02</div>
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D] mb-6 mt-4" height="40" width="40" xmlns="http://www.w3.org/2000/svg"><path d="M3 13h2v8H3zm4-8h2v16H7zm4-2h2v18h-2zm4 4h2v14h-2zm4-2h2v16h-2z"></path></svg>
              <h4 className="text-2xl font-black uppercase mb-4">Draft & Suggest</h4>
              <p className="text-gray-500 font-medium leading-relaxed">When action is needed, Rizly drafts responses, suggests approvals, and prepares decisions. Everything is transparent and reviewable.</p>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-10 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
              <div className="absolute -top-6 -left-6 w-12 h-12 bg-[#FE7F2D] text-white font-black text-xl flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">03</div>
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D] mb-6 mt-4" height="40" width="40" xmlns="http://www.w3.org/2000/svg"><path d="M4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12ZM12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM17.4571 9.45711L16.0429 8.04289L11 13.0858L8.20711 10.2929L6.79289 11.7071L11 15.9142L17.4571 9.45711Z"></path></svg>
              <h4 className="text-2xl font-black uppercase mb-4">You Decide & Execute</h4>
              <p className="text-gray-500 font-medium leading-relaxed">You review, you approve, you decide. Rizly executes only what you've explicitly confirmed. You're always in control.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-32 px-10 border-b-2 border-black/10 bg-black text-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-[#FE7F2D] text-[13px] font-black uppercase tracking-[0.4em] mb-4 block">Zero-Trust Architecture</span>
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-8">Enterprise-grade security</h2>
            <p className="text-xl text-gray-400 font-medium leading-relaxed mb-10">Your data is your most valuable asset. Rizly processes everything with bank-level encryption and ephemeral containers that never persist your code.</p>
            <ul className="space-y-6">
              <li className="flex items-center gap-4 text-lg font-bold uppercase tracking-tight">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D]" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM16.4524 8.22183L17.8666 9.63604L11.5026 16L7.25999 11.7574L8.67421 10.3431L11.5019 13.1709L16.4524 8.22183Z"></path></svg>
                AES-256 Encryption
              </li>
              <li className="flex items-center gap-4 text-lg font-bold uppercase tracking-tight">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D]" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M12 1L20.2169 2.82598C20.6745 2.92766 21 3.33347 21 3.80217V13.7889C21 15.795 19.9974 17.6684 18.3282 18.7812L12 23L5.6718 18.7812C4.00261 17.6684 3 15.795 3 13.7889V3.80217C3 3.33347 3.32553 2.92766 3.78307 2.82598L12 1ZM12 3.04879L5 4.60434V13.7889C5 15.1263 5.6684 16.3752 6.7812 17.1171L12 20.5963L17.2188 17.1171C18.3316 16.3752 19 15.1263 19 13.7889V4.60434L12 3.04879ZM16.4524 8.22183L17.8666 9.63604L11.5026 16L7.25999 11.7574L8.67421 10.3431L11.5019 13.1709L16.4524 8.22183Z"></path></svg>
                GDPR & CCPA Compliant
              </li>
              <li className="flex items-center gap-4 text-lg font-bold uppercase tracking-tight">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D]" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>
                Zero Data Retention
              </li>
              <li className="flex items-center gap-4 text-lg font-bold uppercase tracking-tight">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="text-[#FE7F2D]" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M12 1C6.48 1 2 5.48 2 11s4.48 10 10 10 10-4.48 10-10S17.52 1 12 1zm-2 15l-5-5 1.41-1.41L10 13.17l7.59-7.59L19 7l-9 9z"></path></svg>
                SOC 2 Type II In Progress
              </li>
            </ul>
          </div>
          <div className="relative border-2 border-[#FE7F2D] p-8 shadow-[12px_12px_0px_0px_rgba(254,127,45,1)] bg-[#111]">
            <div className="font-mono text-sm space-y-2 text-emerald-400">
              <p>&gt; initializing secure session...</p>
              <p className="text-gray-500">&gt; connecting to approved integrations...</p>
              <p>&gt; processing approved actions only...</p>
              <p>&gt; monitoring for anomalies...</p>
              <p className="text-[#FE7F2D]">&gt; SUCCESS: All approvals honored</p>
              <p className="text-gray-500">&gt; cleaning sensitive data...</p>
              <p>&gt; session terminated securely.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-10 text-center bg-[#fcfcfc]">
        <h2 className="text-3xl md:text-5xl font-semibold uppercase tracking-normal leading-tight mb-10">Ready to reclaim <span className="text-[#FE7F2D]">your time</span>?</h2>
        <a className="inline-flex items-center gap-3 border-2 border-black bg-black px-16 py-8 text-[20px] font-semibold text-white transition-all shadow-[10px_10px_0px_0px_rgba(254,127,45,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[16px_16px_0px_0px_rgba(254,127,45,1)] active:translate-x-0 active:translate-y-0 active:shadow-none" href="/signup">
          START FREE TRIAL
          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="28" width="28" xmlns="http://www.w3.org/2000/svg"><path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z"></path></svg>
        </a>
      </section>
    </main>
  );
}
