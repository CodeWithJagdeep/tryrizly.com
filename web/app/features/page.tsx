import type { Metadata } from "next";
import { Eyebrow } from "../components/product/Eyebrow";
import { HeroGlow } from "../components/product/HeroGlow";
import { ProductCta } from "../components/product/ProductCta";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "AI Email Triage, Calendar Briefings & Revenue Monitoring",
  description:
    "Rizly features: AI email triage for Gmail, calendar conflict detection, Stripe revenue monitoring, and approval-first actions in Telegram.",
  alternates: { canonical: `${SITE_URL}/features` },
  openGraph: {
    title: "AI Email Triage, Calendar Briefings & Revenue Monitoring",
    description: "Automate your operations with approval-first AI.",
    url: `${SITE_URL}/features`,
    type: "website",
  },
};

const features = [
  {
    title: "Smart email triage",
    description:
      "Never miss an important message again. Rizly learns what matters, classifies emails, and drafts summaries so you only see what needs your attention.",
    color: "#ff4f00",
    icon: (
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V6c0-1.1-.9-2-2-2z" />
    ),
  },
  {
    title: "Calendar intelligence",
    description:
      "Detect conflicts before they happen. Rizly monitors your calendar, flags double-bookings, and suggests optimal meeting times across timezones.",
    color: "#34A853",
    icon: (
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
    ),
  },
  {
    title: "Approval-first actions",
    description:
      "Nothing leaves your inbox without your say. Every draft, every approval, every action waits for you. You stay in control.",
    color: "#3B82F6",
    icon: (
      <path d="M12 2L20.2169 2.82598L20.2169 12C20.2169 16.0504 16.7569 19.5104 12.7065 19.5104C8.75585 19.5104 5.36535 16.1199 5.36535 12.169L5.36535 2.82598L12 2ZM7.34255 11.0273L5.5 9.18477L4.08578 10.599L7.34255 13.8557L15.9143 5.28393L14.5001 3.86972L7.34255 11.0273Z" />
    ),
  },
  {
    title: "Team coordination",
    description:
      "Keep your team in sync across timezones. Rizly surfaces decisions that need attention and routes them to the right people automatically.",
    color: "#A78BFA",
    icon: (
      <path d="M12 11C14.7614 11 17 13.2386 17 16V22H15V16C15 14.4023 13.7511 13.0963 12.1763 13.0051L12 13C10.4023 13 9.09634 14.2489 9.00509 15.8237L9 16V22H7V16C7 13.2386 9.23858 11 12 11ZM5.5 14C5.77885 14 6.05009 14.0326 6.3101 14.0942C6.14202 14.594 6.03873 15.122 6.00896 15.6693L6 16L6.0007 16.0856C5.88757 16.0456 5.76821 16.0187 5.64446 16.0069L5.5 16C4.7203 16 4.07955 16.5949 4.00687 17.3555L4 17.5V22H2V17.5C2 15.567 3.567 14 5.5 14ZM18.5 14C20.433 14 22 15.567 22 17.5V22H20V17.5C20 16.7203 19.4051 16.0796 18.6445 16.0069L18.5 16C18.3248 16 18.1566 16.03 18.0003 16.0852L18 16C18 15.3343 17.8916 14.694 17.6915 14.0956C17.9499 14.0326 18.2211 14 18.5 14ZM5.5 8C6.88071 8 8 9.11929 8 10.5C8 11.8807 6.88071 13 5.5 13C4.11929 13 3 11.8807 3 10.5C3 9.11929 4.11929 8 5.5 8ZM18.5 8C19.8807 8 21 9.11929 21 10.5C21 11.8807 19.8807 13 18.5 13C17.1193 13 16 11.8807 16 10.5C16 9.11929 17.1193 8 18.5 8ZM5.5 10C5.22386 10 5 10.2239 5 10.5C5 10.7761 5.22386 11 5.5 11C5.77614 11 6 10.7761 6 10.5C6 10.2239 5.77614 10 5.5 10ZM18.5 10C18.2239 10 18 10.2239 18 10.5C18 10.7761 18.2239 11 18.5 11C18.7761 11 19 10.7761 19 10.5C19 10.2239 18.7761 10 18.5 10ZM12 2C14.2091 2 16 3.79086 16 6C16 8.20914 14.2091 10 12 10C9.79086 10 8 8.20914 8 6C8 3.79086 9.79086 2 12 2ZM12 4C10.8954 4 10 4.89543 10 6C10 7.10457 10.8954 8 12 8C13.1046 8 14 7.10457 14 6C14 4.89543 13.1046 4 12 4Z" />
    ),
  },
  {
    title: "Revenue monitoring",
    description:
      "Watch your Stripe data in real-time. Get alerts on failed payments, churn signals, and revenue opportunities without manual checks.",
    color: "#EC4899",
    icon: (
      <path d="M12 1L20.2169 2.82598C20.6745 2.92766 21 3.33347 21 3.80217V13.7889C21 15.795 19.9974 17.6684 18.3282 18.7812L12 23L5.6718 18.7812C4.00261 17.6684 3 15.795 3 13.7889V3.80217C3 3.33347 3.32553 2.92766 3.78307 2.82598L12 1ZM12 3.04879L5 4.60434V13.7889C5 15.1263 5.6684 16.3752 6.7812 17.1171L12 20.5963L17.2188 17.1171C18.3316 16.3752 19 15.1263 19 13.7889V4.60434L12 3.04879ZM16.4524 8.22183L17.8666 9.63604L11.5026 16L7.25999 11.7574L8.67421 10.3431L11.5019 13.1709L16.4524 8.22183Z" />
    ),
  },
  {
    title: "Deep integrations",
    description:
      "Works with everything you use. Gmail, Calendar, Stripe, Postgres, Slack, Telegram, Rizly integrates seamlessly into your stack.",
    color: "#EAB308",
    icon: (
      <path d="M6 21.5C4.067 21.5 2.5 19.933 2.5 18C2.5 16.067 4.067 14.5 6 14.5C7.5852 14.5 8.92427 15.5539 9.35481 16.9992L15 16.9994V15L17 14.9994V9.24339L14.757 6.99938H9V9.00003H3V3.00003H9V4.99939H14.757L18 1.75739L22.2426 6.00003L19 9.24139V14.9994L21 15V21H15V18.9994L9.35499 19.0003C8.92464 20.4459 7.58543 21.5 6 21.5ZM6 16.5C5.17157 16.5 4.5 17.1716 4.5 18C4.5 18.8285 5.17157 19.5 6 19.5C6.82843 19.5 7.5 18.8285 7.5 18C7.5 17.1716 6.82843 16.5 6 16.5ZM19 17H17V19H19V17ZM18 4.58581L16.5858 6.00003L18 7.41424L19.4142 6.00003L18 4.58581ZM7 5.00003H5V7.00003H7V5.00003Z" />
    ),
  },
];

