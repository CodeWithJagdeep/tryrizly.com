import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How rizly handles your data.",
  alternates: { canonical: `${SITE_URL}/privacy` },
};

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#0a0a0f]">
      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-[#FE7F2D]">Legal</p>
          <h1 className="mt-4 font-neue-haas text-4xl font-normal tracking-tight text-white md:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-6 text-base leading-relaxed text-white/50">
            We&apos;re finalizing the full privacy policy for rizly. Here&apos;s the short version in the
            meantime: your Gmail and Calendar OAuth tokens are stored encrypted, only used server-side to make
            the API calls you authorized, and never used to train any model.
          </p>
          <p className="mt-6 text-base leading-relaxed text-white/50">
            We don&apos;t sell your data. Connected data from Stripe, Razorpay, PostgreSQL, or MongoDB is used
            only to power your daily brief and background workflows.
          </p>
          <p className="mt-10 text-sm text-white/40">
            Questions about your data? Reach us at{" "}
            <a href="mailto:hello@getrizly.com" className="font-medium text-white/70 hover:text-[#FE7F2D]">
              hello@getrizly.com
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
