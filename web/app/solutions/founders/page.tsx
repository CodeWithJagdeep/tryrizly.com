import type { Metadata } from "next";
import { Eyebrow } from "../../components/product/Eyebrow";
import { FaqAccordion } from "../../components/product/FaqAccordion";
import { HeroGlow } from "../../components/product/HeroGlow";
import { ProductCta } from "../../components/product/ProductCta";
import { Testimonial } from "../../components/product/Testimonial";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "For Founders",
  description: "Keep investor, customer, and ops work from slipping through the cracks.",
  alternates: { canonical: `${SITE_URL}/solutions/founders` },
  openGraph: {
    title: "For Founders",
    description: "Keep investor, customer, and ops work from slipping through the cracks.",
    url: `${SITE_URL}/solutions/founders`,
    type: "website",
  },
};

const stats = [
  { value: "15+ hrs", label: "Reclaimed weekly" },
  { value: "100%", label: "Approval required" },
  { value: "< 1 min", label: "To connect Gmail" },
  { value: "0", label: "Dropped commitments" },
];

const painPoints = [
  { title: "Investor threads go cold", description: "A term sheet reply sits unanswered for two days because it got buried under forty other emails." },
  { title: "Calendar conflicts sneak in", description: "You accept a call, then realize it overlaps with a board prep block you'd already set aside." },
  { title: "Revenue signals arrive late", description: "A failed payment or a churn signal shows up in a spreadsheet review a week after it happened." },
];

const moments = [
  { time: "7:40 AM", title: "Before you open your laptop", detail: "Riz already triaged overnight email. Three newsletters archived, one investor reply flagged, a Telegram message waiting with a suggested response." },
  { time: "11:15 AM", title: "A meeting request lands mid-focus", detail: "It checks your calendar, sees the conflict, and asks in Telegram whether to reschedule, so you can stay in flow instead of context-switching." },
  { time: "9:05 PM", title: "The day closes with one message, not twelve tabs", detail: "Revenue movement from Stripe, a renewal risk that needs a nudge, and tomorrow's first meeting prepped and ready, all in one brief." },
];

const questions = [
  { q: "Will Riz reply to investors on its own?", a: "Never without your approval. It drafts a reply and waits for you to review, edit, or send it yourself." },
  { q: "Can it handle fundraising-specific context?", a: "Yes. Riz tracks your ARR, churn, and key metrics from connected sources so drafts and prep packets have real numbers, not placeholders." },
  { q: "What if I only want it watching my inbox?", a: "That's fine. Connect Gmail and Calendar alone, revenue monitoring and other integrations are entirely optional." },
];

const comparison = [
  { without: "Reread a whole investor thread to remember where things stand before replying.", with: "Riz surfaces a one-line summary and a drafted reply, ready in seconds." },
  { without: "Discover a double-booked board call the morning it happens.", with: "Conflicts are flagged the moment the invite lands, not after you've already accepted." },
  { without: "Chase your own memory for what you promised a customer three weeks ago.", with: "Every commitment is tracked automatically and resurfaced before it's overdue." },
  { without: "Piece together your runway from three different tabs before a board update.", with: "ARR, churn, and burn are already summarized and ready to drop into the deck." },
];

const stages = [
  { title: "Fundraising", detail: "Investor threads triaged by urgency, term sheet replies drafted with your real metrics attached." },
  { title: "Customer ops", detail: "Support escalations and renewal risk surfaced before they become churn." },
  { title: "Day-to-day", detail: "Calendar conflicts caught early, commitments tracked, inbox reduced to what needs you." },
];

export default function FoundersPage() {
  return (
    <main className="bg-white text-black">
      <section className="relative overflow-hidden border-b border-black/10 bg-white">
        <HeroGlow />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-28 text-center md:px-10">
          <Eyebrow>Rizly / For founders</Eyebrow>
          <h1 className="max-w-2xl text-4xl font-normal leading-[1.08] tracking-tight text-[#233D4D] [text-wrap:balance] md:text-5xl">
            Keep investor, customer, <span className="text-[#D9BEF4]">and ops work from slipping</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-gray-600 md:text-base">
            Founders wear a hundred hats. Riz runs quietly in the background so nothing important gets lost between
            them.
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

      {/* Pain points */}
      <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-[88rem]">
          <div className="mb-14 text-center">
            <Eyebrow>The problem</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#233D4D] [text-wrap:balance] md:text-4xl">
              Where founders lose time and trust
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {painPoints.map((point) => (
              <div key={point.title} className="rounded-2xl bg-[#f7f7f6] p-8">
                <h3 className="mb-3 text-lg font-normal text-[#233D4D]">{point.title}</h3>
                <p className="text-sm leading-6 text-gray-600">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Day in the life */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-5xl">
          <Eyebrow>A day with Riz</Eyebrow>
          <h2 className="max-w-xl text-3xl font-normal leading-tight tracking-tight text-[#233D4D] [text-wrap:balance] md:text-4xl">
            Running quietly in the background
          </h2>

          <div className="mt-14 space-y-10">
            {moments.map((moment) => (
              <div key={moment.time} className="flex flex-col gap-3 border-l-2 border-black/10 pl-8 md:flex-row md:gap-8">
                <span className="shrink-0 font-mono text-xs uppercase tracking-[0.2em] text-[#D9BEF4] md:w-24">
                  {moment.time}
                </span>
                <div>
                  <h3 className="text-lg font-normal text-[#233D4D]">{moment.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">{moment.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before / after */}
      <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <Eyebrow>Before and after</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#233D4D] [text-wrap:balance] md:text-4xl">
              What changes once Riz is running
            </h2>
          </div>
          <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl bg-[#fcfcfc] shadow-[0_30px_80px_-60px_rgba(32,21,28,0.4)]">
            {comparison.map((row) => (
              <div key={row.without} className="grid grid-cols-1 divide-y divide-black/[0.06] md:grid-cols-2 md:divide-x md:divide-y-0">
                <div className="p-6">
                  <span className="mb-2 block text-xs uppercase tracking-[0.1em] text-gray-400">Without Riz</span>
                  <p className="text-sm leading-6 text-gray-600">{row.without}</p>
                </div>
                <div className="bg-[#fff7f3] p-6">
                  <span className="mb-2 block text-xs uppercase tracking-[0.1em] text-[#D9BEF4]">With Riz</span>
                  <p className="text-sm leading-6 text-[#233D4D]">{row.with}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-[88rem]">
          <div className="mb-14 text-center">
            <Eyebrow>Coverage</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#233D4D] [text-wrap:balance] md:text-4xl">
              From fundraising to day-to-day ops
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {stages.map((stage) => (
              <div key={stage.title} className="rounded-2xl bg-white p-8 shadow-[0_20px_60px_-48px_rgba(32,21,28,0.4)]">
                <h3 className="mb-3 text-lg font-normal text-[#233D4D]">{stage.title}</h3>
                <p className="text-sm leading-6 text-gray-600">{stage.detail}</p>
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
            Your inbox stays yours
          </h2>
          <p className="mt-6 text-sm leading-6 text-white/50 md:text-base">
            OAuth tokens are encrypted at rest. Every draft waits for your review. Riz never sends anything to an
            investor, customer, or teammate without you saying go.
          </p>
          <a href="/trust" className="mt-6 inline-block text-sm text-white/70 underline underline-offset-4 transition hover:text-white">
            See how trust works &rarr;
          </a>
        </div>
      </section>

      <Testimonial
        quote="I raised my seed round while running three other fires. Riz was the only reason I didn't drop a single investor thread."
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

      <ProductCta title="Reclaim your day" />
    </main>
  );
}
