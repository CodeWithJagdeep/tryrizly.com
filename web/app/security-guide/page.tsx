import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Security Guide | rizly",
  description: "Learn about rizly security practices and how we protect your data.",
  alternates: { canonical: `${SITE_URL}/security-guide` },
  openGraph: {
    title: "Security Guide | rizly",
    description: "Learn about rizly security.",
    url: `${SITE_URL}/security-guide`,
    type: "website",
  },
};

export default function SecurityGuidePage() {
  return (
    <div className="flex flex-1 flex-col bg-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
      <section className="pt-20 pb-20 px-6 sm:px-10 md:px-14 border-b border-slate-200">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-slate-500 mb-4">Security</p>
          <h1 className="text-5xl md:text-6xl text-black mb-6 leading-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
            Your data is your own
          </h1>
          <p className="text-lg text-slate-700 leading-relaxed max-w-2xl">
            Security and privacy are foundational. Here's exactly how we protect your data.
          </p>
        </div>
      </section>

      <section className="py-20 px-6 sm:px-10 md:px-14">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="border-l-2 border-[#FE7F2D] pl-6">
            <h2 className="text-2xl text-black mb-3" style={{ fontWeight: 500 }}>Encryption at Rest & In Transit</h2>
            <p className="text-slate-600 leading-relaxed">
              All your data is encrypted using AES-256. OAuth tokens, business data, everything. Data in transit is protected with TLS 1.3. Your data is never readable to us or anyone else.
            </p>
          </div>

          <div className="border-l-2 border-[#FE7F2D] pl-6">
            <h2 className="text-2xl text-black mb-3" style={{ fontWeight: 500 }}>Token Management</h2>
            <p className="text-slate-600 leading-relaxed">
              Your OAuth tokens for Gmail, Calendar, Stripe, and other services are encrypted and stored securely. We only use them to make API calls you authorize. Never for model training. Never shared.
            </p>
          </div>

          <div className="border-l-2 border-[#FE7F2D] pl-6">
            <h2 className="text-2xl text-black mb-3" style={{ fontWeight: 500 }}>We Don't Train on Your Data</h2>
            <p className="text-slate-600 leading-relaxed">
              Your emails, calendar, revenue data — used only for your personal rizly experience. Not to improve our models. Not to train AI. Not at all outside your account.
            </p>
          </div>

          <div className="border-l-2 border-[#FE7F2D] pl-6">
            <h2 className="text-2xl text-black mb-3" style={{ fontWeight: 500 }}>Compliance</h2>
            <p className="text-slate-600 leading-relaxed">
              GDPR compliant. CCPA compliant. SOC 2 in progress. We take regulatory requirements as seriously as we take your privacy.
            </p>
          </div>

          <div className="border-l-2 border-[#FE7F2D] pl-6">
            <h2 className="text-2xl text-black mb-3" style={{ fontWeight: 500 }}>Found a vulnerability?</h2>
            <p className="text-slate-600 leading-relaxed">
              Email <a href="mailto:security@getrizly.com" className="text-[#FE7F2D] hover:text-slate-900">security@getrizly.com</a> with details. Please don't disclose publicly until we've had time to fix it. We respond within 24 hours.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
