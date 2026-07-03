import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Security Policy | rizly",
  description: "rizly security policy and responsible disclosure guidelines.",
  alternates: { canonical: `${SITE_URL}/security-policy` },
  openGraph: {
    title: "Security Policy | rizly",
    description: "rizly security policy.",
    url: `${SITE_URL}/security-policy`,
    type: "website",
  },
};

export default function SecurityPolicyPage() {
  return (
    <div className="flex flex-1 flex-col bg-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
      <section className="pt-20 pb-20 px-6 sm:px-10 md:px-14 border-b border-slate-200">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-slate-500 mb-4">Security</p>
          <h1 className="text-5xl md:text-6xl text-black mb-6 leading-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
            Responsible disclosure
          </h1>
          <p className="text-lg text-slate-700 leading-relaxed max-w-2xl">
            Found a security issue? We want to hear about it responsibly.
          </p>
        </div>
      </section>

      <section className="py-20 px-6 sm:px-10 md:px-14">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="border-l-2 border-[#FE7F2D] pl-6">
            <h2 className="text-2xl text-black mb-3" style={{ fontWeight: 500 }}>Report a vulnerability</h2>
            <p className="text-slate-600 leading-relaxed">
              Email <a href="mailto:security@getrizly.com" className="text-[#FE7F2D]">security@getrizly.com</a> with details. Please don't disclose publicly until we've had time to fix it. We take all reports seriously.
            </p>
          </div>

          <div className="border-l-2 border-[#FE7F2D] pl-6">
            <h2 className="text-2xl text-black mb-3" style={{ fontWeight: 500 }}>What to include</h2>
            <ul className="text-slate-600 space-y-2">
              <li>• Description of the vulnerability</li>
              <li>• Steps to reproduce it</li>
              <li>• Potential impact and severity</li>
              <li>• Your contact info (optional)</li>
            </ul>
          </div>

          <div className="border-l-2 border-[#FE7F2D] pl-6">
            <h2 className="text-2xl text-black mb-3" style={{ fontWeight: 500 }}>Our commitment</h2>
            <ul className="text-slate-600 space-y-2">
              <li>• Acknowledge receipt within 24 hours</li>
              <li>• Confirm and assess the vulnerability</li>
              <li>• Provide a timeline for a fix</li>
              <li>• Credit you in security advisory (optional)</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 sm:px-10 md:px-14 bg-slate-50 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl text-black mb-4" style={{ fontWeight: 500 }}>Thank you</h2>
          <p className="text-slate-600">Your responsible disclosure helps us keep rizly and our users safe.</p>
        </div>
      </section>
    </div>
  );
}
