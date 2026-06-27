"use client";

import { useEffect, useState } from "react";

type NotificationEntry = {
  id: string;
  message: string;
  source: string;
  sentAt: string;
};

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}

function sourceLabel(source: string) {
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

export function NotificationsClient() {
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d: { entries?: NotificationEntry[] }) => setEntries(d.entries ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#1a1a19] px-4 py-8 text-[#f2f1ec] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-white/50">Messages HeyRiz sent you recently</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center text-white/40">
            <BellIcon className="h-10 w-10 opacity-30" />
            <p className="text-sm">No notifications yet</p>
            <p className="text-xs text-white/25">Reminders and briefings will appear here once sent</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[15px] leading-relaxed text-white/90">{entry.message}</p>
                  <span className="mt-0.5 shrink-0 text-[12px] text-white/30">
                    {formatRelative(entry.sentAt)}
                  </span>
                </div>
                <span className="mt-2 inline-flex items-center rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/40">
                  {sourceLabel(entry.source)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
