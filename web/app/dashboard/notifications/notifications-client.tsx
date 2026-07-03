"use client";

import { useEffect, useState } from "react";

type NotificationEntry = {
  id: string;
  message: string;
  source: string;
  sentAt: string;
  sample?: boolean;
};

type NotificationTab = "all" | "reminder" | "digest" | "proactive";

const TABS: { key: NotificationTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "reminder", label: "Reminders" },
  { key: "digest", label: "Briefings" },
  { key: "proactive", label: "Proactive" },
];

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}

function sourceLabel(source: string) {
  if (source === "sample") return "Preview";
  if (source === "reminder") return "Reminder";
  if (source === "digest") return "Daily brief";
  if (source === "proactive") return "Proactive";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function formatRelative(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sampleTime(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

const SAMPLE_NOTIFICATIONS: NotificationEntry[] = [
  {
    id: "sample-notification-reminder",
    message: "Reminder: follow up with the design lead about tomorrow's product review.",
    source: "sample",
    sentAt: sampleTime(18),
    sample: true,
  },
  {
    id: "sample-notification-brief",
    message: "Daily brief sent: 3 meetings today, 2 open follow-ups, and no overdue reminders.",
    source: "sample",
    sentAt: sampleTime(95),
    sample: true,
  },
  {
    id: "sample-notification-proactive",
    message: "Riz noticed a meeting starts in 15 minutes and sent a prep reminder.",
    source: "sample",
    sentAt: sampleTime(240),
    sample: true,
  },
];

export function NotificationsClient() {
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NotificationTab>("all");
  const [query, setQuery] = useState("");

  async function load(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const data = (await response.json()) as { entries?: NotificationEntry[] };
      setEntries(data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const displayEntries = entries.length > 0 ? entries : SAMPLE_NOTIFICATIONS;
  const showingSamples = entries.length === 0;
  const counts: Record<NotificationTab, number> = {
    all: displayEntries.length,
    reminder: displayEntries.filter((entry) => entry.source === "reminder").length,
    digest: displayEntries.filter((entry) => entry.source === "digest").length,
    proactive: displayEntries.filter((entry) => entry.source === "proactive").length,
  };
  const tabFiltered =
    activeTab === "all"
      ? displayEntries
      : displayEntries.filter((entry) => entry.source === activeTab);
  const filteredEntries = query.trim()
    ? tabFiltered.filter(
        (entry) =>
          entry.message.toLowerCase().includes(query.toLowerCase()) ||
          sourceLabel(entry.source).toLowerCase().includes(query.toLowerCase()),
      )
    : tabFiltered;

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 px-6 pt-5">
        <div className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Messages Riz sent through reminders, briefings, and follow-ups
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <span className="border border-slate-200 px-3 py-1 text-sm text-slate-500">
                {displayEntries.length} item{displayEntries.length !== 1 ? "s" : ""}
              </span>
            )}
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading || refreshing}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-40"
            >
              <RefreshIcon spinning={refreshing} />
              Refresh
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notifications..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
          />
        </div>

        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                activeTab === key
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-600"
              }`}
            >
              {label}
              {!loading && counts[key] > 0 && (
                <span className={`rounded px-1.5 py-0.5 text-[11px] leading-none ${
                  activeTab === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="w-full px-6 py-6">
        {showingSamples && !loading && !error && (
          <div className="mb-4 rounded-xl border border-dashed border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            Preview notifications are shown below. Real reminders and briefings replace these once sent.
          </div>
        )}

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading ? (
            <NotificationSkeleton />
          ) : filteredEntries.length > 0 ? (
            <NotificationTable entries={filteredEntries} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <BellIcon className="h-6 w-6 text-slate-400" />
              </div>
              <p className="font-medium">No notifications found</p>
              <p className="max-w-xs text-sm text-slate-500">
                Try another search or switch tabs to see other notification types.
              </p>
            </div>
          )}
      </div>
    </main>
  );
}

function NotificationTable({ entries }: { entries: NotificationEntry[] }) {
  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead className="bg-white text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Message</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Sent</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <NotificationRow key={entry.id} entry={entry} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotificationRow({ entry }: { entry: NotificationEntry }) {
  return (
    <tr className="border-t border-slate-200 bg-white align-top transition hover:bg-slate-50">
      <td className="max-w-[620px] px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <BellIcon className="h-4 w-4" />
          </span>
          <p className="text-sm leading-6 text-slate-700">{entry.message}</p>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
          {sourceLabel(entry.source)}
        </span>
      </td>
      <td className="px-4 py-4">
        {entry.sample ? (
          <span className="border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
            Sample
          </span>
        ) : (
          <span className="border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Sent
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-slate-600">
        {formatRelative(entry.sentAt)}
      </td>
    </tr>
  );
}

function NotificationSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-50" />
      ))}
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 11a8 8 0 0 0-14.9-3M4 7V3m0 4h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13a8 8 0 0 0 14.9 3M20 17v4m0-4h-4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.6-2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