const stages = [
  {
    step: "01",
    title: "Monitor & learn",
    detail: "Rizly watches your inbox, calendar, and revenue streams in real-time, learning your patterns and priorities from day one.",
  },
  {
    step: "02",
    title: "Draft & suggest",
    detail: "When action is needed, Rizly drafts responses, suggests approvals, and prepares decisions. Everything is transparent and reviewable.",
  },
  {
    step: "03",
    title: "You decide & execute",
    detail: "You review, you approve, you decide. Rizly executes only what you've explicitly confirmed. You're always in control.",
  },
];

const security = [
  "AES-256 encrypted credentials",
  "Approval before every write",
  "Read-only data connections",
  "Live-fetch, not data hoarding",
];

export default function FeaturesPage() {
  return (
    <main className="bg-white text-black">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-black/10 bg-white">
        <HeroGlow />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-28 text-center md:px-10">
          <Eyebrow>Your AI operator</Eyebrow>
          <h1 className="max-w-2xl text-4xl font-normal leading-[1.08] tracking-tight text-[#20151c] [text-wrap:balance] md:text-5xl">
            Reclaim your <span className="text-[#ff4f00]">most valuable time</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-gray-600 md:text-base">
            Stop drowning in decisions. Let Rizly handle the noise while you focus on what matters. Every action
            waits for your approval.
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto grid max-w-[88rem] grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl bg-white p-8 shadow-[0_20px_60px_-48px_rgba(32,21,28,0.4)]">
              <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#f7f7f6]">
                <svg viewBox="0 0 24 24" fill={feature.color} className="h-5 w-5">
                  {feature.icon}
                </svg>
              </span>
              <h3 className="mb-3 text-lg font-normal text-[#20151c]">{feature.title}</h3>
              <p className="text-sm leading-6 text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-[88rem]">
          <div className="mb-14 text-center">
            <Eyebrow>The Rizly flow</Eyebrow>
            <h2 className="text-3xl font-normal leading-tight tracking-tight text-[#20151c] [text-wrap:balance] md:text-4xl">
              How Rizly operates
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

      {/* Security */}
      <section className="relative overflow-hidden bg-[#20151c] px-6 py-20 md:px-10 lg:px-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-[88rem] grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div>
            <Eyebrow light>Built for control</Eyebrow>
            <h2 className="max-w-lg text-3xl font-normal leading-tight tracking-tight text-white [text-wrap:balance] md:text-4xl">
              Security that matches the access you grant
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-6 text-white/50 md:text-base">
              You connect your inbox, calendar, and revenue tools. Rizly earns that with encrypted credentials,
              read-only data access, and approval before every write.
            </p>
            <ul className="mt-8 space-y-4">
              {security.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/80">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ff4f00]/15 text-[#ff4f00]">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-white/5 p-8">
            <div className="space-y-2 font-mono text-sm text-emerald-400/90">
              <p>&gt; initializing secure session...</p>
              <p className="text-white/30">&gt; connecting to approved integrations...</p>
              <p>&gt; processing approved actions only...</p>
              <p>&gt; monitoring for anomalies...</p>
              <p className="text-[#ff4f00]">&gt; SUCCESS: All approvals honored</p>
              <p className="text-white/30">&gt; cleaning sensitive data...</p>
              <p>&gt; session terminated securely.</p>
            </div>
          </div>
        </div>
      </section>

      <ProductCta title="Ready to reclaim your time?" ctaLabel="Start free trial" />
    </main>
  );
}
