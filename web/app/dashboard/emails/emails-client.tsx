"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProcessedEmail = {
  id: string;
  summary: string;
  category: string;
  tab: "business" | "updates" | "all";
  person: string;
  dueDate: string;
  createdAt: string;
  messageId: string;
  sample?: boolean;
};

type EmailTask = {
  id: string;
  summary: string;
  source: string;
  status: string;
  createdAt: string;
};

type SentEmail = {
  id: string;
  to: string;
  subject: string;
  status: string;
  sentAt: string;
  sample?: boolean;
};

type EmailsData = {
  emails?: ProcessedEmail[];
  emailTasks?: EmailTask[];
  categoryLabels?: Record<string, string>;
};

type Tab = "all" | "followups" | "sent" | "business" | "updates";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 168) return d.toLocaleDateString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function timeAgo(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Stored as "Email from X (subject): AI summary"
function parseSummary(raw: string) {
  const match = raw.match(/^Email from (.+?) \((.+?)\): ([\s\S]+)$/);
  if (match) return { from: match[1].trim(), subject: match[2].trim(), body: match[3].trim() };
  return { from: "", subject: raw, body: "" };
}

const CATEGORY_COLORS: Record<string, string> = {
  payment_due:      "bg-red-500/15 text-red-300 border-red-500/20",
  meeting_request:  "bg-blue-500/15 text-blue-300 border-blue-500/20",
  investor_update:  "bg-violet-500/15 text-violet-300 border-violet-500/20",
  follow_up_needed: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  general_high:     "bg-orange-500/15 text-orange-300 border-orange-500/20",
  account_alert:    "bg-red-500/15 text-red-300 border-red-500/20",
  general_medium:   "bg-[#2a2a28] text-white/65 border-[#3e3e3c]",
  general_low:      "bg-[#222220] text-white/55 border-[#2e2e2c]",
  newsletter:       "bg-[#222220] text-white/55 border-[#2e2e2c]",
  otp:              "bg-[#222220] text-white/55 border-[#2e2e2c]",
};

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "followups", label: "Follow-ups" },
  { key: "sent", label: "Sent" },
  { key: "business", label: "Business" },
  { key: "updates", label: "Updates" },
];

const SAMPLE_EMAILS: ProcessedEmail[] = [
  {
    id: "sample-email-investor",
    summary:
      "Email from Arjun Mehta (Investor update request): Arjun asked for the latest traction numbers before Friday's partner meeting. He wants revenue, active customers, and the hiring plan summarized in one note.",
    category: "investor_update",
    tab: "business",
    person: "Arjun Mehta",
    dueDate: "Friday",
    createdAt: hoursAgo(2),
    messageId: "sample-investor",
    sample: true,
  },
  {
    id: "sample-email-payment",
    summary:
      "Email from Maya Kapoor (Invoice overdue): Maya flagged that the March platform invoice is still unpaid and asked whether finance needs a revised purchase order.",
    category: "payment_due",
    tab: "business",
    person: "Maya Kapoor",
    dueDate: "Today",
    createdAt: hoursAgo(5),
    messageId: "sample-payment",
    sample: true,
  },
  {
    id: "sample-email-meeting",
    summary:
      "Email from Sarah Chen (Book onboarding call): Sarah shared three slots for an onboarding call next week and asked which one works best for the team.",
    category: "meeting_request",
    tab: "business",
    person: "Sarah Chen",
    dueDate: "Tomorrow",
    createdAt: hoursAgo(22),
    messageId: "sample-meeting",
    sample: true,
  },
  {
    id: "sample-email-alert",
    summary:
      "Email from Stripe (Payout completed): Stripe confirmed that the latest payout has been sent to the connected bank account.",
    category: "account_alert",
    tab: "updates",
    person: "Stripe",
    dueDate: "",
    createdAt: hoursAgo(30),
    messageId: "sample-alert",
    sample: true,
  },
  {
    id: "sample-email-newsletter",
    summary:
      "Email from Product Hunt (Weekly digest): Product Hunt sent a weekly digest of tools trending in AI operations and customer support.",
    category: "newsletter",
    tab: "updates",
    person: "Product Hunt",
    dueDate: "",
    createdAt: hoursAgo(55),
    messageId: "sample-newsletter",
    sample: true,
  },
];

