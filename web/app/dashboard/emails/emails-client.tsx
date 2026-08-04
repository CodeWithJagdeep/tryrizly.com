"use client";

import { useEffect, useRef, useState } from "react";
import { CreditsBadge } from "../components/CreditsBadge";

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
  gmailConnected?: boolean;
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

// Extracted due "dates" are date-only (stored at UTC midnight) or loose
// natural-language text from the LLM ("Friday", "next week"). Read the ISO
// ones back with timeZone: "UTC" so the calendar date shown never shifts a
// day off for the viewer's local offset — anything unparsable passes through.
function formatDueDate(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
}

// Stored as "Email from X (subject): AI summary"
function parseSummary(raw: string) {
  const match = raw.match(/^Email from (.+?) \((.+?)\): ([\s\S]+)$/);
  if (match) return { from: match[1].trim(), subject: match[2].trim(), body: match[3].trim() };
  return { from: "", subject: raw, body: "" };
}

const CATEGORY_COLORS: Record<string, string> = {
  payment_due:      "bg-red-500/10 text-red-300 border-red-500/20",
  meeting_request:  "bg-blue-500/10 text-blue-300 border-blue-500/20",
  investor_update:  "bg-violet-500/10 text-violet-300 border-violet-500/20",
  follow_up_needed: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  general_high:     "bg-orange-500/10 text-orange-300 border-orange-500/20",
  account_alert:    "bg-red-500/10 text-red-300 border-red-500/20",
  general_medium:   "bg-white/10 text-white/70 border-[#3a3b3f]",
  general_low:      "bg-white/10 text-white/60 border-[#2d2e31]",
  newsletter:       "bg-white/10 text-white/60 border-[#2d2e31]",
  otp:              "bg-white/10 text-white/60 border-[#2d2e31]",
};

