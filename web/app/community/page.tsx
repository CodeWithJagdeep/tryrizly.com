import type { Metadata } from "next";
import Link from "next/link";
import { NewsletterSignup } from "./newsletter-form";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Follow what ships, shape the roadmap, and talk to the people building Rizly — the approval-first AI operator.",
  alternates: { canonical: `${SITE_URL}/community` },
  openGraph: {
    title: "Community",
    description: "Follow what ships, shape the roadmap, and talk to the people building Rizly.",
    url: `${SITE_URL}/community`,
    type: "website",
  },
};

const channels = [
  {
    title: "Changelog",
    description:
      "Every feature, fix, and improvement as it ships. The fastest way to see how quickly Rizly moves.",
    cta: "See what shipped",
    href: "/changelog",
  },
  {
    title: "Talk to the builders",
    description:
      "Feature requests, workflow questions, or something broken — a founder reads and answers every message.",
    cta: "Contact us",
    href: "/contact",
  },
  {
    title: "Work with us",
    description:
      "We're a small team building an AI operator that asks first. If that's your kind of problem, come build it.",
    cta: "Open roles",
    href: "/careers",
  },
];

export default function CommunityPage() {
  return (
    <div className="flex flex-1 flex-col bg-white font-neue-haas">
      {/* Hero */}
      <section className="relative overflow-hidden border-b-2 border-black px-4 pt-24 pb-16 sm:px-6 md:pt-32 md:pb-20 lg:px-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "28px 28px" }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl">
          <span className="inline-block border-2 border-[#D9BEF4] px-3 py-1 text-[12px] font-black uppercase tracking-[0.2em] text-[#D9BEF4]">
            Community
          </span>
          <h1 className="mt-7 max-w-3xl text-balance text-4xl font-medium leading-[1.08] tracking-tight text-black md:text-6xl">
            Built in public, <span className="text-[#D9BEF4]">shaped by the people using it</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-500">
            Rizly gets better because operators tell us what's broken and what's missing. Follow
            what ships, send us the feedback, and watch it land in the changelog.
          </p>
        </div>
      </section>

      {/* Channels */}
      <section className="px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {channels.map((channel, index) => (
              <Link
                key={channel.title}
                href={channel.href}
                className="group flex h-full flex-col border-2 border-black bg-white p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0px_0px_rgba(217,190,244,1)]"
              >
                <p className="font-mono text-xs font-bold tracking-widest text-black/15 transition-colors duration-300 group-hover:text-[#D9BEF4]/40">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-4 text-xl font-black uppercase tracking-tight text-black">
                  {channel.title}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-500">{channel.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-[13px] font-black uppercase tracking-tight text-[#D9BEF4] transition-colors group-hover:text-black">
                  {channel.cta}
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="border-t-2 border-black bg-[#fcfcfc] px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D9BEF4]">Newsletter</p>
            <h2 className="mt-4 text-3xl font-black uppercase tracking-tight text-black md:text-4xl">
              One email when it matters.
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-gray-500">
              New features, workflow ideas from real users, and what we learned building an AI
              operator that asks first. Sent when there's something worth sending.
            </p>
          </div>
          <div className="lg:justify-self-end">
            <NewsletterSignup />
          </div>
        </div>
      </section>

      {/* Building in public */}
      <section className="border-t-2 border-black bg-black px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D9BEF4]">
              You shape the roadmap
            </p>
            <h2 className="mt-4 text-balance text-3xl font-medium tracking-tight text-white md:text-4xl">
              Tell us what Riz should handle next.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/50">
              Every feature on the changelog started as a message from someone using the product.
              Feedback doesn't go into a void — it goes into the next release.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contact"
              className="inline-flex h-12 items-center justify-center border-2 border-[#D9BEF4] bg-[#D9BEF4] px-8 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white hover:text-black"
            >
              Send feedback
            </Link>
            <Link
              href="/changelog"
              className="inline-flex h-12 items-center justify-center border-2 border-white/25 px-8 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white hover:text-black"
            >
              See the changelog
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
