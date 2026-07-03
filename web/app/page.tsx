import type { Metadata } from 'next';
import { Hero } from './components/Hero';
import { AtAGlance } from './components/sections/AtAGlance';
import { IntegrationsStrip } from './components/sections/IntegrationsStrip';
import { ShowcaseBrutalist } from './components/sections/ShowcaseBrutalist';
import { FeatureBento } from './components/sections/FeatureBento';
import { DayInLife } from './components/sections/DayInLife';
import { Capabilities } from './components/sections/Capabilities';
import { HowItWorks } from './components/sections/HowItWorks';
import { Trust } from './components/sections/Trust';
import { Pricing } from './components/sections/Pricing';
import { Faq } from './components/sections/Faq';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "rizly",
  url: SITE_URL,
  logo: `${SITE_URL}/rizly.png`,
  description:
    "rizly is a proactive AI operator for founders that monitors inbox, calendar, and business tools inside Telegram.",
  sameAs: [],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "rizly",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "rizly",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Telegram",
  description:
    "A proactive AI operator that monitors your inbox, calendar, Stripe, and business tools, and surfaces decisions in Telegram with your approval.",
  url: SITE_URL,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free trial available",
  },
  featureList: [
    "Email triage and draft generation",
    "Calendar conflict detection",
    "Telegram-based approval flow",
    "Stripe and Razorpay monitoring",
    "Daily AI brief",
    "Vector memory across conversations",
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does Riz send anything without asking me first?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Every draft and action waits for your approval in Telegram, unless you have explicitly turned on auto-act for that category in your preferences.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if I don't connect Telegram?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Gmail and Calendar still get triaged in the background, but you won't get real-time approve or reject prompts. You'd need to check the dashboard instead of a chat message.",
      },
    },
    {
      "@type": "Question",
      name: "Which business tools can rizly watch?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stripe, Razorpay, PostgreSQL, and MongoDB today. Connect one and Riz can fold revenue and signals into your daily brief.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if I go over my AI budget?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You get a warning at 80% of your plan's budget. At 100%, background features pause and chat switches to a lighter model. No surprise overage charges.",
      },
    },
    {
      "@type": "Question",
      name: "Can I cancel rizly anytime?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Cancelling takes effect immediately with no lock-in.",
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="flex flex-1 flex-col bg-white">
        <Hero />
        <AtAGlance />
        <IntegrationsStrip />
        <ShowcaseBrutalist />
        <FeatureBento />
        <DayInLife />
        <Capabilities />
        <HowItWorks />
        <Trust />
        <Pricing />
        <Faq />
      </div>
    </>
  );
}
