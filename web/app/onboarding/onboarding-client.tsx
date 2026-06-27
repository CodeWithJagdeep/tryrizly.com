"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarIcon,
  CustomApiIcon,
  GmailIcon,
  MongoDbIcon,
  PostgresIcon,
  RazorpayIcon,
  StripeIcon,
} from "../components/ConnectorIcons";

type OnboardingState = {
  source?: string;
  googleConnected?: boolean;
  telegramLinked?: boolean;
  completedAt?: string;
};

type ConnectorSummary = { provider: string; status: string };

type ConnectorField = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
};

type ConnectorItem = {
  provider: string;
  title: string;
  description: string;
  category: "Google" | "Payments" | "Databases" | "APIs";
  authType: "oauth" | "manual";
  icon: React.ComponentType<{ className?: string }>;
  fields?: ConnectorField[];
  prompts: string[];
  website?: string;
  privacy?: string;
};

const CONNECTOR_CATALOG: ConnectorItem[] = [
  {
    provider: "gmail",
    title: "Gmail",
    description:
      "HeyRiz watches your inbox, surfaces important emails, triages by priority, and drafts approved replies — all without you lifting a finger.",
    category: "Google",
    authType: "oauth",
    icon: GmailIcon,
    prompts: [
      "Find unread emails that need a reply and draft brief responses for each.",
      "Summarize investor and customer emails from this week.",
      "Which emails have payment or invoice details I should action?",
      "Flag any follow-ups I haven't replied to in the last 7 days.",
    ],
    website: "https://mail.google.com",
    privacy: "https://policies.google.com/privacy",
  },
  {
    provider: "calendar",
    title: "Google Calendar",
    description:
      "HeyRiz checks your calendar for conflicts, creates and reschedules events with your approval, and sends reminders before meetings.",
    category: "Google",
    authType: "oauth",
    icon: CalendarIcon,
    prompts: [
      "What's on my calendar today and tomorrow?",
      "Find a free 1-hour slot this week for a team sync.",
      "Move my 3pm meeting to tomorrow morning and notify the attendee.",
      "Create a calendar event for Tuesday at 10am with Naman.",
    ],
    website: "https://calendar.google.com",
    privacy: "https://policies.google.com/privacy",
  },
  {
    provider: "razorpay",
    title: "Razorpay",
    description:
      "Read-only revenue snapshots, failed payment alerts, and settlement checks — so you always know where your cash stands.",
    category: "Payments",
    authType: "manual",
    icon: RazorpayIcon,
    fields: [
      { name: "keyId", label: "Key ID", placeholder: "rzp_live_..." },
      { name: "keySecret", label: "Key Secret", type: "password" },
    ],
    prompts: [
      "What's my revenue this month vs last month?",
      "Show failed payments from the last 7 days.",
      "How much did we collect in settlements last week?",
      "List my top customers by payment amount.",
    ],
    website: "https://razorpay.com",
    privacy: "https://razorpay.com/privacy/",
  },
  {
    provider: "stripe",
    title: "Stripe",
    description:
      "Read-only subscription, MRR, invoices, and failed payment checks surfaced in your morning brief.",
    category: "Payments",
    authType: "manual",
    icon: StripeIcon,
    fields: [{ name: "secretKey", label: "Secret Key", type: "password" }],
    prompts: [
      "What's our current MRR and how has it changed this month?",
      "Show subscriptions that churned this week.",
      "List overdue invoices and their amounts.",
      "How many new paying customers did we add today?",
    ],
    website: "https://stripe.com",
    privacy: "https://stripe.com/privacy",
  },
  {
    provider: "postgres",
    title: "Postgres",
    description:
      "Read-only SQL queries against your production database for signups, errors, and business metrics — no raw SQL needed.",
    category: "Databases",
    authType: "manual",
    icon: PostgresIcon,
    fields: [
      {
        name: "connectionUrl",
        label: "Connection URL",
        type: "password",
        placeholder: "postgres://readonly:password@host:5432/db",
      },
    ],
    prompts: [
      "How many new users signed up today?",
      "Show error rates from the logs table over the last 24 hours.",
      "What's the daily active user count for the past 7 days?",
      "Find the top 10 users by session count this month.",
    ],
    website: "https://postgresql.org",
    privacy: "https://www.postgresql.org/about/policies/privacy/",
  },
  {
    provider: "mongodb",
    title: "MongoDB",
    description:
      "Read-only aggregate and find queries over your product database to surface metrics without writing a single query.",
    category: "Databases",
    authType: "manual",
    icon: MongoDbIcon,
    fields: [
      {
        name: "connectionUrl",
        label: "Connection URL",
        type: "password",
        placeholder: "mongodb+srv://readonly:password@cluster/db",
      },
    ],
    prompts: [
      "How many documents were created in the orders collection today?",
      "Show aggregate revenue by product category this month.",
      "Find users who haven't logged in for 30 days.",
      "What's the breakdown of users across plan types?",
    ],
    website: "https://mongodb.com",
    privacy: "https://www.mongodb.com/legal/privacy-policy",
  },
  {
    provider: "custom_api",
    title: "Custom API",
    description:
      "Point HeyRiz at your own backend endpoint to pull live metrics, product data, or any JSON response into the morning brief.",
    category: "APIs",
    authType: "manual",
    icon: CustomApiIcon,
    fields: [
      { name: "baseUrl", label: "Base URL", placeholder: "https://api.yourapp.com" },
      { name: "accessToken", label: "Access Token", type: "password" },
    ],
    prompts: [
      "What does our /metrics endpoint say about today's revenue?",
      "Fetch current system health from /status.",
      "Pull today's conversion rate from /analytics.",
      "Get the latest error count from /errors and alert me if it's high.",
    ],
  },
];

