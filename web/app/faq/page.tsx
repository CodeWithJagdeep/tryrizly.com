import type { Metadata } from "next";
import { Eyebrow } from "../components/product/Eyebrow";
import { HeroGlow } from "../components/product/HeroGlow";
import { FaqClient, type FaqCategory } from "./faq-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers on setup, approvals, integrations, billing, and data security for Rizly — the approval-first AI operator.",
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: "FAQ",
    description: "Answers on setup, approvals, integrations, billing, and data security for Rizly.",
    url: `${SITE_URL}/faq`,
    type: "website",
  },
};

const categories: FaqCategory[] = [
  {
    name: "Getting started",
    items: [
      {
        q: "What do I need to get started?",
        a: "A Google account and about five minutes. Sign in, connect Gmail and Calendar, link Telegram from the QR code, and Riz starts triaging. Your first morning brief lands the next day.",
      },
      {
        q: "How does the free trial work?",
        a: "Every new account gets 10 days of the full product — every feature, every connector, no credit card. If you don't subscribe when it ends, you drop to limited background access rather than losing your account.",
      },
      {
        q: "Do I have to use Telegram?",
        a: "It's where Rizly works best: reminders, morning briefs, and approvals are delivered there, and you can reply to act. Without it, Gmail and Calendar still get triaged and notifications fall back to email — but approvals wait for you in the dashboard instead of a chat.",
      },
      {
        q: "Does Riz work in my timezone?",
        a: "Yes. Your saved timezone drives the morning brief, reminders, and calendar handling — briefs arrive in your morning, not a global UTC hour.",
      },
    ],
  },
  {
    name: "Approvals & control",
    items: [
      {
        q: "Does Riz send anything without asking me first?",
        a: "No. Every draft and action waits for your approval in Telegram, unless you've explicitly turned on auto-act for that category in your preferences.",
      },
      {
        q: "What can Riz actually do once I approve?",
        a: "Send the drafted email, create or move calendar events, set reminders and follow-ups, and log decisions. Each approval covers that one action — approving a draft never authorizes anything else.",
      },
      {
        q: "Can I see a record of what it did?",
        a: "Yes. The dashboard keeps a notification log and a decision log, so you can audit every message sent and every rule Riz applied — nothing happens off the books.",
      },
      {
        q: "Can I turn on automatic behavior?",
        a: "Per category, and only explicitly. For example, you can tell Riz to always archive newsletters — that rule is logged, visible, and reversible at any time.",
      },
    ],
  },
  {
    name: "Integrations",
    items: [
      {
        q: "What does Rizly connect to?",
        a: "Gmail, Google Calendar, and Telegram as standard connectors, plus Stripe, Razorpay, PostgreSQL, and MongoDB for business data on Pro and Business plans.",
      },
      {
        q: "What does connecting a business tool get me?",
        a: "Riz folds revenue movement, failed payments, and renewal risk into your daily brief, and can draft the follow-up when a payment lapses or a client goes quiet.",
      },
      {
        q: "Can I disconnect something later?",
        a: "Anytime, from the dashboard. Disconnecting stops access immediately and deletes the stored credentials for that connector. You can also revoke access from the provider's own security settings.",
      },
    ],
  },
  {
    name: "Billing & plans",
    items: [
      {
        q: "What do the plans cost?",
        a: "Starter is $20/month (just $10 for your first month), Pro is $49/month, and Business is $100/month — all billed monthly in USD through Razorpay, all starting with a 10-day free trial. Need more AI credits than your plan includes? Top up any time.",
      },
      {
        q: "What happens if I go over my AI budget?",
        a: "You get a warning at 80% of your plan's monthly allowance. At 100%, background features (decisions, memory, the daily brief) pause and chat switches to a lighter model. There are never surprise overage charges.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes, from the dashboard, with no lock-in. Cancellation takes effect at the end of the current billing period, so you keep access to everything you paid for.",
      },
      {
        q: "What happens to my account if I stop paying?",
        a: "You move to the Free plan. Your data, connectors, and history stay intact — background AI features pause until you resubscribe.",
      },
    ],
  },
  {
    name: "Data & security",
    items: [
      {
        q: "Is my data used to train AI models?",
        a: "No. Your content is processed only to run the product for you, under agreements that prohibit our AI providers from training on it. We don't sell data and we don't show ads.",
      },
      {
        q: "How are my Google credentials stored?",
        a: "OAuth tokens are encrypted at rest and used only server-side to make the API calls you authorized. Rizly's use of Google user data follows Google's Limited Use policy.",
      },
      {
        q: "Can I delete my data?",
        a: "Yes. Disconnecting a connector deletes its credentials immediately, and deleting your account removes or anonymizes your personal data within 30 days. You can also request an export at hello@getrizly.com.",
      },
      {
        q: "Where can I read the details?",
        a: "The Privacy Policy covers data handling, the Security Policy covers vulnerability reporting, and the Trust Center summarizes both — all linked in the footer.",
      },
    ],
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: categories.flatMap((category) =>
    category.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  ),
};

export default function FaqPage() {
  return (
    <main className="bg-white text-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <section className="relative overflow-hidden border-b border-black/10 bg-white">
        <HeroGlow />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-28 text-center md:px-10">
          <Eyebrow>FAQ</Eyebrow>
          <h1 className="max-w-2xl text-4xl font-normal leading-[1.08] tracking-tight text-[#233D4D] [text-wrap:balance] md:text-5xl">
            Answers on setup, <span className="text-[#D9BEF4]">billing, and control</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-gray-600 md:text-base">
            Everything you&apos;d ask before connecting your inbox, calendar, and revenue to an AI operator,{" "}
            {categories.reduce((n, c) => n + c.items.length, 0)} questions, straight answers.
          </p>
        </div>
      </section>

      <FaqClient categories={categories} />
    </main>
  );
}
