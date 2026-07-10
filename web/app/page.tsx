import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarIcon,
  CalComIcon,
  CustomApiIcon,
  GmailIcon,
  MongoDbIcon,
  NotionIcon,
  PostgresIcon,
  RazorpayIcon,
  SlackIcon,
  StripeIcon,
  TelegramIcon,
} from "./components/ConnectorIcons";
import { AtAGlanceSection } from "./components/home/AtAGlanceSection";
import { CapabilitiesSection } from "./components/home/CapabilitiesSection";
import { FaqSection } from "./components/home/FaqSection";
import { FinalCtaSection } from "./components/home/FinalCtaSection";
import { HowItWorksSection } from "./components/home/HowItWorksSection";
import { PricingSection } from "./components/home/PricingSection";
import { TrustSection } from "./components/home/TrustSection";
import { UseCaseSection } from "./components/home/UseCaseSection";
import { WorkflowAreaPreview } from "./components/home/WorkflowAreaPreview";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Rizly",
  url: SITE_URL,
  logo: `${SITE_URL}/rizly.png`,
  description:
    "Rizly is a Telegram-first AI operator that watches work signals, prepares decisions, and asks before sensitive actions run.",
  sameAs: [],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Rizly",
  url: SITE_URL,
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Rizly",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Telegram",
  description:
    "A Telegram-first AI operator for Gmail triage, calendar briefings, reminders, database snapshots, payment signals, and approval-based execution.",
  url: SITE_URL,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free trial available",
  },
  featureList: [
    "Telegram-first morning brief",
    "One-tap approval flow",
    "Gmail triage and approved replies",
    "Calendar briefings, conflicts, and reschedules",
    "Read-only Stripe, Razorpay, Postgres, and MongoDB snapshots",
    "Dashboard chat, approvals, connectors, usage, and settings",
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Rizly?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Rizly is a Telegram-first AI operator. It watches Gmail, Calendar, reminders, payment tools, and databases, then turns important changes into short decisions.",
      },
    },
    {
      "@type": "Question",
      name: "Why is Telegram central to Rizly?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Telegram is where Rizly sends briefs, reminders, and approval prompts. The web dashboard is used for chat, setup, connectors, approvals, and review.",
      },
    },
    {
      "@type": "Question",
      name: "Does Rizly act without approval?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sensitive actions such as sending email, creating calendar events, or moving meetings require explicit approval before execution.",
      },
    },
  ],
};

type IconComponent = (props: { className?: string }) => ReactNode;

const connectorStack: Array<{ name: string; Icon: IconComponent }> = [
  { name: "Telegram", Icon: TelegramIcon },
  { name: "Gmail", Icon: GmailIcon },
  { name: "Google Calendar", Icon: CalendarIcon },
  { name: "Stripe", Icon: StripeIcon },
  { name: "Razorpay", Icon: RazorpayIcon },
  { name: "Postgres", Icon: PostgresIcon },
  { name: "MongoDB", Icon: MongoDbIcon },
  { name: "Cal.com", Icon: CalComIcon },
  { name: "Slack", Icon: SlackIcon },
  { name: "Notion", Icon: NotionIcon },
  { name: "Custom APIs", Icon: CustomApiIcon },
];

const heroMetrics = [
  { value: "10+", label: "Work apps connected" },
  { value: "0", label: "Sensitive actions without approval" },
  { value: "24/7", label: "Inbox, calendar, and revenue watch" },
];

const heroTrustSignals = ["Human-approved actions", "Read-only business data", "Telegram-first control"];

function HomeStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @keyframes rizly-marquee {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
          .rizly-marquee { animation: rizly-marquee 36s linear infinite; }
          @media (prefers-reduced-motion: reduce) {
            .rizly-marquee { animation: none !important; }
          }
        `,
      }}
    />
  );
}

function JsonLd() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </>
  );
}

export default function Home() {
  return (
    <>
      <HomeStyles />
      <JsonLd />
      <main className="bg-white text-black">
        <Hero />
        <StackStrip />
        <PersonalAiSection />
        <UseCaseSection />
        <AtAGlanceSection />
        <CapabilitiesSection />
        <HowItWorksSection />
        <TrustSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Hero: centered copy with live Telegram approval preview             */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-black/10 bg-white">
      <div className="absolute -top-16 right-[4%] h-[380px] w-[380px] rounded-full bg-[radial-gradient(closest-side,rgba(247,182,198,0.4),transparent_70%)] blur-3xl" />
      <div className="absolute top-28 left-[2%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(closest-side,rgba(255,217,206,0.45),transparent_70%)] blur-3xl" />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(32,21,28,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 65% 55% at 50% 0%, black 35%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 65% 55% at 50% 0%, black 35%, transparent 100%)",
        }}
      />

      <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#ffffff_100%)]" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-6 pb-0 pt-20 text-center md:px-10 lg:px-14 lg:pt-24">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#f7f7f6] px-4 py-1.5 text-[11px] font-normal uppercase tracking-[0.18em] text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff4f00]" />
          The AI operator that asks before it acts
        </span>

        <h1 className="max-w-4xl text-4xl font-normal leading-[1.08] tracking-tight text-[#20151c] [text-wrap:balance] md:text-5xl lg:text-[3.85rem]">
          Nothing slips through your day again.
        </h1>

        <p className="mt-6 max-w-2xl text-sm leading-6 text-gray-600 md:text-base">
          Rizly watches your inbox, calendar, and revenue, drafts the next move, and waits for your yes, all from one Telegram thread.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-md bg-[#ff4f00] px-6 text-base font-normal text-white shadow-[0_14px_30px_-18px_rgba(255,79,0,0.9)] transition hover:translate-y-[-1px] hover:bg-[#e94700] hover:shadow-[0_18px_36px_-18px_rgba(255,79,0,0.95)]"
          >
            Start free trial
          </Link>
          <Link
            href="/product/ai-operator"
            className="inline-flex h-11 items-center justify-center rounded-md border border-black/70 bg-white px-5 text-sm font-normal text-black transition hover:border-black hover:bg-black hover:text-white"
          >
            See the AI operator
          </Link>
        </div>

        <div className="mt-14 grid w-full max-w-4xl grid-cols-1 gap-0 overflow-hidden rounded-lg border border-black/10 bg-white/75 shadow-[0_24px_70px_-55px_rgba(32,21,28,0.8)] backdrop-blur md:grid-cols-3">
          {heroMetrics.map((metric) => (
            <div key={metric.label} className="border-b border-black/10 px-6 py-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <div className="text-2xl font-normal tracking-tight text-[#20151c]">{metric.value}</div>
              <div className="mt-2 text-xs leading-5 text-[#20151c]">{metric.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[11px] font-normal uppercase tracking-[0.08em] text-gray-500">
          {heroTrustSignals.map((signal) => (
            <span key={signal} className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              {signal}
            </span>
          ))}
        </div>

      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Connected stack marquee                                             */
/* ------------------------------------------------------------------ */

function StackStrip() {
  const row = [...connectorStack, ...connectorStack];
  return (
    <section className="py-12">
      <p className="mb-7 px-6 text-center text-sm font-normal text-gray-500">
        Connect the stack you already run. Telegram stays the control surface.
      </p>
      <div className="relative overflow-hidden">
        <div className="rizly-marquee flex w-max gap-8 px-2">
          {row.map(({ name, Icon }, index) => (
            <div
              key={`${name}-${index}`}
              className="flex items-center gap-2.5 px-1 py-2"
            >
              <Icon className="h-5 w-5" />
              <span className="whitespace-nowrap text-[13px] font-normal text-gray-600">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Personal AI workflow promise                                        */
/* ------------------------------------------------------------------ */

function PersonalAiSection() {
  return (
    <section className="px-6 py-20 md:px-10 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <span className="mb-5 block text-[11px] font-normal uppercase tracking-[0.18em] text-gray-500">
          Built around you
        </span>
        <h2 className="max-w-4xl text-3xl font-normal leading-tight tracking-tight text-[#20151c] [text-wrap:balance] md:text-5xl">
          Your work keeps moving, even when you are not in the dashboard.
        </h2>
        <p className="mt-6 max-w-2xl text-sm leading-6 text-gray-600 md:text-base">
          Rizly watches the places work actually happens, prepares the next step, and brings you only the moments that need a decision.
        </p>

        <div className="mt-14">
          <WorkflowAreaPreview />
        </div>
      </div>
    </section>
  );
}

