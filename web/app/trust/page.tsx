import type { Metadata } from "next";
import { Eyebrow } from "../components/product/Eyebrow";
import { HeroGlow } from "../components/product/HeroGlow";
import { TrustSection } from "../components/home/TrustSection";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Trust & Security",
  description: "See how approval-first automation works and how Rizly keeps your data safe.",
  alternates: { canonical: `${SITE_URL}/trust` },
  openGraph: {
    title: "Trust & Security",
    description: "See how approval-first automation works and how Rizly keeps your data safe.",
    url: `${SITE_URL}/trust`,
    type: "website",
  },
};

export default function TrustPage() {
  return (
    <main className="bg-white text-black">
      <section className="relative overflow-hidden border-b border-black/10 bg-white">
        <HeroGlow />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-28 text-center md:px-10">
          <Eyebrow>Rizly / Trust</Eyebrow>
          <h1 className="max-w-2xl text-4xl font-normal leading-[1.08] tracking-tight text-[#20151c] [text-wrap:balance] md:text-5xl">
            Control stays <span className="text-[#ff4f00]">with you, end to end</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-gray-600 md:text-base">
            Approval-first means approval-first, not a setting buried three menus deep. Here&apos;s exactly how
            Rizly protects your inbox, calendar, and revenue data.
          </p>
        </div>
      </section>

      <TrustSection hideIntro />

      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 text-center md:px-10 lg:px-14">
        <p className="mb-4 text-sm text-gray-600">
          Want the full technical breakdown of encryption, retention, and compliance?
        </p>
        <a href="/security-guide" className="text-sm text-[#20151c] underline underline-offset-4 transition hover:text-[#ff4f00]">
          Read the security guide &rarr;
        </a>
      </section>
    </main>
  );
}
