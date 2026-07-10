import type { Metadata } from "next";
import { Eyebrow } from "../../components/product/Eyebrow";
import { FaqAccordion } from "../../components/product/FaqAccordion";
import { HeroGlow } from "../../components/product/HeroGlow";
import { PhoneVideo } from "../../components/product/PhoneVideo";
import { ProductCta } from "../../components/product/ProductCta";
import { ScreenshotPanel } from "../../components/product/ScreenshotPanel";
import { Testimonial } from "../../components/product/Testimonial";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Approval-First AI Actions",
  description:
    "Every outbound email, calendar event, and reschedule waits for your explicit approval in Telegram or the dashboard before it runs.",
  alternates: { canonical: `${SITE_URL}/product/approvals` },
  openGraph: {
    title: "Approval-First AI Actions",
    description: "Approve outbound actions before anything is sent.",
    url: `${SITE_URL}/product/approvals`,
    type: "website",
  },
};

const history = [
  { time: "9:41 AM", action: "Reply to Markus (Gradient Ventures)", status: "Approved" },
  { time: "9:38 AM", action: "Reschedule Thursday 2pm call", status: "Edited" },
  { time: "8:55 AM", action: "Follow-up to failed payment #4471", status: "Approved" },
  { time: "8:20 AM", action: "Archive 3 newsletter threads", status: "Auto (opted in)" },
  { time: "Yesterday", action: "Reply to Priya (Lightspeed)", status: "Rejected" },
];

const statusColor: Record<string, string> = {
  Approved: "#22c55e",
  Edited: "#3B82F6",
  Rejected: "#EF4444",
  "Auto (opted in)": "#9CA3AF",
};

const stages = [
  { step: "01", title: "Riz drafts the action", detail: "A reply, a reschedule, a follow-up, prepared with full context from every connected system." },
  { step: "02", title: "It waits for you", detail: "The draft lands in Telegram with the context that led to it, not just a bare notification." },
  { step: "03", title: "You decide", detail: "One tap sends it. Edit if it's not quite right. Reject and Riz learns for next time." },
];

const questions = [
  { q: "Can I let some actions run automatically?", a: "Yes. You can opt a specific, narrow category into auto-act once you trust it, nothing broad is ever turned on by default." },
  { q: "What happens if I don't respond?", a: "It simply waits. Riz doesn't assume silence means yes. Pending approvals stay queued until you act." },
  { q: "Is there a record of what I approved?", a: "Every approval, edit, and rejection is logged with a timestamp, giving you a full audit trail." },
];

const actionTypes = ["Email replies", "Calendar changes", "Revenue actions", "Team routing"];

const audiences = [
  { title: "Solo founders", description: "No one to double-check your sends. The approval step is your safety net." },
  { title: "Founding teams", description: "Multiple people touching the same inbox. A single, visible approval queue keeps everyone aligned." },
  { title: "Busy operators", description: "Too many decisions, too little time. One place to say yes or no, from your phone." },
];

export default function ApprovalsPage() {
  return (
    <main className="bg-white text-black">
      <section className="relative overflow-hidden border-b border-black/10 bg-white">
        <HeroGlow />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-28 text-center md:px-10">
          <Eyebrow>Rizly / Approvals</Eyebrow>
          <h1 className="max-w-2xl text-4xl font-normal leading-[1.08] tracking-tight text-[#20151c] [text-wrap:balance] md:text-5xl">
            Nothing sends <span className="text-[#ff4f00]">without you</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-gray-600 md:text-base">
            Every draft, reply, and scheduling change waits for your approval in Telegram. Approve, edit, or reject
            with a single reply.
          </p>
        </div>
      </section>

      {/* Approval history feed */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <Eyebrow>Full audit trail</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#20151c] md:text-4xl">
              Every decision, logged
            </h2>
          </div>
          <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-60px_rgba(32,21,28,0.4)]">
            {history.map((item) => (
              <div key={item.action + item.time} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-normal text-[#20151c]">{item.action}</p>
                  <p className="text-xs text-gray-400">{item.time}</p>
                </div>
                <span
                  className="shrink-0 rounded-full px-3 py-1 text-[10px] font-normal uppercase tracking-widest text-white"
                  style={{ backgroundColor: statusColor[item.status] }}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What goes through approval */}
      <section className="relative overflow-hidden bg-[#20151c] px-6 py-16 text-center md:px-10 lg:px-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
          aria-hidden="true"
        />
        <div className="relative">
          <Eyebrow light>Every category, always visible</Eyebrow>
          <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-3">
            {actionTypes.map((type) => (
              <span key={type} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80">
                {type}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Approval mockup with real video */}
      <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <Eyebrow>One of those decisions</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#20151c] md:text-4xl">
              What it looks like to decide
            </h2>
          </div>
          <div className="flex justify-center">
            <PhoneVideo src="/video/telegram_meeting_reminder.mp4" width={448} height={848} className="w-full max-w-[260px]" />
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-[88rem]">
          <div className="mb-14 text-center">
            <Eyebrow>The flow</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#20151c] [text-wrap:balance] md:text-4xl">
              From drafted to decided
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {stages.map((stage) => (
              <div key={stage.step} className="flex flex-col gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#20151c] font-mono text-sm text-white">
                  {stage.step}
                </span>
                <div>
                  <h3 className="text-lg font-normal text-[#20151c]">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{stage.detail}</p>
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
            <Eyebrow>Every meeting change</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#20151c] md:text-4xl">
              Reschedules land here before they land on you
            </h2>
          </div>
          <ScreenshotPanel
            src="/images/meetings.png"
            width={1583}
            height={833}
            alt="Rizly dashboard meetings view"
            caption="The meetings view in your Rizly dashboard"
          />
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-[88rem]">
          <div className="mb-14 text-center">
            <Eyebrow>Who it&apos;s for</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#20151c] [text-wrap:balance] md:text-4xl">
              Built for people who don&apos;t want surprises
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {audiences.map((audience) => (
              <div key={audience.title} className="rounded-2xl bg-[#f7f7f6] p-8">
                <h3 className="mb-3 text-lg font-normal text-[#20151c]">{audience.title}</h3>
                <p className="text-sm leading-6 text-gray-600">{audience.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 text-center md:px-10 lg:px-14">
        <div className="mx-auto max-w-2xl">
          <Eyebrow>Why it&apos;s safe by design</Eyebrow>
          <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#20151c] [text-wrap:balance] md:text-4xl">
            Approval isn&apos;t a setting, it&apos;s the default
          </h2>
          <p className="mt-6 text-sm leading-6 text-gray-600 md:text-base">
            Rizly was built approval-first from day one, not bolted on after the fact. Every integration respects the
            same rule: draft, wait, confirm.
          </p>
          <a href="/trust" className="mt-6 inline-block text-sm text-gray-600 underline underline-offset-4 transition hover:text-[#20151c]">
            See how trust works &rarr;
          </a>
        </div>
      </section>

      <Testimonial
        quote="I was nervous about connecting my inbox to an AI. The approval step is what made it actually feel safe to try."
        author="Early access founder"
      />

      {/* FAQ */}
      <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-3xl font-normal leading-tight tracking-tight text-[#20151c] md:text-4xl">
            Common questions
          </h2>
          <FaqAccordion items={questions} />
        </div>
      </section>

      <ProductCta title="Try approval-first automation" />
    </main>
  );
}
