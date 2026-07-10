import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "../../components/product/Eyebrow";
import { FaqAccordion } from "../../components/product/FaqAccordion";
import { HeroGlow } from "../../components/product/HeroGlow";
import { PhoneVideo } from "../../components/product/PhoneVideo";
import { ProductCta } from "../../components/product/ProductCta";
import { ScreenshotPanel } from "../../components/product/ScreenshotPanel";
import { Testimonial } from "../../components/product/Testimonial";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Telegram AI Operator for Founders",
  description:
    "One AI operator across Gmail, Google Calendar, and revenue data, talking to you in Telegram and asking before anything sensitive runs.",
  alternates: { canonical: `${SITE_URL}/product/ai-operator` },
  openGraph: {
    title: "Telegram AI Operator for Founders",
    description: "One AI operator across your inbox, calendar, and business data, in Telegram.",
    url: `${SITE_URL}/product/ai-operator`,
    type: "website",
  },
};

const systems = [
  { label: "Inbox", detail: "Every thread, triaged and drafted." },
  { label: "Calendar", detail: "Conflicts caught before you see them." },
  { label: "Revenue", detail: "Stripe, Razorpay, and your databases." },
];

const moments = [
  { time: "7:40 AM", title: "Before you open your laptop", detail: "Overnight email is already triaged. Newsletters archived, one investor reply flagged, a suggested response waiting in Telegram." },
  { time: "11:15 AM", title: "A meeting request lands mid-focus", detail: "Riz checks your calendar, sees the conflict, and asks in Telegram whether to reschedule, so you stay in flow." },
  { time: "9:05 PM", title: "The day closes with one message", detail: "Revenue movement, a renewal risk, and tomorrow's first meeting prepped, all in a single brief." },
];

const sources = ["Gmail", "Google Calendar", "Telegram", "Stripe", "Razorpay", "PostgreSQL", "MongoDB"];

const comparison = [
  { app: "Five different apps", detail: "A separate tab for inbox, calendar, revenue dashboard, and messaging. Context lives nowhere." },
  { app: "One operator", detail: "Riz holds the context across all of it and brings you only what needs a decision, in one thread." },
];

const questions = [
  { q: "Does Riz replace my other tools?", a: "No. It sits on top of Gmail, Calendar, and your revenue tools and reasons across them, you keep using what you already have." },
  { q: "How does it know what I care about?", a: "It learns from your approvals, edits, and rejections over time, building a durable memory of your preferences." },
  { q: "Can I use it without Telegram?", a: "Gmail and Calendar still get triaged in the background, but you'll miss real-time approve/reject prompts without Telegram connected." },
];

export default function AiOperatorPage() {
  return (
    <main className="bg-white text-black">
      <section className="relative overflow-hidden border-b border-black/10 bg-white">
        <HeroGlow />
        <div className="relative mx-auto grid max-w-[88rem] grid-cols-1 items-center gap-14 px-6 pb-20 pt-28 md:px-10 lg:grid-cols-2 lg:px-14">
          <div>
            <Eyebrow>Rizly / AI operator</Eyebrow>
            <h1 className="max-w-xl text-4xl font-normal leading-[1.08] tracking-tight text-[#20151c] [text-wrap:balance] md:text-5xl">
              One operator across <span className="text-[#ff4f00]">everything you run</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-6 text-gray-600 md:text-base">
              Riz isn&apos;t a chatbot bolted onto a dashboard. It&apos;s a single operator that watches every
              connected system and talks to you where you already are, Telegram.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {systems.map((system) => (
                <div key={system.label} className="rounded-2xl bg-[#f7f7f6] px-4 py-3">
                  <span className="block text-sm font-normal text-[#20151c]">{system.label}</span>
                  <span className="text-xs text-gray-500">{system.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <PhoneVideo src="/video/telegram_meeting.mp4" width={448} height={848} className="w-full max-w-[300px]" />
          </div>
        </div>
      </section>

      {/* Day in the life */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-5xl">
          <Eyebrow>A day with Riz</Eyebrow>
          <h2 className="max-w-xl text-3xl font-normal leading-tight tracking-tight text-[#20151c] [text-wrap:balance] md:text-4xl">
            Running quietly in the background
          </h2>

          <div className="mt-14 space-y-10">
            {moments.map((moment) => (
              <div key={moment.time} className="flex flex-col gap-3 border-l-2 border-black/10 pl-8 md:flex-row md:gap-8">
                <span className="shrink-0 font-mono text-xs uppercase tracking-[0.2em] text-[#ff4f00] md:w-24">
                  {moment.time}
                </span>
                <div>
                  <h3 className="text-lg font-normal text-[#20151c]">{moment.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">{moment.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real dashboard screenshot */}
      <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <Eyebrow>The calendar it defends</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#20151c] md:text-4xl">
              Conflicts caught before you see them
            </h2>
          </div>
          <ScreenshotPanel
            src="/images/calendar.png"
            width={1575}
            height={839}
            alt="Rizly dashboard calendar view"
            caption="The calendar view in your Rizly dashboard"
          />
        </div>
      </section>

      {/* Integrations */}
      <section className="border-t border-black/10 bg-white px-6 py-20 text-center md:px-10 lg:px-14">
        <Eyebrow>Works with your stack</Eyebrow>
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-3">
          {sources.map((source) => (
            <span key={source} className="rounded-full bg-[#f7f7f6] px-4 py-2 text-sm text-[#20151c]">
              {source}
            </span>
          ))}
        </div>
      </section>

      {/* Why one operator */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <Eyebrow>Why one operator</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#20151c] [text-wrap:balance] md:text-4xl">
              Not another tab to check
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {comparison.map((item, index) => (
              <div
                key={item.app}
                className={`rounded-2xl p-8 ${index === 1 ? "bg-[#20151c] text-white" : "bg-white shadow-[0_20px_60px_-48px_rgba(32,21,28,0.4)]"}`}
              >
                <h3 className="mb-3 text-lg font-normal">{item.app}</h3>
                <p className={`text-sm leading-6 ${index === 1 ? "text-white/60" : "text-gray-600"}`}>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Testimonial
        quote="I stopped checking four different tabs every morning. I ask Riz one question in Telegram and I have the full picture."
        author="Early access founder"
      />

      {/* FAQ */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-3xl font-normal leading-tight tracking-tight text-[#20151c] md:text-4xl">
            Common questions
          </h2>
          <FaqAccordion items={questions} />
        </div>
      </section>

      <ProductCta
        title="Ready to connect your first account?"
        detail="Under a minute to connect Gmail. See what Riz finds in your inbox today."
      />
    </main>
  );
}
