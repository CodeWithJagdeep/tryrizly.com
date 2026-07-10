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
import { HeroWorkflowTabs } from "./components/home/HeroWorkflowTabs";
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

const loopSteps = [
  {
    title: "Watch",
    body: "Unread email, calendar movement, payment events, and open follow-ups land in one operator context.",
  },
  {
    title: "Reason",
    body: "Riz classifies threads, checks conflicts, recalls your preferences, and queries read-only data.",
  },
  {
    title: "Ask",
    body: "You get one short Telegram message with the decision framed. Approve, edit, or reject.",
  },
  {
    title: "Execute",
    body: "Only after your yes does the reply send, the event save, or the reminder schedule.",
  },
];

const capabilityGroups = [
  {
    title: "Inbox that triages itself",
    body: "Riz reads new mail, separates noise from signal, and drafts replies in your tone. Nothing sends without approval.",
    tools: ["gmail_triage", "draft_email_reply", "send_email", "watch_for_reply"],
    Icon: GmailIcon,
    tone: "light" as const,
    span: "wide" as const,
  },
  {
    title: "Calendar that defends itself",
    body: "Briefings before meetings, conflicts caught before they bite, events created and rescheduled with your sign-off.",
    tools: ["calendar_briefing", "check_calendar_conflict", "create_calendar_event", "reschedule_calendar_event"],
    Icon: CalendarIcon,
    tone: "dark" as const,
    span: "wide" as const,
  },
  {
    title: "Business answers in plain English",
    body: "Ask about MRR, failed payments, or signups. Riz queries Stripe, Razorpay, Postgres, and MongoDB read-only.",
    tools: ["business_snapshot"],
    Icon: StripeIcon,
    tone: "tint" as const,
    span: "narrow" as const,
  },
  {
    title: "Memory that compounds",
    body: "Preferences, people, and recurring facts persist. Riz recalls them before it drafts or schedules anything.",
    tools: ["remember_fact", "memory_recall", "lookup_contact"],
    Icon: CustomApiIcon,
    tone: "light" as const,
    span: "narrow" as const,
  },
  {
    title: "Reminders and bookings",
    body: "Meeting reminders 30 minutes out, scheduled nudges, and Cal.com bookings handled from chat.",
    tools: ["schedule_reminder", "calcom_book", "create_task"],
    Icon: CalComIcon,
    tone: "light" as const,
    span: "narrow" as const,
  },
];

const dashboardPages = [
  "Chat",
  "Approvals",
  "Emails",
  "People",
  "Calendar",
  "Connectors",
  "Scheduled",
  "Telegram",
  "Usage",
  "Settings",
];

