import type { Metadata } from "next";
import { Eyebrow } from "../../components/product/Eyebrow";
import { FaqAccordion } from "../../components/product/FaqAccordion";
import { HeroGlow } from "../../components/product/HeroGlow";
import { PhoneVideo } from "../../components/product/PhoneVideo";
import { mediaUrl } from "../../../lib/media";
import { ProductCta } from "../../components/product/ProductCta";
import { ScreenshotPanel } from "../../components/product/ScreenshotPanel";
import { Testimonial } from "../../components/product/Testimonial";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "AI Email Triage for Gmail",
  description:
    "Rizly classifies and summarizes Gmail threads, drafts replies in your tone, and sends only after you approve in Telegram.",
  alternates: { canonical: `${SITE_URL}/product/email-triage` },
  openGraph: {
    title: "AI Email Triage for Gmail",
    description: "Classify, summarize, draft, and route important messages automatically.",
    url: `${SITE_URL}/product/email-triage`,
    type: "website",
  },
};

const inbox = [
  { from: "Priya Shah — Lightspeed", subject: "Re: Intro call next week", tag: "Needs a decision", color: "#D9BEF4" },
  { from: "Calendly", subject: "New meeting request: Thu 2pm", tag: "Meeting request", color: "#3B82F6" },
  { from: "Stripe", subject: "Payment failed for invoice #4471", tag: "Payment", color: "#22c55e" },
  { from: "Product Hunt Weekly", subject: "This week's top launches", tag: "Noise", color: "#9CA3AF" },
  { from: "Markus — Gradient Ventures", subject: "Term sheet — let's close by Friday", tag: "Needs a decision", color: "#D9BEF4" },
  { from: "LinkedIn", subject: "5 people viewed your profile", tag: "Noise", color: "#9CA3AF" },
];

const capabilities = [
  { title: "Triaged by what it actually is", description: "Every new email is classified, noise, payment due, meeting request, or investor update, not just marked read or unread." },
  { title: "Drafts in your voice", description: "Riz drafts replies that sound like you, learned from how you actually write. Nothing sends until you approve it." },
  { title: "Tracks commitments", description: "Promises and follow-ups mentioned in threads are tracked automatically, so nothing quietly slips through the cracks." },
];

const questions = [
  { q: "Does it read everything in my inbox?", a: "Riz processes messages to classify and draft, but nothing is stored beyond what's needed for triage and your durable memory." },
  { q: "Can I correct a misclassified email?", a: "Yes. Every classification is visible and you can reclassify or give feedback in Telegram, which Riz factors into future triage." },
  { q: "Will it accidentally send something?", a: "No. Drafts wait for your explicit approval unless you turn on auto-act for a specific, narrow category yourself." },
];

const stats = [
  { value: "-73%", label: "Time in inbox" },
  { value: "< 1 min", label: "To connect Gmail" },
  { value: "100%", label: "Approval required" },
  { value: "24/7", label: "Watching your inbox" },
];

const audiences = [
  { title: "Solo founders", description: "No assistant, no ops hire. Riz becomes the first line of defense on your inbox." },
  { title: "Founding teams", description: "Shared inboxes and handoffs get messy fast. Riz keeps triage consistent no matter who's watching." },
  { title: "Busy operators", description: "Running day-to-day ops without a founder title. Riz turns your inbox into a decision queue, not a chore." },
];