const CATEGORIES = ["Google", "Payments", "Databases", "APIs"] as const;

const SOURCE_OPTIONS = ["Twitter / X", "LinkedIn", "Friend or colleague", "Search", "Other"];

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Guatemala",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Lagos",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function getTimezoneOptions(current: string): string[] {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : FALLBACK_TIMEZONES;
  return supported.includes(current) ? supported : [current, ...supported];
}

// ── Chat bubble icon for example prompts ────────────────────────────────────
function PromptIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-white/35"
      aria-hidden="true"
    >
      <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </svg>
  );
}

// ── Arrow-up-right icon for links ────────────────────────────────────────────
function ExternalIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

// ── Unified connector dialog (OAuth + manual) ────────────────────────────────
function ConnectorDialog({
  connector,
  error,
  submitting,
  onClose,
  onManualSubmit,
}: {
  connector: ConnectorItem;
  error: string | null;
  submitting: boolean;
  onClose: () => void;
  onManualSubmit: (e: FormEvent<HTMLFormElement>, c: ConnectorItem) => Promise<void>;
}) {
  const Icon = connector.icon;
  const isOAuth = connector.authType === "oauth";
  const oauthHref = `/api/connectors/${connector.provider}/start?returnTo=/onboarding`;

  const dialogBody = (
    <div
      role="dialog"
      aria-modal="true"
      className="relative m-auto flex w-full max-w-[95%] flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0d0f14] shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8)] sm:w-[600px]"
    >
      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center gap-5 overflow-hidden px-8 pb-8 pt-10 text-center">
        {/* radial glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(255,255,255,0.18), transparent)",
          }}
        />
        {/* hairline shine */}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition hover:bg-white/10 hover:text-white/80"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        {/* icon */}
        <div className="flex size-[72px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-[0_0_40px_0_rgba(255,255,255,0.06)]">
          <Icon className="size-10" />
        </div>

        {/* title + description */}
        <div className="flex flex-col gap-2">
          <h2 className="text-[22px] font-semibold tracking-tight">{connector.title}</h2>
          <p className="mx-auto max-w-sm text-[13px] leading-6 text-white/50">
            {connector.description}
          </p>
        </div>

        {/* OAuth CTA — only for oauth type */}
        {isOAuth && (
          <a
            href={oauthHref}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#0d0f14] shadow-[0_2px_12px_0_rgba(255,255,255,0.15)] transition hover:opacity-90 active:scale-[0.98]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
            Connect {connector.title}
          </a>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 overflow-y-auto border-t border-white/[0.06] px-6 pb-7 pt-6">

        {/* Manual credentials form */}
        {!isOAuth && connector.fields && (
          <form onSubmit={(e) => void onManualSubmit(e, connector)}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/30">
              Credentials
            </p>

            {error && (
              <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3">
              {connector.fields.map((field) => (
                <label key={field.name} className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-white/55">{field.label}</span>
                  <input
                    name={field.name}
                    type={field.type ?? "text"}
                    placeholder={field.placeholder}
                    required
                    className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/20 transition focus:border-white/25 focus:bg-white/[0.06]"
                  />
                </label>
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-[#0d0f14] shadow-[0_2px_12px_0_rgba(255,255,255,0.15)] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? (
                "Saving…"
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                  </svg>
                  Connect {connector.title}
                </>
              )}
            </button>
          </form>
        )}

        {/* Example prompts */}
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/30">
            Example prompts
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {connector.prompts.map((prompt) => (
              <div
                key={prompt}
                className="group flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 transition hover:border-white/[0.14] hover:bg-white/[0.05]"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-white/[0.07]">
                  <PromptIcon />
                </span>
                <p className="text-[12.5px] leading-5 text-white/55 group-hover:text-white/75">
                  {prompt}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Details pills */}
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/30">
            Details
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {isOAuth ? "OAuth app" : "API key"}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
              By HeyRiz
            </span>
            {connector.website && (
              <a
                href={connector.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 transition hover:border-white/20 hover:text-white/80"
              >
                Website <ExternalIcon />
              </a>
            )}
            {connector.privacy && (
              <a
                href={connector.privacy}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 transition hover:border-white/20 hover:text-white/80"
              >
                Privacy <ExternalIcon />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {dialogBody}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [source, setSource] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>("UTC");
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  const [telegram, setTelegram] = useState<{ deepLink: string; qrCode: string } | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [activeConnector, setActiveConnector] = useState<ConnectorItem | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timezoneOptions = getTimezoneOptions(timezone);

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // keep UTC fallback
    }
  }, []);

  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data: { onboarding: OnboardingState }) => {
        if (data.onboarding.completedAt) {
          router.replace("/dashboard");
          return;
        }
        if (data.onboarding.source) setSource(data.onboarding.source);
        if (data.onboarding.googleConnected) setConnectedProviders(new Set(["gmail", "calendar"]));
        if (data.onboarding.source) {
          setStep(data.onboarding.telegramLinked ? 4 : 3);
          void fetch("/api/onboarding/timezone", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
          }).catch(() => null);
        }
      })
      .catch(() => null);
  }, [router]);

  const anyConnected = connectedProviders.size > 0;

  function isConnected(provider: string) {
    return connectedProviders.has(provider) || connectedProviders.has("google");
  }

  // Poll for any newly connected connector while on step 3.
  useEffect(() => {
    if (step !== 3) return;
    const check = async () => {
      const res = await fetch("/api/connectors");
      if (!res.ok) return;
      const connectors = (await res.json()) as ConnectorSummary[];
      const next = new Set(connectors.map((c) => c.provider));
      setConnectedProviders(next);
      if (next.has("google") || (next.has("gmail") && next.has("calendar"))) {
        await fetch("/api/onboarding/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ googleConnected: true }),
        });
      }
    };
    void check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [step]);

  async function unlinkConnector(provider: string) {
    await fetch(`/api/connectors/${provider}`, { method: "DELETE" });
    setConnectedProviders((prev) => {
      const next = new Set(prev);
      next.delete(provider);
      next.delete("google");
      return next;
    });
    if (provider === "gmail" || provider === "calendar" || provider === "google") {
      await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ googleConnected: false }),
      });
    }
  }

  async function saveManualConnector(event: FormEvent<HTMLFormElement>, connector: ConnectorItem) {
    event.preventDefault();
    if (!connector.fields) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const secret = Object.fromEntries(
      connector.fields.map((f) => [f.name, String(formData.get(f.name) ?? "")]),
    );
    setSetupError(null);
    setSetupSubmitting(true);
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: connector.provider,
          authType: "manual",
          label: connector.title,
          secret,
          metadata: { source: "onboarding" },
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        setSetupError(err?.message ?? `Could not save ${connector.title}`);
        return;
      }
      form.reset();
      setActiveConnector(null);
      setConnectedProviders((prev) => new Set([...prev, connector.provider]));
    } finally {
      setSetupSubmitting(false);
    }
  }

  // Step 4: request Telegram link and poll for it.
  useEffect(() => {
    if (step !== 4) return;
    fetch("/api/onboarding/telegram/token", { method: "POST" })
      .then((r) => r.json())
      .then((data: { deepLink?: string; qrCode?: string }) => {
        if (data.deepLink && data.qrCode) setTelegram({ deepLink: data.deepLink, qrCode: data.qrCode });
      })
      .catch(() => null);

    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/onboarding/status");
      if (!res.ok) return;
      const data = (await res.json()) as { onboarding: OnboardingState };
      if (data.onboarding.telegramLinked) {
        if (pollRef.current) clearInterval(pollRef.current);
        router.push("/dashboard");
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, router]);

  async function submitSource() {
    if (!source) return;
    setSourceError(null);
    setSourceLoading(true);
    try {
      const res = await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (!res.ok) throw new Error("save_failed");
      setStep(2);
    } catch {
      setSourceError("Something went wrong saving your answer. Please try again.");
    } finally {
      setSourceLoading(false);
    }
  }

  async function skipTelegram() {
    setSkipLoading(true);
    try {
      await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });
    } catch {
      // best-effort — don't block navigation if the call fails
    } finally {
      setSkipLoading(false);
    }
    router.push("/dashboard");
  }

  async function submitTimezone() {
    await fetch("/api/onboarding/timezone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timezone }),
    });
    setStep(3);
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-[#020305] px-6 py-16 text-white">
      <div className="w-full max-w-[560px]">
        <p className="mb-8 text-base font-medium uppercase tracking-[0.12em] text-white/45">
          Step {step} of 4
        </p>

        {/* Step 1 — source */}
        {step === 1 && (
          <section>
            <h1 className="text-3xl font-semibold">Where did you hear about HeyRiz?</h1>
            <div className="mt-6 flex flex-wrap gap-3">
              {SOURCE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSource(option)}
                  className={`rounded-full border px-4 py-2 text-base font-medium transition ${
                    source === option
                      ? "border-white bg-white text-[#0f1419]"
                      : "border-white/20 text-white/80 hover:border-white/50"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {sourceError && (
              <p className="mt-4 text-sm text-red-400">{sourceError}</p>
            )}
            <button
              type="button"
              disabled={!source || sourceLoading}
              onClick={() => void submitSource()}
              className="mt-8 h-[52px] w-full rounded-full bg-white text-base font-semibold text-[#0f1419] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sourceLoading ? "Saving…" : "Continue"}
            </button>
          </section>
        )}

        {/* Step 2 — timezone */}
        {step === 2 && (
          <section>
            <h1 className="text-3xl font-semibold">What's your timezone?</h1>
            <p className="mt-2 text-base text-white/60">
              HeyRiz uses this for reminders and meeting times. We've guessed yours from your
              browser — change it if it's wrong.
            </p>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-6 h-[52px] w-full rounded-2xl border border-white/15 bg-[#0f1419] px-4 text-base text-white"
            >
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void submitTimezone()}
              className="mt-8 h-[52px] w-full rounded-full bg-white text-base font-semibold text-[#0f1419]"
            >
              Continue
            </button>
          </section>
        )}

        {/* Step 3 — connectors */}
        {step === 3 && (
          <section>
            <h1 className="text-3xl font-semibold">Connect your tools</h1>
            <p className="mt-2 text-base text-white/60">
              Connect what you use — you can always add more from the dashboard later.
            </p>

            <div className="mt-8 flex flex-col gap-6">
              {CATEGORIES.map((category) => {
                const items = CONNECTOR_CATALOG.filter((c) => c.category === category);
                return (
                  <div key={category}>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/35">
                      {category}
                    </p>
                    <div className="flex flex-col gap-2">
                      {items.map((item) => {
                        const connected = isConnected(item.provider);
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.provider}
                            className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                                <Icon className="size-5" />
                              </span>
                              <div>
                                <p className="text-sm font-semibold">{item.title}</p>
                                <p className="mt-0.5 text-xs text-white/50">{item.description}</p>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {connected ? (
                                <>
                                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">
                                    Connected
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void unlinkConnector(item.provider)}
                                    className="text-xs font-medium text-white/35 underline-offset-2 hover:text-white/60 hover:underline"
                                  >
                                    Unlink
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => { setActiveConnector(item); setSetupError(null); }}
                                  className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-[#0f1419]"
                                >
                                  {item.authType === "oauth" ? "Connect" : "Setup"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!anyConnected}
              onClick={() => setStep(4)}
              className="mt-8 h-[52px] w-full rounded-full bg-white text-base font-semibold text-[#0f1419] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="mt-3 w-full text-center text-sm font-medium text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
            >
              Skip for now
            </button>
          </section>
        )}

        {/* Step 4 — Telegram */}
        {step === 4 && (
          <section>
            <h1 className="text-3xl font-semibold">Your briefing, in your pocket</h1>
            <p className="mt-2 text-base text-white/60">
              Link Telegram and Riz texts you every morning — what needs action, who to follow up
              with, what your numbers look like. Reply to act. No app to open.
            </p>
            {telegram ? (
              <>
                <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <img
                    src={telegram.qrCode}
                    alt="Telegram link QR code"
                    className="h-[200px] w-[200px] shrink-0 rounded-lg bg-white p-2"
                  />
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-white/55">
                      Scan the QR code from your phone, or tap the button below to open the bot.
                      Start the bot to complete the link.
                    </p>
                    <a
                      href={telegram.deepLink}
                      className="inline-flex h-[44px] items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#0f1419]"
                    >
                      Open Telegram bot
                    </a>
                  </div>
                </div>
                <p className="mt-6 text-sm text-white/35">
                  Waiting for you to start the bot…
                </p>
              </>
            ) : (
              <p className="mt-8 text-base text-white/45">Generating your link…</p>
            )}
            <button
              type="button"
              disabled={skipLoading}
              onClick={() => void skipTelegram()}
              className="mt-8 text-sm font-medium text-white/40 underline-offset-2 hover:text-white/65 hover:underline disabled:opacity-50"
            >
              {skipLoading ? "Saving…" : "I'll set up Telegram later"}
            </button>
          </section>
        )}
      </div>

      {activeConnector && (
        <ConnectorDialog
          connector={activeConnector}
          error={setupError}
          submitting={setupSubmitting}
          onClose={() => { setActiveConnector(null); setSetupError(null); }}
          onManualSubmit={saveManualConnector}
        />
      )}
    </main>
  );
}