const controlPoints = [
  {
    title: "Approval before writes",
    body: "Outbound email, calendar events, and reschedules pause until you explicitly say yes in Telegram or the dashboard.",
  },
  {
    title: "Read-only data access",
    body: "Stripe, Razorpay, Postgres, and MongoDB connections answer questions. They never mutate a record.",
  },
  {
    title: "Live-fetch, not hoarding",
    body: "Sensitive Gmail and Calendar content is fetched when needed instead of being copied and stored.",
  },
  {
    title: "Setup stays in the dashboard",
    body: "Connectors, credentials, and permissions are managed in one place, never through chat prompts.",
  },
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
        <Capabilities />
        <TelegramDay />
        <DashboardSection />
        <ControlSection />
        <FinalCta />
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
      <div className="absolute inset-0 bg-[linear-gradient(rgba(32,21,28,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(32,21,28,0.045)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute left-0 top-0 h-full w-28 bg-[linear-gradient(90deg,#ffffff_0%,rgba(255,255,255,0)_100%)]" />
      <div className="absolute right-0 top-0 h-full w-28 bg-[linear-gradient(270deg,#ffffff_0%,rgba(255,255,255,0)_100%)]" />
      <div className="absolute left-1/2 top-0 h-full w-px bg-black/[0.04]" />
      <div className="absolute left-[12%] top-20 hidden h-36 w-px rotate-[-18deg] bg-black/10 md:block" />
      <div className="absolute right-[14%] top-28 hidden h-44 w-px rotate-[18deg] bg-black/10 md:block" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-6 pb-0 pt-20 text-center md:px-10 lg:px-14 lg:pt-24">
        <span className="mb-6 text-[11px] font-normal uppercase tracking-[0.18em] text-gray-500">
          AI operations, governed
        </span>

        <h1 className="max-w-4xl text-4xl font-normal leading-[1.08] tracking-tight text-[#20151c] [text-wrap:balance] md:text-5xl lg:text-[3.85rem]">
          Your day, your rules, all from one Telegram thread.
        </h1>

        <p className="mt-6 max-w-2xl text-sm leading-6 text-gray-600 md:text-base">
          Rizly gives founders and operators one place to watch work signals, prepare decisions, and approve sensitive actions from Telegram.
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

        <div className="relative mt-12 w-full max-w-4xl overflow-hidden rounded-t-xl border-x border-t border-black/10 bg-[#f3f0ed] px-5 pb-0 pt-8 shadow-[0_35px_100px_-70px_rgba(32,21,28,0.95)] md:px-12 md:pt-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,transparent_0%,#ff4f00_45%,#ff4f00_55%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0)_45%)]" />
          <div className="relative">
          <div className="mx-auto max-w-xl">
            <span className="text-[11px] font-normal uppercase tracking-[0.18em] text-gray-500">
              For operators
            </span>
            <h2 className="mt-4 text-xl font-normal tracking-tight text-[#20151c] md:text-2xl">
              Get started in minutes
            </h2>
          </div>

          <HeroWorkflowTabs />
          </div>
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

/* ------------------------------------------------------------------ */
/* The operating loop: gapless 4-cell strip                            */
/* ------------------------------------------------------------------ */

function loopCellBorders(index: number) {
  // 1 col: top border on all but first. 2 col (md): left on odd, top on row 2. 4 col (lg): left on all but first.
  const classes = [
    "border-t-0 md:border-t-0 lg:border-l-0",
    "border-t-2 md:border-t-0 md:border-l-2 lg:border-l-2",
    "border-t-2 md:border-t-2 md:border-l-0 lg:border-t-0 lg:border-l-2",
    "border-t-2 md:border-t-2 md:border-l-2 lg:border-t-0 lg:border-l-2",
  ];
  return classes[index] ?? "";
}

function OperatingLoop() {
  return (
    <section className="border-b-2 border-black/10 bg-white px-6 py-24 md:px-10 lg:px-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-2xl">
          <span className="mb-4 block text-[13px] font-semibold uppercase tracking-[0.4em] text-gray-500">
            How it operates
          </span>
          <h2 className="text-3xl font-semibold leading-tight md:text-4xl">
            Not another chat box. A governed work loop.
          </h2>
        </div>

        <div className="grid grid-cols-1 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:grid-cols-2 lg:grid-cols-4">
          {loopSteps.map((step, index) => (
            <div
              key={step.title}
              className={`border-black p-8 ${index === 2 ? "bg-gray-50" : "bg-white"} ${loopCellBorders(index)}`}
            >
              <span className="mb-6 flex h-10 w-10 items-center justify-center border-2 border-black bg-black font-mono text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mb-3 text-lg font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Capabilities bento, grounded in the real ai-core tool registry      */
/* ------------------------------------------------------------------ */

function ToolChip({ name, dark = false }: { name: string; dark?: boolean }) {
  return (
    <span
      className={`px-2 py-1 font-mono text-[11px] font-medium ${
        dark ? "bg-white/10 text-white/80" : "bg-black/[0.05] text-gray-600"
      }`}
    >
      {name}
    </span>
  );
}

function Capabilities() {
  const wide = capabilityGroups.filter((g) => g.span === "wide");
  const narrow = capabilityGroups.filter((g) => g.span === "narrow");

  return (
    <section className="border-b-2 border-black/10 bg-[#fcfcfc] px-6 py-24 md:px-10 lg:px-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-2xl">
          <h2 className="mb-4 text-3xl font-semibold leading-tight md:text-4xl">
            Every card below is a tool that ships today
          </h2>
          <p className="text-lg leading-relaxed text-gray-500">
            These map one-to-one to the tools registered in the Rizly AI core, not a roadmap.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {wide.map((group) => (
            <article
              key={group.title}
              className={`border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${
                group.tone === "dark" ? "bg-black text-white" : "bg-white"
              }`}
            >
              <div
                className={`mb-6 flex h-12 w-12 items-center justify-center border-2 ${
                  group.tone === "dark" ? "border-white/30 bg-white" : "border-black bg-white"
                }`}
              >
                <group.Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">{group.title}</h3>
              <p className={`mb-6 text-sm leading-relaxed ${group.tone === "dark" ? "text-white/60" : "text-gray-500"}`}>
                {group.body}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.tools.map((tool) => (
                  <ToolChip key={tool} name={tool} dark={group.tone === "dark"} />
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {narrow.map((group) => (
            <article
              key={group.title}
              className={`border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${
                group.tone === "tint" ? "bg-gray-50" : "bg-white"
              }`}
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center border-2 border-black bg-white">
                <group.Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-lg font-semibold">{group.title}</h3>
              <p className="mb-6 text-sm leading-relaxed text-gray-500">{group.body}</p>
              <div className="flex flex-wrap gap-2">
                {group.tools.map((tool) => (
                  <ToolChip key={tool} name={tool} />
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* A day with Rizly on Telegram: three real proactive moments          */
/* ------------------------------------------------------------------ */

function TelegramDay() {
  return (
    <section className="border-b-2 border-black/10 bg-white px-6 py-24 md:px-10 lg:px-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 text-center">
          <span className="mb-4 block text-[13px] font-semibold uppercase tracking-[0.4em] text-gray-500">
            A day on Telegram
          </span>
          <h2 className="text-3xl font-semibold leading-tight md:text-4xl">
            Rizly reaches you before the work slips
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <TelegramMoment
            time="7:30 AM"
            label="Morning brief"
            message="Good morning. 2 meetings, 4 unread threads worth your time, and MRR moved up 2.1% overnight."
          />
          <TelegramMoment
            time="1:30 PM"
            label="Meeting reminder"
            message="Your call with Priya starts in 30 minutes. Here is the thread context and the one open question from last time."
          />
          <TelegramMoment
            time="4:12 PM"
            label="Approval prompt"
            message="Markus confirmed the term sheet. Reply is drafted with your ARR summary attached. Send it?"
            actions
          />
        </div>
      </div>
    </section>
  );
}

function TelegramMoment({
  time,
  label,
  message,
  actions = false,
}: {
  time: string;
  label: string;
  message: string;
  actions?: boolean;
}) {
  return (
    <article className="flex flex-col border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center justify-between border-b-2 border-black bg-black/[0.02] px-5 py-3">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="font-mono text-xs font-semibold uppercase tracking-widest text-gray-400">{time}</span>
      </div>
      <div className="flex flex-1 flex-col px-5 py-5">
        <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 text-sm leading-relaxed text-black">
          {message}
        </div>
        {actions ? (
          <div className="mt-4 flex gap-2">
            <span className="border-2 border-black bg-black px-4 py-1.5 text-xs font-semibold text-white">Yes, send</span>
            <span className="border-2 border-black bg-white px-4 py-1.5 text-xs font-semibold text-black">Edit first</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard: the control room behind Telegram                         */
/* ------------------------------------------------------------------ */

function DashboardSection() {
  return (
    <section className="border-b-2 border-black/10 bg-[#fcfcfc] px-6 py-24 md:px-10 lg:px-14">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <h2 className="mb-6 text-3xl font-semibold leading-tight md:text-4xl">
            Telegram decides. The dashboard controls.
          </h2>
          <p className="mb-8 max-w-lg text-lg leading-relaxed text-gray-500">
            Connect tools, review pending approvals, inspect triaged email, manage people and reminders, and chat with Riz when you want the full screen.
          </p>
          <div className="flex flex-wrap gap-2">
            {dashboardPages.map((page) => (
              <span key={page} className="border-2 border-black bg-white px-3 py-1.5 text-[13px] font-semibold">
                {page}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-hidden border-2 border-black bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between border-b-2 border-black bg-black/[0.02] px-5 py-3">
            <span className="text-[13px] font-semibold">Rizly dashboard</span>
            <span className="border-2 border-black bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
              Approvals
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr]">
            <aside className="hidden border-r-2 border-black bg-[#fcfcfc] p-4 sm:block">
              <div className="space-y-1">
                {dashboardPages.slice(0, 8).map((page, index) => (
                  <div
                    key={page}
                    className={`px-3 py-2 text-[13px] ${
                      index === 1 ? "border-2 border-black bg-gray-100 font-semibold" : "text-gray-500"
                    }`}
                  >
                    {page}
                  </div>
                ))}
              </div>
            </aside>
            <div className="space-y-4 p-6">
              <DashboardApproval
                title="Send Gmail reply"
                detail="Reply to Markus with the updated ARR summary and the Friday closing note."
              />
              <DashboardApproval
                title="Reschedule calendar event"
                detail="Move the sprint review to 2 PM today. No conflicts found for either attendee."
              />
              <DashboardApproval
                title="Schedule reminder"
                detail="Nudge you 30 minutes before tomorrow's investor call with the thread summary."
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardApproval({ title, detail }: { title: string; detail: string }) {
  return (
    <article className="border-2 border-black bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <span className="bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-gray-600">
          pending
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-gray-500">{detail}</p>
      <div className="flex gap-2">
        <span className="border-2 border-black bg-black px-3 py-1 text-xs font-semibold text-white">Approve</span>
        <span className="border-2 border-black bg-white px-3 py-1 text-xs font-semibold">Reject</span>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Control and trust                                                   */
/* ------------------------------------------------------------------ */

function ControlSection() {
  return (
    <section className="border-b-2 border-black/10 bg-white px-6 py-24 md:px-10 lg:px-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-2xl">
          <h2 className="mb-4 text-3xl font-semibold leading-tight md:text-4xl">
            Automation with a hand brake
          </h2>
          <p className="text-lg leading-relaxed text-gray-500">
            Rizly is strict exactly where AI needs discipline: writes, data access, and credentials.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {controlPoints.map((point) => (
            <article key={point.title} className="flex gap-5 border-2 border-black bg-[#fcfcfc] p-7">
              <span className="mt-1 h-4 w-4 shrink-0 border-2 border-black bg-gray-300" />
              <div>
                <h3 className="mb-2 text-lg font-semibold">{point.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{point.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="bg-black px-6 py-28 text-center text-white md:px-10 lg:px-14">
      <h2 className="mx-auto mb-6 max-w-3xl text-3xl font-semibold leading-tight md:text-4xl">
        Connect Gmail and Telegram. Get your first brief tomorrow morning.
      </h2>
      <p className="mx-auto mb-10 max-w-md text-white/40">
        Under a minute to connect. Add payments, databases, and scheduling whenever you need more coverage.
      </p>
      <Link
        href="/signup"
        className="inline-flex items-center gap-2 border-2 border-white bg-[linear-gradient(135deg,#ffffff_0%,#e5e7eb_100%)] px-8 py-4 text-base font-normal text-black shadow-[6px_6px_0px_0px_rgba(255,255,255,0.15)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
      >
        Start free trial
      </Link>
    </section>
  );
}
