import type { Metadata } from "next";
import { Faq } from "../components/sections/Faq";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "FAQ | Rizly",
  description: "Answers on setup, billing, and controls for Rizly.",
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: "FAQ | Rizly",
    description: "Answers on setup, billing, and controls for Rizly.",
    url: `${SITE_URL}/faq`,
    type: "website",
  },
};

export default function FaqPage() {
  return (
    <main>
      <section className="pt-32 pb-16 px-10 text-center relative border-b-2 border-black/10 overflow-hidden bg-white">
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        ></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 border-2 border-black bg-black text-white text-[11px] font-semibold uppercase tracking-[0.3em] mb-8">
            Rizly / FAQ
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-8">
            Answers on setup, <br /><span className="text-[#FE7F2D]">billing, and controls</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Everything you'd ask before connecting your inbox, calendar, and revenue to an AI operator.
          </p>
        </div>
      </section>

      <Faq />
    </main>
  );
}
