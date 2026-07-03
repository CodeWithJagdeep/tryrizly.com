import type { Metadata } from "next";
import { Trust } from "../components/sections/Trust";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Trust & Security | Rizly",
  description: "See how approval-first automation works and how Rizly keeps your data safe.",
  alternates: { canonical: `${SITE_URL}/trust` },
  openGraph: {
    title: "Trust & Security | Rizly",
    description: "See how approval-first automation works and how Rizly keeps your data safe.",
    url: `${SITE_URL}/trust`,
    type: "website",
  },
};

export default function TrustPage() {
  return (
    <main>
      <section className="pt-32 pb-16 px-10 text-center relative border-b-2 border-black/10 overflow-hidden bg-white">
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(rgb(0, 0, 0) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
        ></div>
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 border-2 border-black bg-black text-white text-[11px] font-semibold uppercase tracking-[0.3em] mb-8">
            Rizly / Trust
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-8">
            Control stays <br /><span className="text-[#FE7F2D]">with you, end to end</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Approval-first means approval-first, not a setting buried three menus deep. Here's exactly how Rizly protects your inbox, calendar, and revenue data.
          </p>
        </div>
      </section>

      <Trust />

      <section className="px-10 md:px-14 py-24 text-center bg-white">
        <p className="text-gray-500 mb-4">Want the full technical breakdown of encryption, retention, and compliance?</p>
        <a href="/security-guide" className="text-[#FE7F2D] font-semibold hover:text-black transition-colors">
          Read the security guide →
        </a>
      </section>
    </main>
  );
}
