import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AirtableIcon,
  CalendarIcon,
  CalComIcon,
  CustomApiIcon,
  DiscordIcon,
  GitHubIcon,
  GmailIcon,
  GoogleDocsIcon,
  GoogleDriveIcon,
  GoogleSheetsIcon,
  MongoDbIcon,
  NotionIcon,
  PayPalIcon,
  PostgresIcon,
  RazorpayIcon,
  SlackIcon,
  StripeIcon,
  TelegramIcon,
} from "./components/ConnectorIcons";
import { ConnectorLogo } from "./components/ConnectorLogo";
import { BuildSection } from "./components/home/BuildSection";
import { NotifySection } from "./components/home/NotifySection";
import { DashboardSection } from "./components/home/DashboardSection";
import { IntegrationsSection } from "./components/home/IntegrationsSection";
import { FlowBuilderSection } from "./components/home/FlowBuilderSection";
import { PricingSection } from "./components/home/PricingSection";
import { FinalCtaSection } from "./components/home/FinalCtaSection";
import { HeroOperatorCanvas } from "./components/home/HeroOperatorCanvas";
import { SpeedSection } from "./components/home/SpeedSection";

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

const heroConnectors: Array<{ name: string; provider: string; Icon?: IconComponent }> = [
  { name: "Telegram", provider: "telegram", Icon: TelegramIcon },
  { name: "Gmail", provider: "gmail", Icon: GmailIcon },
  { name: "Google Calendar", provider: "calendar", Icon: CalendarIcon },
  { name: "Slack", provider: "slack" },
  { name: "Stripe", provider: "stripe", Icon: StripeIcon },
  { name: "Razorpay", provider: "razorpay", Icon: RazorpayIcon },
  { name: "Postgres", provider: "postgres", Icon: PostgresIcon },
  { name: "MongoDB", provider: "mongodb", Icon: MongoDbIcon },
  { name: "Cal.com", provider: "calcom", Icon: CalComIcon },
  { name: "Notion", provider: "notion", Icon: NotionIcon },
  { name: "GitHub", provider: "github" },
  { name: "Discord", provider: "discord", Icon: DiscordIcon },
  { name: "PayPal", provider: "paypal", Icon: PayPalIcon },
  { name: "Google Drive", provider: "google_workspace", Icon: GoogleDriveIcon },
  { name: "Google Sheets", provider: "google_workspace", Icon: GoogleSheetsIcon },
  { name: "Google Docs", provider: "google_workspace", Icon: GoogleDocsIcon },
  { name: "Custom APIs", provider: "custom_api", Icon: CustomApiIcon },
];

function DarkHomeStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          .home-dark {
            background: #000000;
            color: #EAECF0;
            font-family: var(--font-outfit), var(--font-rethink-sans), sans-serif;
            font-weight: 400;
          }
          .home-dark :where(h1, h2, h3, h4, h5, h6, p, span, a, button, label, strong, b) {
            font-weight: 400 !important;
          }
          .home-dark .font-bold {
            font-weight: 700 !important;
          }
          .home-dark > section:not(:first-child) {
            background: #000000 !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
          }
          .home-dark > section:not(:first-child) section {
            background-color: transparent !important;
          }
          .home-dark > section:not(:first-child) h2,
          .home-dark > section:not(:first-child) h3,
          .home-dark > section:not(:first-child) [class*="text-[#233D4D]"] {
            color: #EAECF0 !important;
          }
          .home-dark > section:not(:first-child) p,
          .home-dark > section:not(:first-child) [class*="text-gray-5"],
          .home-dark > section:not(:first-child) [class*="text-gray-6"] {
            color: rgba(245, 243, 238, 0.62) !important;
          }
          .home-dark section .morning-brief-card p {
            color: rgba(0, 0, 0, 0.7) !important;
          }
          .home-dark > section:not(:first-child) [class*="border-black"],
          .home-dark > section:not(:first-child) [class*="divide-black"] {
            border-color: rgba(255, 255, 255, 0.1) !important;
          }
          .home-dark > section:not(:first-child) [class*="bg-white"],
          .home-dark > section:not(:first-child) [class*="bg-[#fcfcfc]"],
          .home-dark > section:not(:first-child) [class*="bg-[#f7f7f6]"] {
            background-color: #ffffff !important;
          }
          .home-dark > section:not(:first-child) [class*="bg-[#233D4D]"] {
            background-color: #233D4D !important;
          }
          .home-dark [data-index] {
            border-color: rgba(255, 255, 255, 0.12) !important;
          }
          .home-dark [data-index] h3,
          .home-dark [data-index] a {
            color: #EAECF0 !important;
          }
          .home-dark [data-index] p {
            color: rgba(245, 243, 238, 0.58) !important;
          }
          @keyframes automation-pulse {
            0% { transform: translateY(-100%); opacity: 0; }
            35% { opacity: 1; }
            100% { transform: translateY(200%); opacity: 0; }
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
      <DarkHomeStyles />
      <JsonLd />
      <main className="home-dark bg-[#000000] text-[#EAECF0]">
        <Hero />
        <SpeedSection />
        <BuildSection />
        <NotifySection />
        <DashboardSection />
        <IntegrationsSection />
        <FlowBuilderSection />
        <PricingSection />
        <FinalCtaSection />
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Hero: cinematic approval-first workflow                            */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="px-3 pb-4 pt-0 sm:px-4">
      <div className="relative mx-auto flex w-full max-w-[88rem] flex-col overflow-hidden rounded-[16px] border border-black/10 bg-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[url('/images/heros/rizly-dawn-hero.webp')] bg-cover bg-center opacity-100"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0.15)_35%,transparent_65%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(35,61,77,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(35,61,77,0.07)_1px,transparent_1px)] [background-size:72px_72px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[-18rem] h-[50rem] w-[75rem] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(217,190,244,0.34),rgba(217,190,244,0.08)_42%,transparent_72%)]"
        />

        <div className="relative z-10 mx-auto flex w-full max-w-[88rem] flex-col items-center px-5 pb-16 pt-24 text-center sm:px-8 sm:pb-20 sm:pt-28 lg:px-12 lg:pb-24 lg:pt-32">
          <h1 className="rizly-hero-title max-w-[1080px] text-4xl font-normal leading-[1.05] tracking-[-0.03em] text-black [text-wrap:balance] sm:text-5xl">
            Work, handled peacefully.
            <span className="block text-black">The operator that never drops the ball.</span>
          </h1>
          <p className="mt-8 max-w-[780px] text-lg font-normal leading-8 text-black sm:text-xl">
            One proactive operator for meetings, inboxes, and daily automations. It decides what matters, asks when needed, and reaches you in Slack, Telegram, or Discord.
          </p>
          <div className="mt-9 flex w-full max-w-[510px] flex-col justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-14 items-center justify-center rounded-md border border-black bg-black px-6 text-base font-normal text-white transition duration-200 hover:bg-[#1a1a1a] active:translate-y-px"
            >
              Start free
            </Link>
            <Link
              href="/product/ai-operator"
              className="inline-flex h-14 items-center justify-center rounded-md border border-black bg-transparent px-6 text-base font-normal text-black transition duration-200 hover:bg-black hover:text-white active:translate-y-px"
            >
              Explore the operator
            </Link>
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <div className="pb-16 pt-0 sm:pb-20 lg:pb-24">
            <HeroOperatorCanvas />
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-[88rem] flex-wrap items-center justify-center gap-x-8 gap-y-4 rounded-[16px] border border-black/10 bg-white px-6 py-5">
        <span className="text-sm font-normal text-black">Works with</span>
        {heroConnectors.map(({ name, provider, Icon }) => (
          <ConnectorLogo
            key={name}
            provider={provider}
            alt={name}
            className="h-6 w-6 object-contain transition-opacity duration-200 hover:opacity-80 sm:h-7 sm:w-7"
            fallback={Icon ? <Icon className="h-6 w-6 transition-opacity duration-200 hover:opacity-80 sm:h-7 sm:w-7" /> : null}
          />
        ))}
      </div>
    </section>
  );
}

