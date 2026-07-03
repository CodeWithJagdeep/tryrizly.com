import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for using rizly.",
  alternates: { canonical: `${SITE_URL}/terms` },
};

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#0a0a0f]">
      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-[#FE7F2D]">Legal</p>
          <h1 className="mt-4 font-neue-haas text-4xl font-normal tracking-tight text-white md:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-6 text-base leading-relaxed text-white/50">
            We&apos;re finalizing the full terms of service for rizly. In the meantime, using the product means
            you agree to use it in good faith, keep your account credentials secure, and let us know if
            something looks wrong.
          </p>
          <p className="mt-6 text-base leading-relaxed text-white/50">
            Every action rizly takes on your behalf, from drafting a reply to flagging a calendar conflict,
            waits for your approval unless you&apos;ve explicitly turned on auto-act for that category.
          </p>
          <p className="mt-10 text-sm text-white/40">
            Questions about these terms? Reach us at{" "}
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