export default function EmailTriagePage() {
  return (
    <main className="bg-white text-black">
      <section className="relative overflow-hidden border-b border-black/10 bg-white">
        <HeroGlow />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-28 text-center md:px-10">
          <Eyebrow>Rizly / Email triage</Eyebrow>
          <h1 className="max-w-2xl text-4xl font-normal leading-[1.08] tracking-tight text-[#233D4D] [text-wrap:balance] md:text-5xl">
            Your inbox, <span className="text-[#D9BEF4]">already sorted</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-gray-600 md:text-base">
            Stop opening your inbox to guess what matters. Riz reads every message first and tells you only what needs a decision.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-14 md:px-10 lg:px-14">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 text-center md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <span className="mb-2 block text-3xl font-normal text-[#233D4D]">{stat.value}</span>
              <span className="block text-xs uppercase tracking-[0.1em] text-gray-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Live inbox visual */}
      <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <div className="overflow-hidden rounded-2xl bg-[#f7f7f6] shadow-[0_30px_80px_-60px_rgba(32,21,28,0.4)]">
            <div className="flex items-center justify-between border-b border-black/5 bg-white px-6 py-4">
              <span className="text-sm font-normal text-[#233D4D]">Inbox — 6 new</span>
              <span className="text-xs uppercase tracking-[0.1em] text-[#D9BEF4]">Triaged by Riz</span>
            </div>
            <div className="divide-y divide-black/[0.06]">
              {inbox.map((mail) => (
                <div key={mail.subject} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-normal text-[#233D4D]">{mail.from}</p>
                    <p className="truncate text-sm text-gray-500">{mail.subject}</p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-[10px] font-normal uppercase tracking-widest text-white"
                    style={{ backgroundColor: mail.color }}
                  >
                    {mail.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto grid max-w-[88rem] grid-cols-1 gap-5 md:grid-cols-3">
          {capabilities.map((item) => (
            <div key={item.title} className="rounded-2xl bg-white p-8 shadow-[0_20px_60px_-48px_rgba(32,21,28,0.4)]">
              <h3 className="mb-3 text-lg font-normal text-[#233D4D]">{item.title}</h3>
              <p className="text-sm leading-6 text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Real dashboard screenshot */}
      <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <Eyebrow>In your dashboard</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#233D4D] md:text-4xl">
              Every triaged thread, one clean view
            </h2>
          </div>
          <ScreenshotPanel
            src="/images/emails.png"
            width={1588}
            height={779}
            alt="Rizly dashboard email triage view"
            caption="The full inbox view in your Rizly dashboard"
          />
        </div>
      </section>

      {/* Drafted reply mockup with real video */}
      <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <Eyebrow>Then it drafts</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#233D4D] md:text-4xl">
              A reply, ready to approve
            </h2>
          </div>
          <div className="flex justify-center">
            <PhoneVideo src={mediaUrl("/video/telegram_mail.mp4")} width={416} height={848} className="w-full max-w-[260px]" />
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-[88rem]">
          <div className="mb-14 text-center">
            <Eyebrow>Who it&apos;s for</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#233D4D] [text-wrap:balance] md:text-4xl">
              Built for inboxes that never stop
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {audiences.map((audience) => (
              <div key={audience.title} className="rounded-2xl bg-white p-8 shadow-[0_20px_60px_-48px_rgba(32,21,28,0.4)]">
                <h3 className="mb-3 text-lg font-normal text-[#233D4D]">{audience.title}</h3>
                <p className="text-sm leading-6 text-gray-600">{audience.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="relative overflow-hidden bg-[#233D4D] px-6 py-20 text-center md:px-10 lg:px-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-2xl">
          <Eyebrow light>Why founders trust it</Eyebrow>
          <h2 className="text-3xl font-normal leading-tight tracking-tight text-white [text-wrap:balance] md:text-4xl">
            Nothing sends without you
          </h2>
          <p className="mt-6 text-sm leading-6 text-white/50 md:text-base">
            Riz drafts every reply and waits. Your Gmail OAuth token is encrypted at rest and only used server-side to
            process the messages you&apos;ve authorized.
          </p>
          <a href="/trust" className="mt-6 inline-block text-sm text-white/70 underline underline-offset-4 transition hover:text-white">
            See how trust works &rarr;
          </a>
        </div>
      </section>

      <Testimonial
        quote="My inbox used to be the first thing I dreaded every morning. Now I get a Telegram message with the three things that actually need me."
        author="Early access founder"
      />

      {/* FAQ */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-3xl font-normal leading-tight tracking-tight text-[#233D4D] md:text-4xl">
            Common questions
          </h2>
          <FaqAccordion items={questions} />
        </div>
      </section>

      <ProductCta title="Connect Gmail in under a minute" />
    </main>
  );
}
