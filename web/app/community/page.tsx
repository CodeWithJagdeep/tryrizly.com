import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Community | rizly",
  description: "Join the rizly community of founders and operators.",
  alternates: { canonical: `${SITE_URL}/community` },
  openGraph: {
    title: "Community | rizly",
    description: "Join the rizly community.",
    url: `${SITE_URL}/community`,
    type: "website",
  },
};

export default function CommunityPage() {
  return (
    <div className="flex flex-1 flex-col bg-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
      <section className="pt-20 pb-20 px-6 sm:px-10 md:px-14 border-b border-slate-200">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-slate-500 mb-4">Community</p>
          <h1 className="text-5xl md:text-6xl text-black mb-6 leading-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
            Join founders building the future
          </h1>
          <p className="text-lg text-slate-700 leading-relaxed max-w-2xl">
            Connect with other operators using rizly. Share workflows, ask questions, and stay in the loop on new features and updates.
          </p>
        </div>
      </section>

      <section className="py-20 px-6 sm:px-10 md:px-14 border-b border-slate-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl text-black mb-12 leading-tight" style={{ fontWeight: 500 }}>
            Ways to connect
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="border-l-2 border-[#FE7F2D] pl-6">
              <h3 className="text-lg text-black mb-3" style={{ fontWeight: 500 }}>Discord server</h3>
              <p className="text-slate-600 mb-4">
                Real-time chat with rizly founders and users. Ask questions, share your workflows, and get help from the community.
              </p>
              <a href="https://discord.gg/rizly" className="text-[#FE7F2D] hover:text-slate-900 text-sm">
                Join Discord →
              </a>
            </div>

            <div className="border-l-2 border-[#FE7F2D] pl-6">
              <h3 className="text-lg text-black mb-3" style={{ fontWeight: 500 }}>Twitter</h3>
              <p className="text-slate-600 mb-4">
                Product updates, founder stories, and productivity tips. We share what we're learning in real-time.
              </p>
              <a href="https://twitter.com/rizly" className="text-[#FE7F2D] hover:text-slate-900 text-sm">
                Follow @rizly →
              </a>
            </div>

            <div className="border-l-2 border-[#FE7F2D] pl-6">
              <h3 className="text-lg text-black mb-3" style={{ fontWeight: 500 }}>LinkedIn</h3>
              <p className="text-slate-600 mb-4">
                Company updates, hiring announcements, and insights on building AI products. Follow along with our journey.
              </p>
              <a href="https://linkedin.com/company/rizly" className="text-[#FE7F2D] hover:text-slate-900 text-sm">
                Follow us →
              </a>
            </div>

            <div className="border-l-2 border-[#FE7F2D] pl-6">
              <h3 className="text-lg text-black mb-3" style={{ fontWeight: 500 }}>Email newsletter</h3>
              <p className="text-slate-600 mb-4">
                Weekly digest with new features, founder stories, and tips for reclaiming your time. No spam, just signal.
              </p>
              <a href="mailto:hello@getrizly.com" className="text-[#FE7F2D] hover:text-slate-900 text-sm">
                Subscribe →
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 sm:px-10 md:px-14 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl text-black mb-8 leading-tight" style={{ fontWeight: 500 }}>
            We're building in public
          </h2>
          <p className="text-slate-600 leading-relaxed mb-6">
            You shape rizly. We listen to every piece of feedback, incorporate it into our roadmap, and iterate based on what founders actually need. Your voice matters, and we want to hear it.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Join the community, share your ideas, and help us build the AI operator that solves the real problems founders face every day.
          </p>
        </div>
      </section>
    </div>
  );
}