const SAMPLE_TASKS: EmailTask[] = [
  {
    id: "sample-task-investor",
    summary: "Send Arjun the traction summary before Friday's partner meeting.",
    source: "email",
    status: "open",
    createdAt: hoursAgo(2),
  },
  {
    id: "sample-task-payment",
    summary: "Confirm whether Maya needs a revised purchase order for the overdue invoice.",
    source: "email",
    status: "open",
    createdAt: hoursAgo(5),
  },
];

const SAMPLE_SENT: SentEmail[] = [
  {
    id: "sample-sent-investor",
    to: "arjun@northstar.vc",
    subject: "Re: Investor update request",
    status: "Sent",
    sentAt: hoursAgo(4),
    sample: true,
  },
  {
    id: "sample-sent-onboarding",
    to: "sarah@brightdesk.co",
    subject: "Onboarding call slots",
    status: "Draft approved",
    sentAt: hoursAgo(28),
    sample: true,
  },
];

function hoursAgo(hours: number) {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

async function chatAction(msg: string) {
  await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: msg }),
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EmailsClient() {
  const [data, setData] = useState<EmailsData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  async function load(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/emails");
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setData((await res.json()) as EmailsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const realEmails = data.emails ?? [];
  const realEmailTasks = data.emailTasks ?? [];
  const emails = realEmails.length > 0 ? realEmails : SAMPLE_EMAILS;
  const emailTasks = realEmailTasks.length > 0 ? realEmailTasks : SAMPLE_TASKS;
  const sentEmails = SAMPLE_SENT;
  const labels = data.categoryLabels ?? {};

  const counts: Record<Tab, number> = {
    all: emails.length,
    followups: emailTasks.length,
    sent: sentEmails.length,
    business: emails.filter((e) => e.tab === "business").length,
    updates: emails.filter((e) => e.tab === "updates").length,
  };

  const emailTab = activeTab === "all" || activeTab === "business" || activeTab === "updates";
  const tabFiltered = activeTab === "all" ? emails : emails.filter((e) => e.tab === activeTab);
  const displayedEmails = query.trim()
    ? tabFiltered.filter(
        (e) =>
          e.summary.toLowerCase().includes(query.toLowerCase()) ||
          e.category.toLowerCase().includes(query.toLowerCase()) ||
          e.person.toLowerCase().includes(query.toLowerCase()),
      )
    : tabFiltered;
  const displayedTasks = query.trim()
    ? emailTasks.filter((task) => task.summary.toLowerCase().includes(query.toLowerCase()))
    : emailTasks;
  const displayedSent = query.trim()
    ? sentEmails.filter(
        (email) =>
          email.to.toLowerCase().includes(query.toLowerCase()) ||
          email.subject.toLowerCase().includes(query.toLowerCase()) ||
          email.status.toLowerCase().includes(query.toLowerCase()),
      )
    : sentEmails;

  return (
    <main className="min-h-screen bg-[#1a1a19] text-[#f2f1ec]">
      {/* Header */}
      <header className="border-b border-[#2e2e2c] px-6 pt-5">
        <div className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Emails</h1>
            <p className="mt-0.5 text-sm text-white/55">
              Analysed by Riz as they arrive via webhook
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 rounded-lg border border-[#2e2e2c] px-3 py-1.5 text-sm text-white/65 transition hover:border-[#3e3e3c] hover:text-[#f2f1ec] disabled:opacity-40"
          >
            <RefreshIcon spinning={refreshing} />
            Refresh
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M13 13l-2.6-2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emails…"
            className="w-full rounded-xl border border-[#2e2e2c] bg-[#1f1f1e] py-2 pl-9 pr-4 text-sm text-[#f2f1ec] placeholder:text-white/45 focus:border-[#3e3e3c] focus:outline-none"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                activeTab === key
                  ? "border-[#f2f1ec] text-[#f2f1ec]"
                  : "border-transparent text-white/55 hover:text-white/65"
              }`}
            >
              {label}
              {!loading && counts[key] > 0 && (
                <span className={`rounded px-1.5 py-0.5 text-[11px] leading-none ${
                  activeTab === key ? "bg-[#f2f1ec]/15 text-[#f2f1ec]" : "bg-[#2e2e2c] text-white/55"
                }`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="w-full px-6 py-6">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2e2e2c] border-t-[#f2f1ec]" />
            <span className="text-sm text-white/55">Loading emails…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-6">
            {emailTab && displayedEmails.length > 0 ? (
              <EmailTable emails={displayedEmails} labels={labels} onRefresh={() => void load(true)} />
            ) : activeTab === "followups" && displayedTasks.length > 0 ? (
              <FollowupTable tasks={displayedTasks} />
            ) : activeTab === "sent" && displayedSent.length > 0 ? (
              <SentTable emails={displayedSent} />
            ) : (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2e2e2c] bg-[#1f1f1e]">
                  <InboxIcon />
                </div>
                <p className="font-medium">No emails here yet</p>
                <p className="max-w-xs text-sm text-white/55">
                  {activeTab === "followups"
                    ? "Follow-ups Riz creates from email will appear here."
                    : activeTab === "sent"
                      ? "Sent email history is not connected yet."
                      : activeTab === "business"
                    ? "Meeting requests, invoices, investor mail and follow-ups will appear here."
                    : activeTab === "updates"
                      ? "Account alerts, newsletters and notifications will appear here."
                      : "Every email Riz analyses via webhook will appear here."}
                </p>
              </div>
            )}

            {emailTab && emailTasks.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-white/55">
                  Follow-ups Riz created from email
                </p>
                <div className="flex flex-col gap-2">
                  {emailTasks.map((t) => (
                    <div key={t.id} className="flex items-start gap-3 rounded-xl border border-[#2e2e2c] bg-[#1f1f1e] px-4 py-3">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-violet-500/40 bg-violet-500/10">
                        <CheckIcon />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/80 leading-snug">{t.summary}</p>
                        <p className="mt-1 text-[11px] text-white/45">{timeAgo(t.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Email row ─────────────────────────────────────────────────────────────────

function EmailTable({
  emails,
  labels,
  onRefresh,
}: {
  emails: ProcessedEmail[];
  labels: Record<string, string>;
  onRefresh: () => void;
}) {
  return (
    <div className="overflow-x-auto bg-[#1f1f1e]">
      <table className="w-full min-w-[1050px] border-collapse text-left">
        <thead className="bg-[#1a1a19] text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
          <tr>
            <th className="px-4 py-3">Sender</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3">Received</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((email) => (
            <EmailTableRow key={email.id} email={email} labels={labels} onRefresh={onRefresh} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmailTableRow({
  email,
  labels,
  onRefresh,
}: {
  email: ProcessedEmail;
  labels: Record<string, string>;
  onRefresh: () => void;
}) {
  const { from, subject, body } = parseSummary(email.summary);
  const catColor = CATEGORY_COLORS[email.category] ?? CATEGORY_COLORS.general_medium;
  const catLabel = labels[email.category] ?? email.category;
  const initials = (from || subject || "E").charAt(0).toUpperCase();
  const [acting, setActing] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function act(label: string, msg: string) {
    if (email.sample) return;
    setActing(label);
    try {
      await chatAction(msg);
      setDone(label);
      onRefresh();
    } finally {
      setActing(null);
    }
  }

  return (
    <tr className="border-t border-[#2e2e2c] bg-[#1f1f1e] align-top transition hover:bg-[#242422]">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2a2a28] text-[13px] font-semibold text-white/65">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#f2f1ec]">{from || email.person || "Unknown"}</p>
            {email.person ? <p className="mt-0.5 text-xs text-white/55">{email.person}</p> : null}
          </div>
        </div>
      </td>
      <td className="max-w-[420px] px-4 py-4">
        <p className="truncate text-sm text-white/80">{subject || email.summary}</p>
        {body ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/55">{body}</p> : null}
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-1.5">
          <span className={`border px-2 py-0.5 text-[10px] font-semibold ${catColor}`}>
            {catLabel}
          </span>
          {email.sample ? (
            <span className="border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              Sample
            </span>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-white/65">{email.dueDate || "-"}</td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-white/65">{formatDate(email.createdAt)}</td>
      <td className="px-4 py-4 text-right">
        {email.sample ? (
          <span className="text-xs text-white/55">Sample</span>
        ) : (
          <div className="flex justify-end gap-1.5">
            <ActionButton
              label="Remind"
              active={acting === "Remind"}
              done={done === "Remind"}
              onClick={() => act("Remind", `Remind me to follow up on this email from ${from || "someone"}: ${subject || email.summary}`)}
            />
            <ActionButton
              label="Draft"
              active={acting === "Draft"}
              done={done === "Draft"}
              onClick={() => act("Draft", `Draft a reply to this email from ${from || "someone"}: ${subject || email.summary}`)}
            />
          </div>
        )}
      </td>
    </tr>
  );
}

function FollowupTable({ tasks }: { tasks: EmailTask[] }) {
  return (
    <div className="overflow-x-auto bg-[#1f1f1e]">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead className="bg-[#1a1a19] text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
          <tr>
            <th className="px-4 py-3">Follow-up</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-t border-[#2e2e2c] bg-[#1f1f1e] transition hover:bg-[#242422]">
              <td className="px-4 py-4 text-sm text-white/80">{task.summary}</td>
              <td className="px-4 py-4 text-sm text-white/65">{task.source}</td>
              <td className="px-4 py-4">
                <span className="border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-300">
                  {task.status || "open"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-white/65">{timeAgo(task.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SentTable({ emails }: { emails: SentEmail[] }) {
  return (
    <div className="overflow-x-auto bg-[#1f1f1e]">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead className="bg-[#1a1a19] text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
          <tr>
            <th className="px-4 py-3">Recipient</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Sent</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((email) => (
            <tr key={email.id} className="border-t border-[#2e2e2c] bg-[#1f1f1e] transition hover:bg-[#242422]">
              <td className="px-4 py-4 text-sm text-white/80">{email.to}</td>
              <td className="px-4 py-4 text-sm text-white/80">{email.subject}</td>
              <td className="px-4 py-4">
                <span className="border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  {email.sample ? "Sample" : email.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-white/65">{formatDate(email.sentAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmailItem({
  email,
  labels,
  onRefresh,
}: {
  email: ProcessedEmail;
  labels: Record<string, string>;
  onRefresh: () => void;
}) {
  const { from, subject, body } = parseSummary(email.summary);
  const catColor = CATEGORY_COLORS[email.category] ?? CATEGORY_COLORS.general_medium;
  const catLabel = labels[email.category] ?? email.category;
  const initials = (from || subject).charAt(0).toUpperCase();
  const [acting, setActing] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function act(label: string, msg: string) {
    if (email.sample) return;
    setActing(label);
    try {
      await chatAction(msg);
      setDone(label);
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="group flex items-start gap-3 bg-[#1f1f1e] px-4 py-4 transition hover:bg-[#242422]">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2a2a28] text-[13px] font-semibold text-white/65">
        {initials}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-[#f2f1ec]">{from || "Unknown"}</span>
          <span className="shrink-0 text-[11px] text-white/45">{formatDate(email.createdAt)}</span>
        </div>

        {subject && <p className="mt-0.5 truncate text-sm text-white/80">{subject}</p>}
        {body && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/55">{body}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${catColor}`}>
            {catLabel}
          </span>
          {email.sample && (
            <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              Sample
            </span>
          )}
          {email.person && <span className="text-[11px] text-white/45">· {email.person}</span>}
          {email.dueDate && <span className="text-[11px] text-amber-500/70">· Due {email.dueDate}</span>}
        </div>

        {/* Action row */}
        {!email.sample && (
        <div className="mt-2.5 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <ActionButton
            label="Remind me"
            active={acting === "Remind me"}
            done={done === "Remind me"}
            onClick={() => act("Remind me", `Remind me to follow up on this email from ${from || "someone"}: ${subject || email.summary}`)}
          />
          {email.category === "meeting_request" && (
            <ActionButton
              label="Add to calendar"
              active={acting === "Add to calendar"}
              done={done === "Add to calendar"}
              onClick={() => act("Add to calendar", `Schedule a meeting based on this email from ${from}: ${subject}`)}
            />
          )}
          <ActionButton
            label="Draft reply"
            active={acting === "Draft reply"}
            done={done === "Draft reply"}
            onClick={() => act("Draft reply", `Draft a reply to this email from ${from || "someone"}: ${subject || email.summary}`)}
          />
        </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  active,
  done,
  onClick,
}: {
  label: string;
  active: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={active}
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
        done
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-[#2e2e2c] bg-[#1a1a19] text-white/65 hover:border-[#3e3e3c] hover:text-[#f2f1ec]"
      } disabled:opacity-50`}
    >
      {active ? "…" : done ? `✓ ${label}` : label}
    </button>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={spinning ? "animate-spin" : ""} aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/45" aria-hidden="true">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
