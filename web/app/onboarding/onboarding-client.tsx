"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarIcon,
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
      "rizly watches your inbox, surfaces important emails, triages by priority, and drafts approved replies — all without you lifting a finger.",
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
      "rizly checks your calendar for conflicts, creates and reschedules events with your approval, and sends reminders before meetings.",
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
];

const CATEGORIES = ["Google", "Payments", "Databases"] as const;

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
      className="shrink-0 text-black/50"
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
      className="relative m-auto flex w-full max-w-[95%] flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl sm:w-[600px]"
    >
      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center gap-5 border-b border-slate-200 px-8 pb-8 pt-10 text-center">
        {/* close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex size-8 items-center justify-center border border-slate-200 bg-white text-black transition-colors hover:bg-[#FE7F2D] hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        {/* icon */}
        <div className="flex size-[72px] items-center justify-center border border-slate-200 bg-white">
          <Icon className="size-10" />
        </div>

        {/* title + description */}
        <div className="flex flex-col gap-2">
          <h2 className="text-[22px] font-semibold tracking-tight text-black">{connector.title}</h2>
          <p className="mx-auto max-w-sm text-[13px] leading-6 text-slate-500">
            {connector.description}
          </p>
        </div>

        {/* OAuth CTA — only for oauth type */}
        {isOAuth && (
          <a
            href={oauthHref}
            className="inline-flex h-10 items-center gap-2 bg-black px-6 text-sm font-semibold text-white transition-all hover:bg-[#FE7F2D] hover:shadow-md active:scale-[0.99]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
            Connect {connector.title}
          </a>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 overflow-y-auto px-6 pb-7 pt-6">

        {/* Manual credentials form */}
        {!isOAuth && connector.fields && (
          <form onSubmit={(e) => void onManualSubmit(e, connector)}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40">
              Credentials
            </p>

            {error && (
              <p className="mb-4 border border-slate-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3">
              {connector.fields.map((field) => (
                <label key={field.name} className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-black/60">{field.label}</span>
                  <input
                    name={field.name}
                    type={field.type ?? "text"}
                    placeholder={field.placeholder}
                    required
                    className="h-11 border border-slate-200 bg-white px-4 text-sm text-black outline-none placeholder:text-slate-400 transition focus:border-[#FE7F2D]"
                  />
                </label>
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 bg-black text-sm font-semibold text-white transition-all hover:bg-[#FE7F2D] hover:shadow-md active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40">
            Example prompts
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {connector.prompts.map((prompt) => (
              <div
                key={prompt}
                className="group flex items-start gap-3 border border-slate-200 bg-white p-3.5 transition-colors hover:bg-[#FE7F2D]/5"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center border border-slate-200 bg-white">
                  <PromptIcon />
                </span>
                <p className="text-[12.5px] leading-5 text-black/60 group-hover:text-black">
                  {prompt}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Details pills */}
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40">
            Details
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-black/70">
              <span className="size-1.5 bg-emerald-500" />
              {isOAuth ? "OAuth app" : "API key"}
            </span>
            <span className="flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-black/70">
              By rizly
            </span>
            {connector.website && (
              <a
                href={connector.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-black/70 transition-colors hover:bg-[#FE7F2D] hover:text-white"
              >
                Website <ExternalIcon />
              </a>
            )}
            {connector.privacy && (
              <a
                href={connector.privacy}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-black/70 transition-colors hover:bg-[#FE7F2D] hover:text-white"
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
      className="fixed inset-0 z-50 flex overflow-y-auto bg-black/50 px-4 py-10 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {dialogBody}
    </div>
  );
}

// ── Step metadata (drives the progress stepper + eyebrows) ──────────────────
const STEP_META = [
  { eyebrow: "Welcome" },
  { eyebrow: "Preferences" },
  { eyebrow: "Integrations" },
  { eyebrow: "Daily briefing" },
] as const;

function BackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ── Progress stepper: segmented bar + counter + back affordance ──────────────
function ProgressHeader({ step, onBack }: { step: number; onBack: () => void }) {
  const total = STEP_META.length;
  return (
    <div>
      <div className="flex h-6 items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={onBack}
            className="group -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/40"
          >
            <BackIcon />
            Back
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 tabular-nums">
          Step {step} <span className="text-slate-300">/ {total}</span>
        </span>
      </div>
      <div className="mt-3.5 flex gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total} aria-label={`Step ${step} of ${total}`}>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 border border-slate-200 transition-colors duration-300 ${
              i < step - 1 ? "bg-black" : i === step - 1 ? "bg-[#FE7F2D]" : "bg-white"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-black/40">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Extra search terms so a zone is findable by its modern/legacy name or country,
// regardless of which name the runtime's ICU lists (e.g. Calcutta vs Kolkata).
const TZ_SYNONYMS: Record<string, string> = {
  "asia/calcutta": "kolkata india mumbai delhi ist",
  "asia/kolkata": "calcutta india mumbai delhi ist",
  "asia/saigon": "ho chi minh vietnam",
  "asia/ho_chi_minh": "saigon vietnam",
  "asia/rangoon": "yangon myanmar",
  "asia/yangon": "rangoon myanmar",
  "asia/katmandu": "kathmandu nepal",
  "asia/kathmandu": "katmandu nepal",
  "europe/kiev": "kyiv ukraine",
  "europe/kyiv": "kiev ukraine",
  "america/godthab": "nuuk greenland",
  "america/nuuk": "godthab greenland",
};

function tzSearchString(tz: string): string {
  const extra = TZ_SYNONYMS[tz.toLowerCase()] ?? "";
  return `${tz.replace(/[_/]/g, " ")} ${extra}`.toLowerCase();
}

// ── Searchable timezone picker (type to filter the IANA list) ────────────────
function TimezoneCombobox({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (tz: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = (
    q ? options.filter((tz) => tzSearchString(tz).includes(q)) : options
  ).slice(0, 80);

  function pick(tz: string) {
    onChange(tz);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative mt-6">
      <div className="flex h-[52px] items-center gap-2 border border-slate-200 bg-white px-4 transition focus-within:border-[#FE7F2D]">
        <SearchIcon />
        <input
          value={open ? query : value}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          placeholder={open ? `Search — current: ${value}` : "Search your timezone…"}
          className="h-full w-full bg-transparent text-base text-black outline-none placeholder:text-slate-400"
          aria-label="Timezone"
          autoComplete="off"
        />
      </div>

      {open && (
        <ul className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto border border-slate-200 bg-white shadow-xl">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">No timezone matches “{query}”.</li>
          ) : (
            filtered.map((tz) => {
              const selected = tz === value;
              return (
                <li key={tz}>
                  <button
                    type="button"
                    onClick={() => pick(tz)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      selected ? "bg-black text-white" : "text-black hover:bg-[#FE7F2D]/10"
                    }`}
                  >
                    <span>{tz.replace(/_/g, " ")}</span>
                    {selected && <CheckIcon />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
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
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [activeConnector, setActiveConnector] = useState<ConnectorItem | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);
  const [confirmSkipTelegram, setConfirmSkipTelegram] = useState(false);
  const [connectorQuery, setConnectorQuery] = useState("");
  const [connectorCategory, setConnectorCategory] = useState<"All" | (typeof CATEGORIES)[number]>("All");
  const [searchOpen, setSearchOpen] = useState(false);
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

  const connectorQ = connectorQuery.trim().toLowerCase();
  const visibleConnectors = CONNECTOR_CATALOG.filter((c) => {
    const categoryOk = connectorCategory === "All" || c.category === connectorCategory;
    const queryOk =
      !connectorQ ||
      c.title.toLowerCase().includes(connectorQ) ||
      c.description.toLowerCase().includes(connectorQ) ||
      c.provider.toLowerCase().includes(connectorQ);
    return categoryOk && queryOk;
  });

  function goBack() {
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s));
  }

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

  // Fetch the Telegram deep-link/QR. Surfaces a clear error + retry instead of
  // hanging on "Generating…" when the bot isn't configured or the call fails.
  const loadTelegramLink = useCallback(async () => {
    setTelegramLoading(true);
    setTelegramError(null);
    try {
      const res = await fetch("/api/onboarding/telegram/token", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { deepLink?: string; qrCode?: string; message?: string }
        | null;
      if (res.ok && data?.deepLink && data?.qrCode) {
        setTelegram({ deepLink: data.deepLink, qrCode: data.qrCode });
      } else {
        setTelegram(null);
        setTelegramError(
          data?.message ??
            "We couldn't generate your Telegram link. You can retry, or skip this and set it up later from the dashboard.",
        );
      }
    } catch {
      setTelegram(null);
      setTelegramError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setTelegramLoading(false);
    }
  }, []);

  // Step 4: request Telegram link and poll for it.
  useEffect(() => {
    if (step !== 4) return;
    void loadTelegramLink();

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
  }, [step, router, loadTelegramLink]);

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
    <main
      className={`relative flex justify-center bg-white px-6 text-black ${
        step === 3
          ? "h-[100dvh] items-stretch overflow-hidden pt-16 pb-6"
          : "min-h-screen items-start pt-16 pb-10"
      }`}
    >
      {/* Floating brand mark — matches the login page */}
      <Link
        href="/"
        className="fixed left-5 top-5 z-20 flex h-9 items-center sm:left-8 sm:top-7"
        aria-label="rizly home"
      >
        <Image
          src="/rizly_white.png"
          alt="rizly"
          width={112}
          height={26}
          className="h-8 w-auto object-contain"
          priority
        />
      </Link>

      <div className={`flex w-full flex-col ${step === 3 ? "max-w-[1200px]" : "max-w-[600px]"}`}>
        <ProgressHeader step={step} onBack={goBack} />

        <div
          key={step}
          className={`onb-enter ${step === 3 ? "mt-7 flex min-h-0 flex-1 flex-col" : "mt-11"}`}
        >
        {/* Step 1 — source */}
        {step === 1 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FE7F2D]">
              {STEP_META[0].eyebrow}
            </p>
            <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-slate-950 text-balance">
              Where did you hear about rizly?
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-6 text-slate-500">
              A quick one — it helps us understand who rizly works best for.
            </p>
            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SOURCE_OPTIONS.map((option) => {
                const selected = source === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSource(option)}
                    className={`flex items-center justify-between gap-3 border-2 border-black px-4 py-3.5 text-left text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/40 ${
                      selected
                        ? "bg-black text-white shadow-[4px_4px_0px_0px_#000]"
                        : "bg-white text-black hover:bg-[#FE7F2D]/5 hover:shadow-[4px_4px_0px_0px_#000]"
                    }`}
                  >
                    {option}
                    {selected && <CheckIcon />}
                  </button>
                );
              })}
            </div>
            {sourceError && (
              <p className="mt-4 text-sm text-red-600">{sourceError}</p>
            )}
            <button
              type="button"
              disabled={!source || sourceLoading}
              onClick={() => void submitSource()}
              className="mt-8 inline-flex h-[52px] w-full items-center justify-center border-2 border-black bg-black text-base font-semibold text-white transition-all hover:bg-[#FE7F2D] hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:border-black/20 disabled:bg-black/20 disabled:text-white disabled:shadow-none"
            >
              {sourceLoading ? "Saving…" : "Continue"}
            </button>
          </section>
        )}

        {/* Step 2 — timezone */}
        {step === 2 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FE7F2D]">
              {STEP_META[1].eyebrow}
            </p>
            <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-slate-950 text-balance">
              What&rsquo;s your timezone?
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-6 text-slate-500">
              rizly uses this for reminders and meeting times. We&rsquo;ve guessed yours from your
              browser — change it if it&rsquo;s wrong.
            </p>
            <TimezoneCombobox value={timezone} options={timezoneOptions} onChange={setTimezone} />
            <p className="mt-3 text-sm text-slate-500">
              Selected: <span className="font-semibold text-black">{timezone.replace(/_/g, " ")}</span>
              {" — it's "}
              <span className="font-semibold text-black">
                {new Date().toLocaleTimeString("en-US", {
                  timeZone: timezone,
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
              {" there right now."}
            </p>
            <button
              type="button"
              onClick={() => void submitTimezone()}
              className="mt-8 inline-flex h-[52px] w-full items-center justify-center bg-black text-base font-semibold text-white transition-all hover:bg-[#FE7F2D] hover:shadow-md active:scale-[0.99]"
            >
              Continue
            </button>
          </section>
        )}

        {/* Step 3 — connectors */}
        {step === 3 && (
          <section className="flex min-h-0 flex-1 flex-col">
            {/* Fixed header: title + search + category tabs */}
            <div className="shrink-0">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FE7F2D]">
                    {STEP_META[2].eyebrow}
                  </p>
                  <h1 className="mt-2 text-[26px] font-semibold leading-[1.1] tracking-[-0.02em] text-slate-950">
                    Connect your tools
                  </h1>
                </div>
                <span className="shrink-0 border border-slate-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-tight text-black tabular-nums">
                  {connectedProviders.size} connected
                </span>
              </div>
              <p className="mt-2 text-[14px] leading-6 text-slate-500">
                The more rizly can see, the more it can handle. Add more anytime from the dashboard.
              </p>

              {/* Toolbar: category tabs + a search icon that opens the field on click */}
              <div className="mt-4 flex items-center gap-2">
                <div className="flex flex-1 flex-wrap gap-2">
                  {(["All", ...CATEGORIES] as const).map((cat) => {
                    const active = connectorCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setConnectorCategory(cat)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/40 ${
                          active
                            ? "bg-black text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen((o) => {
                      if (o) setConnectorQuery("");
                      return !o;
                    });
                  }}
                  aria-label={searchOpen ? "Close search" : "Search integrations"}
                  aria-expanded={searchOpen}
                  className={`flex size-9 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/40 ${
                    searchOpen
                      ? "bg-black text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </button>
              </div>

              {/* Search field — revealed when the icon is tapped */}
              {searchOpen && (
                <div className="mt-2.5 flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 transition focus-within:border-[#FE7F2D]">
                  <SearchIcon />
                  <input
                    value={connectorQuery}
                    onChange={(e) => setConnectorQuery(e.target.value)}
                    placeholder="Search integrations…"
                    className="h-full w-full bg-transparent text-sm text-black outline-none placeholder:text-slate-400"
                    aria-label="Search integrations"
                    autoComplete="off"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setConnectorQuery("");
                      setSearchOpen(false);
                    }}
                    aria-label="Close search"
                    className="text-black/40 transition-colors hover:text-black"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable grid */}
            <div className="mt-4 flex-1 overflow-y-auto border-t border-slate-200 pt-4">
              {visibleConnectors.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">
                  No integrations match “{connectorQuery}”.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleConnectors.map((item) => {
                    const connected = isConnected(item.provider);
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.provider}
                        className="flex flex-col justify-between border border-slate-200 bg-white p-4 transition-all duration-200 hover:border-slate-300 hover:bg-[#FE7F2D]/5 hover:shadow-md"
                      >
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-9 shrink-0 items-center justify-center border border-slate-200 bg-white">
                              <Icon className="size-5" />
                            </span>
                            <p className="text-sm font-semibold text-black">{item.title}</p>
                          </div>
                          <p className="mt-2.5 text-xs leading-5 text-slate-500 line-clamp-3">
                            {item.description}
                          </p>
                        </div>

                        <div className="mt-4">
                          {connected ? (
                            <div className="flex items-center justify-between">
                              <span className="border border-slate-200 bg-emerald-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-tight text-white">
                                Connected
                              </span>
                              <button
                                type="button"
                                onClick={() => void unlinkConnector(item.provider)}
                                className="text-xs font-semibold text-black/40 underline-offset-2 hover:text-black hover:underline"
                              >
                                Unlink
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setActiveConnector(item); setSetupError(null); }}
                              className="w-full bg-black px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#FE7F2D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/50"
                            >
                              {item.authType === "oauth" ? "Connect" : "Setup"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pinned footer: Continue + Skip */}
            <div className="shrink-0 border-t border-slate-200 bg-white pt-4">
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="shrink-0 text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  disabled={!anyConnected}
                  onClick={() => setStep(4)}
                  className="inline-flex h-[52px] items-center justify-center gap-2 bg-black px-10 text-base font-semibold text-white transition-all hover:bg-[#FE7F2D] hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-black/20 disabled:text-white disabled:shadow-none"
                >
                  Continue
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Step 4 — Telegram */}
        {step === 4 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FE7F2D]">
              {STEP_META[3].eyebrow}
            </p>
            <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-slate-950 text-balance">
              Your briefing, in your pocket
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-6 text-slate-500">
              Link Telegram and Riz texts you every morning — what needs action, who to follow up
              with, what your numbers look like. Reply to act. No app to open.
            </p>
            {telegram ? (
              <>
                <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <img
                    src={telegram.qrCode}
                    alt="Telegram link QR code"
                    className="h-[200px] w-[200px] shrink-0 border border-slate-200 bg-white p-2"
                  />
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-slate-600">
                      Scan the QR code from your phone, or tap the button below to open the bot.
                      Start the bot to complete the link.
                    </p>
                    <a
                      href={telegram.deepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-[44px] items-center justify-center bg-black px-6 text-sm font-semibold text-white transition-all hover:bg-[#FE7F2D] hover:shadow-md active:scale-[0.99]"
                    >
                      Open Telegram bot
                    </a>
                  </div>
                </div>
                <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FE7F2D] opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-[#FE7F2D]" />
                  </span>
                  Waiting for you to start the bot…
                </p>
              </>
            ) : telegramError ? (
              <div className="mt-8">
                <div className="border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-black">Couldn&rsquo;t generate your link</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{telegramError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadTelegramLink()}
                  disabled={telegramLoading}
                  className="mt-4 inline-flex h-11 items-center justify-center bg-black px-6 text-sm font-semibold text-white transition-colors hover:bg-[#FE7F2D] active:scale-[0.99] disabled:opacity-50"
                >
                  {telegramLoading ? "Retrying…" : "Try again"}
                </button>
              </div>
            ) : (
              <p className="mt-8 inline-flex items-center gap-2 text-base text-slate-500">
                <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-black" />
                Generating your link…
              </p>
            )}
            {confirmSkipTelegram ? (
              <div className="mt-8 border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Sure? Riz mostly lives on Telegram.</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Reminders, morning briefs, and approvals won&apos;t reach you until you link it.
                  You can do it later from the dashboard.
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setConfirmSkipTelegram(false)}
                    className="inline-flex h-9 items-center justify-center bg-black px-4 text-xs font-semibold text-white transition-colors hover:bg-[#FE7F2D]"
                  >
                    Keep linking
                  </button>
                  <button
                    type="button"
                    disabled={skipLoading}
                    onClick={() => void skipTelegram()}
                    className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline disabled:opacity-50"
                  >
                    {skipLoading ? "Saving…" : "Skip anyway"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmSkipTelegram(true)}
                className="mt-8 text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
              >
                I&apos;ll set up Telegram later
              </button>
            )}
          </section>
        )}
        </div>

        {/* Step 3 fills the viewport with its own pinned footer, so the trust line
            would overflow the page there — show it on the shorter steps only. */}
        {step !== 3 && (
          <p className="mt-14 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <LockIcon />
            Encrypted end to end. Nothing sends without your approval.
          </p>
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