// Pure marketing/OTP noise - hidden from the "All" tab's default view,
// still visible under Updates for anyone who goes looking for it.
const LOW_VALUE_CATEGORIES = new Set(["newsletter", "otp", "general_low"]);

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "followups", label: "Follow-ups" },
  { key: "sent", label: "Sent" },
  { key: "business", label: "Business" },
  { key: "updates", label: "Updates" },
];

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
  const [openEmail, setOpenEmail] = useState<ProcessedEmail | null>(null);

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
  const gmailConnected = data.gmailConnected ?? false;
  const emails = realEmails;
  const emailTasks = realEmailTasks;
  const sentEmails: SentEmail[] = [];
  const labels = data.categoryLabels ?? {};

  const counts: Record<Tab, number> = {
    all: emails.filter((e) => !LOW_VALUE_CATEGORIES.has(e.category)).length,
    followups: emailTasks.length,
    sent: sentEmails.length,
    business: emails.filter((e) => e.tab === "business").length,
    updates: emails.filter((e) => e.tab === "updates").length,
  };

  const emailTab = activeTab === "all" || activeTab === "business" || activeTab === "updates";
  // "All" means "everything worth your attention" - pure newsletter/OTP noise
  // still shows up, just under the Updates tab where someone would go
  // looking for it, not mixed into the default view.
  const tabFiltered =
    activeTab === "all"
      ? emails.filter((e) => !LOW_VALUE_CATEGORIES.has(e.category))
      : emails.filter((e) => e.tab === activeTab);
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
    <main className="flex h-dvh flex-col overflow-hidden bg-[#111315] text-white">
      {/* Top bar — matches the chat page's sticky chrome */}
      <div className="flex h-14 w-full shrink-0 items-center justify-between border-b border-[#2d2e31] bg-[#111315] px-4 md:px-6">
        <div className="flex h-8 items-center rounded-lg px-2 text-base font-normal text-white md:text-lg">
          Emails
        </div>
        <CreditsBadge />
      </div>

      {/* Header */}
      <header className="shrink-0 border-b border-[#2d2e31] px-4 pt-1 sm:px-6">
        <div className="flex items-center justify-between gap-3 pb-4">
          <p className="min-w-0 truncate text-[15px] text-white/60">
            Every important email from your inbox, all in one place
          </p>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing || loading}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-[#2d2e31] bg-[#18191b] px-3 py-1.5 text-sm text-white/70 transition hover:border-[#3a3b3f] hover:text-white disabled:opacity-40"
          >
            <RefreshIcon spinning={refreshing} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M13 13l-2.6-2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emails…"
            className="h-12 w-full rounded-full border border-[#2d2e31] bg-[#18191b] pl-11 pr-4 text-base text-white placeholder:text-white/40 transition focus:border-[#D9BEF4] focus:outline-none"
          />
        </div>

        {/* Tabs — pure bordered pills, matching onboarding's selection style */}
        <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[15px] font-normal transition ${
                activeTab === key
                  ? "border-[#2d2e31] bg-white/10 text-white/80"
                  : "border-[#2d2e31] bg-[#18191b] text-white/80 hover:border-[#3a3b3f] hover:bg-white/[0.03]"
              }`}
            >
              {label}
              {!loading && counts[key] > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none ${
                  activeTab === key ? "bg-[#D9BEF4]/15 text-[#D9BEF4]" : "bg-white/10 text-white/60"
                }`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2d2e31] border-t-white" />
            <span className="text-sm text-white/60">Loading emails…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-6">
            {emailTab && displayedEmails.length > 0 ? (
              <EmailList
                emails={displayedEmails}
                labels={labels}
                onRefresh={() => void load(true)}
                onOpen={setOpenEmail}
              />
            ) : activeTab === "followups" && displayedTasks.length > 0 ? (
              <FollowupList tasks={displayedTasks} />
            ) : activeTab === "sent" && displayedSent.length > 0 ? (
              <SentList emails={displayedSent} />
            ) : (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2d2e31] bg-[#18191b]">
                  <InboxIcon />
                </div>
                <p className="font-medium">No emails here yet</p>
                <p className="max-w-xs text-sm text-white/60">
                  {!gmailConnected
                    ? "Connect Gmail so Riz can analyse incoming email and build this inbox from real messages."
                    : activeTab === "followups"
                    ? "Follow-ups Riz creates from email will appear here."
                    : activeTab === "sent"
                      ? "Sent email history is not connected yet."
                      : activeTab === "business"
                    ? "Meeting requests, invoices, investor mail and follow-ups will appear here."
                    : activeTab === "updates"
                      ? "Account alerts and useful updates will appear here."
                      : "Useful emails Riz analyses via webhook will appear here."}
                </p>
                {!gmailConnected && (
                  <a
                    href="/api/connectors/gmail/start?returnTo=%2Fdashboard%2Femails"
                    className="mt-2 inline-flex items-center justify-center rounded-md border border-[#D9BEF4] bg-[#D9BEF4] px-4 py-2 text-sm font-semibold text-[#1a1a1c] transition hover:brightness-95"
                  >
                    Connect Gmail
                  </a>
                )}
              </div>
            )}

            {emailTab && emailTasks.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-white/60">
                  Follow-ups Riz created from email
                </p>
                <div className="flex flex-col gap-2">
                  {emailTasks.map((t) => (
                    <div key={t.id} className="flex items-start gap-3 rounded-xl border border-[#2d2e31] bg-[#18191b] px-4 py-3">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-violet-500/40 bg-violet-500/10">
                        <CheckIcon />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/80 leading-snug">{t.summary}</p>
                        <p className="mt-1 text-[11px] text-white/40">{timeAgo(t.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {openEmail && (
        <EmailDetailSheet
          email={openEmail}
          onClose={() => setOpenEmail(null)}
        />
      )}
    </main>
  );
}

// ── Email row ─────────────────────────────────────────────────────────────────

// The table needs real horizontal width for its columns — below `sm` that
// forces a scrollbar, so phones get a stacked card list instead.
function EmailList({
  emails,
  labels,
  onRefresh,
  onOpen,
}: {
  emails: ProcessedEmail[];
  labels: Record<string, string>;
  onRefresh: () => void;
  onOpen: (email: ProcessedEmail) => void;
}) {
  return (
    <>
      <div className="hidden sm:block">
        <EmailTable emails={emails} labels={labels} onRefresh={onRefresh} onOpen={onOpen} />
      </div>
      <div className="flex flex-col gap-2 sm:hidden">
        {emails.map((email) => (
          <EmailCard key={email.id} email={email} labels={labels} onRefresh={onRefresh} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

function EmailCard({
  email,
  labels,
  onRefresh,
  onOpen,
}: {
  email: ProcessedEmail;
  labels: Record<string, string>;
  onRefresh: () => void;
  onOpen: (email: ProcessedEmail) => void;
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

  const canOpen = !email.sample && !!email.messageId;

  return (
    <div
      onClick={() => canOpen && onOpen(email)}
      className={`rounded-xl border border-[#2d2e31] bg-[#18191b] p-3 transition active:bg-white/[0.03] ${canOpen ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white/70">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-white">{from || email.person || "Unknown"}</p>
            <span className="shrink-0 text-[11px] text-white/40">{formatDate(email.createdAt)}</span>
          </div>
          <p className="mt-0.5 truncate text-sm text-white/80">{subject || email.summary}</p>
          {body ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/60">{body}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`border px-2 py-0.5 text-[10px] font-semibold ${catColor}`}>{catLabel}</span>
            {email.sample ? (
              <span className="border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                Sample
              </span>
            ) : null}
            {email.dueDate ? <span className="text-[11px] text-amber-600">Due {formatDueDate(email.dueDate)}</span> : null}
          </div>
        </div>
      </div>
      {!email.sample && (
        <div className="mt-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
          <ActionButton
            label="Remind"
            active={acting === "Remind"}
            done={done === "Remind"}
            onClick={() => act("Remind", `Remind me to follow up on this email from ${from || "someone"}: ${subject || email.summary}`)}
          />
        </div>
      )}
    </div>
  );
}

function EmailTable({
  emails,
  labels,
  onRefresh,
  onOpen,
}: {
  emails: ProcessedEmail[];
  labels: Record<string, string>;
  onRefresh: () => void;
  onOpen: (email: ProcessedEmail) => void;
}) {
  return (
    <div className="overflow-x-auto bg-[#18191b]">
      <table className="w-full min-w-[1050px] border-collapse text-left">
        <thead className="bg-[#18191b] text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">
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
            <EmailTableRow key={email.id} email={email} labels={labels} onRefresh={onRefresh} onOpen={onOpen} />
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
  onOpen,
}: {
  email: ProcessedEmail;
  labels: Record<string, string>;
  onRefresh: () => void;
  onOpen: (email: ProcessedEmail) => void;
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

  const canOpen = !email.sample && !!email.messageId;

  return (
    <tr
      onClick={() => canOpen && onOpen(email)}
      className={`border-t border-[#2d2e31] bg-[#18191b] align-top transition hover:bg-white/[0.03] ${canOpen ? "cursor-pointer" : ""}`}
    >
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold text-white/70">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{from || email.person || "Unknown"}</p>
            {email.person ? <p className="mt-0.5 text-xs text-white/60">{email.person}</p> : null}
          </div>
        </div>
      </td>
      <td className="max-w-[420px] px-4 py-4">
        <p className="truncate text-sm text-white/80">{subject || email.summary}</p>
        {body ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/60">{body}</p> : null}
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
      <td className="whitespace-nowrap px-4 py-4 text-sm text-white/70">{formatDueDate(email.dueDate) || "-"}</td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-white/70">{formatDate(email.createdAt)}</td>
      <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
        {email.sample ? (
          <span className="text-xs text-white/60">Sample</span>
        ) : (
          <div className="flex justify-end gap-1.5">
            <ActionButton
              label="Remind"
              active={acting === "Remind"}
              done={done === "Remind"}
              onClick={() => act("Remind", `Remind me to follow up on this email from ${from || "someone"}: ${subject || email.summary}`)}
            />
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Email detail bottom sheet ────────────────────────────────────────────────

type GmailMessageDetail = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  date: string;
  body: string;
  bodyHtml?: string;
  messageIdHeader?: string;
};

// Sandboxed (no allow-scripts) iframe is the safe way to render arbitrary
// email HTML — this only strips <script> defensively; script execution is
// already blocked by the sandbox regardless of what's in the markup.
function stripScripts(html: string): string {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
}

// Remote <img>/<source> src (and CSS background-image url(...)) are the
// classic email tracking-pixel vector — loading them tells the sender you
// opened the mail and leaks your IP. Neuter them by default; inline cid:
// images we already resolved server-side to data: URIs are unaffected since
// they never touch the network.
const REMOTE_IMAGE_PATTERN = /\ssrc=(["'])(?:https?:)?\/\/[^"']*\1/gi;
const REMOTE_SRCSET_PATTERN = /\ssrcset=(["'])[^"']*\1/gi;
const REMOTE_BG_PATTERN = /url\(\s*(['"]?)(?:https?:)?\/\/[^)'"]*\1\s*\)/gi;

function hasRemoteImages(html: string): boolean {
  // .test() on a shared `g`-flag regex mutates lastIndex, so reset before
  // each use or repeated calls silently miss matches after the first.
  REMOTE_IMAGE_PATTERN.lastIndex = 0;
  REMOTE_BG_PATTERN.lastIndex = 0;
  return REMOTE_IMAGE_PATTERN.test(html) || REMOTE_BG_PATTERN.test(html);
}

function blockRemoteImages(html: string): string {
  return html
    .replace(REMOTE_IMAGE_PATTERN, (m) => ` data-blocked${m}`)
    .replace(REMOTE_SRCSET_PATTERN, (m) => ` data-blocked${m}`)
    .replace(REMOTE_BG_PATTERN, "none");
}

function EmailBodyFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);
  const [imagesAllowed, setImagesAllowed] = useState(false);

  const remoteImagesPresent = hasRemoteImages(html);
  const safeHtml = imagesAllowed ? html : blockRemoteImages(html);

  const doc = `<!doctype html><html><head><meta charset="utf-8" />
<base target="_blank" />
<style>
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.5; color: #1e293b; word-wrap: break-word; overflow-wrap: anywhere; }
  img { max-width: 100%; height: auto; }
  a { color: #2563eb; }
  table { max-width: 100%; }
</style>
</head><body>${stripScripts(safeHtml)}</body></html>`;

  return (
    <div>
      {remoteImagesPresent && !imagesAllowed && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0">Images are blocked to protect your privacy — senders can use them to track when you open an email.</span>
          <button
            type="button"
            onClick={() => setImagesAllowed(true)}
            className="shrink-0 self-start rounded-md border border-amber-500/40 bg-[#18191b] px-2.5 py-1 font-medium text-amber-300 transition hover:bg-amber-500/20 sm:self-auto"
          >
            Show images
          </button>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Email body"
        srcDoc={doc}
        sandbox="allow-same-origin allow-popups"
        onLoad={() => {
          const body = iframeRef.current?.contentDocument?.body;
          if (body) setHeight(body.scrollHeight + 16);
        }}
        style={{ width: "100%", height, border: "none" }}
      />
    </div>
  );
}

function EmailDetailSheet({
  email,
  onClose,
}: {
  email: ProcessedEmail;
  onClose: () => void;
}) {
  const [message, setMessage] = useState<GmailMessageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [submitting, setSubmitting] = useState<"send" | "schedule" | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMessage() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/emails/${encodeURIComponent(email.messageId)}`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as GmailMessageDetail;
        if (!cancelled) setMessage(data);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Couldn't load this email");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadMessage();
    return () => {
      cancelled = true;
    };
  }, [email.messageId]);

  async function draftWithAi() {
    setDrafting(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/emails/${encodeURIComponent(email.messageId)}/draft-reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = (await res.json()) as { body?: string };
      setReplyBody(data.body ?? "");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Couldn't draft a reply");
    } finally {
      setDrafting(false);
    }
  }

  async function submitReply(mode: "send" | "schedule") {
    if (!message || !replyBody.trim()) return;
    if (mode === "schedule" && !scheduledFor) {
      setSendError("Pick a date and time to schedule this reply.");
      return;
    }
    setSubmitting(mode);
    setSendError(null);
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: message.from,
          subject: message.subject.match(/^re:/i) ? message.subject : `Re: ${message.subject}`,
          body: replyBody,
          threadId: message.threadId,
          inReplyTo: message.messageIdHeader,
          ...(mode === "schedule" ? { sendAt: new Date(scheduledFor).toISOString() } : {}),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || `Error ${res.status}`);
      }
      setSendSuccess(mode === "schedule" ? "Scheduled reply added to Approvals." : "Reply added to Approvals.");
      setTimeout(onClose, 900);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Couldn't send this reply");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-[#2d2e31] bg-[#18191b] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#2d2e31] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {message?.subject || parseSummary(email.summary).subject || "Email"}
            </p>
            {message && (
              <p className="mt-0.5 truncate text-xs text-white/60">
                From {message.from} · {formatDate(message.date)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-white/80"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-12">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2d2e31] border-t-white" />
              <span className="text-sm text-white/60">Loading email…</span>
            </div>
          )}
          {!loading && loadError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
              {loadError}
            </div>
          )}
          {!loading && !loadError && message && (
            message.bodyHtml ? (
              <EmailBodyFrame html={message.bodyHtml} />
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-6 text-white/80">{message.body}</div>
            )
          )}
        </div>

        {!loading && !loadError && message && (
          <div className="border-t border-[#2d2e31] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-6 sm:pb-4">
            {!replyOpen ? (
              <button
                type="button"
                onClick={() => setReplyOpen(true)}
                className="rounded-md border border-[#2d2e31] bg-[#18191b] px-4 py-2 text-sm font-medium text-white/80 transition hover:border-[#3a3b3f] hover:text-white"
              >
                Reply
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/60">
                    Reply to {message.from}
                  </p>
                  <ActionButton
                    label="Draft with AI"
                    active={drafting}
                    done={false}
                    onClick={() => void draftWithAi()}
                  />
                </div>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={5}
                  placeholder="Write your reply, or draft one with AI…"
                  className="w-full resize-y rounded-xl border border-[#2d2e31] bg-[#18191b] p-3 text-sm text-white placeholder:text-white/40 focus:border-[#3a3b3f] focus:outline-none"
                />

                {sendError && <p className="text-sm text-red-300">{sendError}</p>}
                {sendSuccess && <p className="text-sm text-emerald-300">{sendSuccess}</p>}

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  {scheduling && (
                    <input
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className="w-full rounded-lg border border-[#2d2e31] px-3 py-2 text-sm text-white focus:border-[#3a3b3f] focus:outline-none sm:w-auto"
                    />
                  )}
                  <div className="flex gap-2 sm:contents">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 rounded-md border border-[#2d2e31] px-4 py-2 text-sm text-white/60 transition hover:text-white/80 sm:flex-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!replyBody.trim() || submitting !== null}
                      onClick={() =>
                        scheduling ? void submitReply("schedule") : setScheduling(true)
                      }
                      className="flex-1 rounded-md border border-[#3a3b3f] bg-[#18191b] px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-[#3a3b3f] disabled:opacity-40 sm:flex-none"
                    >
                      {submitting === "schedule" ? "Scheduling…" : "Schedule"}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={!replyBody.trim() || submitting !== null}
                    onClick={() => void submitReply("send")}
                    className="w-full rounded-md border border-[#D9BEF4] bg-[#D9BEF4] px-4 py-2 text-sm font-semibold text-[#1a1a1c] transition hover:brightness-95 disabled:opacity-40 sm:w-auto"
                  >
                    {submitting === "send" ? "Sending…" : "Send now"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function FollowupList({ tasks }: { tasks: EmailTask[] }) {
  return (
    <>
      <div className="hidden sm:block">
        <FollowupTable tasks={tasks} />
      </div>
      <div className="flex flex-col gap-2 sm:hidden">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-start gap-3 rounded-xl border border-[#2d2e31] bg-[#18191b] p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/80 leading-snug">{task.summary}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                  {task.status || "open"}
                </span>
                <span className="text-[11px] text-white/40">{task.source} · {timeAgo(task.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function FollowupTable({ tasks }: { tasks: EmailTask[] }) {
  return (
    <div className="overflow-x-auto bg-[#18191b]">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead className="bg-[#18191b] text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">
          <tr>
            <th className="px-4 py-3">Follow-up</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-t border-[#2d2e31] bg-[#18191b] transition hover:bg-white/[0.03]">
              <td className="px-4 py-4 text-sm text-white/80">{task.summary}</td>
              <td className="px-4 py-4 text-sm text-white/70">{task.source}</td>
              <td className="px-4 py-4">
                <span className="border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-300">
                  {task.status || "open"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-white/70">{timeAgo(task.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SentList({ emails }: { emails: SentEmail[] }) {
  return (
    <>
      <div className="hidden sm:block">
        <SentTable emails={emails} />
      </div>
      <div className="flex flex-col gap-2 sm:hidden">
        {emails.map((email) => (
          <div key={email.id} className="rounded-xl border border-[#2d2e31] bg-[#18191b] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-white">{email.to}</p>
              <span className="shrink-0 text-[11px] text-white/40">{formatDate(email.sentAt)}</span>
            </div>
            <p className="mt-0.5 truncate text-sm text-white/80">{email.subject}</p>
            <span className="mt-1.5 inline-block border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              {email.sample ? "Sample" : email.status}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function SentTable({ emails }: { emails: SentEmail[] }) {
  return (
    <div className="overflow-x-auto bg-[#18191b]">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead className="bg-[#18191b] text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">
          <tr>
            <th className="px-4 py-3">Recipient</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Sent</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((email) => (
            <tr key={email.id} className="border-t border-[#2d2e31] bg-[#18191b] transition hover:bg-white/[0.03]">
              <td className="px-4 py-4 text-sm text-white/80">{email.to}</td>
              <td className="px-4 py-4 text-sm text-white/80">{email.subject}</td>
              <td className="px-4 py-4">
                <span className="border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  {email.sample ? "Sample" : email.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-white/70">{formatDate(email.sentAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
          : "border-[#2d2e31] bg-[#18191b] text-white/70 hover:border-[#3a3b3f] hover:text-white"
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
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40" aria-hidden="true">
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
