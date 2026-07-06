"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Meeting = {
  id: string;
  title: string;
  start?: string;
  end?: string;
  allDay: boolean;
  location?: string;
  meetingUrl?: string;
  attendees: string[];
  source: "google" | "calcom";
  status?: string;
};

type MeetingsPayload = {
  connected: boolean;
  googleConnected: boolean;
  meetings: Meeting[];
};

type MeetingTab = "today" | "upcoming" | "past" | "all";

const TABS: { key: MeetingTab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

const PAGE_SIZE = 10;
// Wide enough to cover "previous meetings" history and a solid upcoming
// horizon in one fetch; Refresh re-pulls the same window on demand.
const WINDOW_DAYS_BACK = 60;
const WINDOW_DAYS_FORWARD = 120;

const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-300",
  "bg-violet-500/20 text-violet-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-amber-500/20 text-amber-300",
  "bg-rose-500/20 text-rose-300",
  "bg-cyan-500/20 text-cyan-300",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatarColor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function initials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "M";
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function groupByDate(meetings: Meeting[]): { dayKey: string; label: string; meetings: Meeting[] }[] {
  const groups = new Map<string, Meeting[]>();
  for (const m of meetings) {
    if (!m.start) continue;
    const key = dayKey(new Date(m.start));
    const bucket = groups.get(key) ?? [];
    bucket.push(m);
    groups.set(key, bucket);
  }
  const today = startOfDay(new Date()).getTime();
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, list]) => {
      const diffDays = Math.round((new Date(key).getTime() - today) / 86_400_000);
      const label =
        diffDays === 0
          ? "Today"
          : diffDays === 1
            ? "Tomorrow"
            : new Date(key).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              });
      return { dayKey: key, label, meetings: list };
    });
}

function meetingEndMs(m: Meeting): number {
  if (m.end) return Date.parse(m.end);
  if (m.start) {
    return m.allDay
      ? startOfDay(new Date(new Date(m.start).getTime() + 86_400_000)).getTime()
      : Date.parse(m.start) + 60 * 60 * 1000;
  }
  return 0;
}

function formatDateTime(m: Meeting): { date: string; time: string } {
  if (!m.start) return { date: "—", time: "" };
  const d = new Date(m.start);
  const diffDays = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  const date =
    diffDays === 0
      ? "Today"
      : diffDays === 1
        ? "Tomorrow"
        : diffDays === -1
          ? "Yesterday"
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = m.allDay
    ? "All day"
    : `${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${
        m.end ? ` – ${new Date(m.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""
      }`;
  return { date, time };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MeetingsClient() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [connected, setConnected] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<MeetingTab>("today");
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const start = new Date(Date.now() - WINDOW_DAYS_BACK * 86_400_000);
      const end = new Date(Date.now() + WINDOW_DAYS_FORWARD * 86_400_000);
      const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
      const res = await fetch(`/api/meetings?${params.toString()}`);
      const payload = (await res.json()) as MeetingsPayload & { message?: string };
      if (!Array.isArray(payload.meetings)) throw new Error(payload.message ?? "Failed to load meetings");
      setMeetings(payload.meetings);
      setConnected(payload.connected);
      setGoogleConnected(payload.googleConnected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load meetings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setPage(1), [activeTab, query]);

  const todayKey = dayKey(new Date());

  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    const timed = meetings.filter((m) => !m.allDay && m.start);
    for (let i = 0; i < timed.length; i++) {
      for (let j = i + 1; j < timed.length; j++) {
        const aStart = Date.parse(timed[i].start!);
        const aEnd = meetingEndMs(timed[i]);
        const bStart = Date.parse(timed[j].start!);
        const bEnd = meetingEndMs(timed[j]);
        if (aStart < bEnd && bStart < aEnd) {
          ids.add(timed[i].id);
          ids.add(timed[j].id);
        }
      }
    }
    return ids;
  }, [meetings]);

  const counts = useMemo(() => {
    const today = meetings.filter((m) => m.start && dayKey(new Date(m.start)) === todayKey);
    const upcoming = meetings.filter((m) => meetingEndMs(m) > now);
    const past = meetings.filter((m) => meetingEndMs(m) <= now);
    return { today: today.length, upcoming: upcoming.length, past: past.length, all: meetings.length };
  }, [meetings, now, todayKey]);

  const tabbed = useMemo(() => {
    let list: Meeting[];
    if (activeTab === "today") {
      list = meetings.filter((m) => m.start && dayKey(new Date(m.start)) === todayKey);
      // Upcoming-first, then completed below — matches how the day plays out.
      list = [...list].sort((a, b) => {
        const aDone = meetingEndMs(a) <= now;
        const bDone = meetingEndMs(b) <= now;
        if (aDone !== bDone) return aDone ? 1 : -1;
        return aDone
          ? meetingEndMs(b) - meetingEndMs(a)
          : Date.parse(a.start ?? "") - Date.parse(b.start ?? "");
      });
    } else if (activeTab === "upcoming") {
      list = meetings
        .filter((m) => meetingEndMs(m) > now)
        .sort((a, b) => Date.parse(a.start ?? "") - Date.parse(b.start ?? ""));
    } else if (activeTab === "past") {
      list = meetings
        .filter((m) => meetingEndMs(m) <= now)
        .sort((a, b) => meetingEndMs(b) - meetingEndMs(a));
    } else {
      list = [...meetings].sort((a, b) => Date.parse(a.start ?? "") - Date.parse(b.start ?? ""));
    }
    return list;
  }, [meetings, activeTab, now, todayKey]);

  const filtered = query.trim()
    ? tabbed.filter(
        (m) =>
          m.title.toLowerCase().includes(query.toLowerCase()) ||
          m.attendees.some((a) => a.toLowerCase().includes(query.toLowerCase())) ||
          m.location?.toLowerCase().includes(query.toLowerCase()),
      )
    : tabbed;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 px-6 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Meetings</h1>
            <p className="mt-0.5 text-sm text-slate-500">Google Calendar and Cal.com, in one place</p>
          </div>
          <div className="flex items-center gap-2">
            {!loading && (
              <span className="rounded border border-slate-200 px-3 py-1 text-sm text-slate-500">
                {meetings.length} meeting{meetings.length !== 1 ? "s" : ""}
              </span>
            )}
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-40"
            >
              <RefreshIcon spinning={refreshing} />
              Refresh
            </button>
            <Link
              href="/dashboard/calendar?new=meeting"
              className="rounded-lg bg-[#FE7F2D] px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-105"
            >
              + Schedule
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, attendee, or location…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-600"
              }`}
            >
              {tab.label}
              {!loading && counts[tab.key] > 0 && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] leading-none ${
                    activeTab === tab.key ? "bg-[#FE7F2D]/10 text-[#FE7F2D]" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="w-full px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <span className="text-sm text-slate-500">Loading meetings…</span>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && !connected && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <MeetingIcon />
            </div>
            <p className="font-medium">No meeting sources connected</p>
            <p className="max-w-xs text-sm text-slate-500">
              Connect Google Calendar or Cal.com so Riz can build this list from your real schedule.
            </p>
            <Link
              href="/dashboard/connectors"
              className="mt-2 inline-flex items-center justify-center rounded-md border border-[#FE7F2D] bg-[#FE7F2D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e96f24]"
            >
              Connect a calendar
            </Link>
          </div>
        )}

        {!loading && !error && connected && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <MeetingIcon />
            </div>
            <p className="font-medium">{query ? "No matches" : "Nothing here"}</p>
            <p className="max-w-xs text-sm text-slate-500">
              {query
                ? "Try a different title, attendee, or location."
                : activeTab === "today"
                  ? "No meetings today."
                  : activeTab === "upcoming"
                    ? "No upcoming meetings in the next few months."
                    : activeTab === "past"
                      ? "No past meetings on record yet."
                      : "No meetings found."}
            </p>
            {!googleConnected && (
              <a
                href="/api/connectors/gmail/start?returnTo=%2Fdashboard%2Fmeetings"
                className="mt-2 inline-flex items-center justify-center rounded-md border border-[#FE7F2D] bg-[#FE7F2D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e96f24]"
              >
                Connect Google Calendar
              </a>
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && activeTab === "upcoming" && (
          <MeetingsAgenda meetings={filtered} now={now} conflictIds={conflictIds} />
        )}

        {!loading && !error && filtered.length > 0 && activeTab !== "upcoming" && (
          <>
            <MeetingsTable meetings={pageItems} now={now} conflictIds={conflictIds} />
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Page {page} of {totalPages} · {filtered.length} meeting{filtered.length !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ‹ Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ── Agenda (date-grouped upcoming view) ────────────────────────────────────────

function MeetingsAgenda({
  meetings,
  now,
  conflictIds,
}: {
  meetings: Meeting[];
  now: number;
  conflictIds: Set<string>;
}) {
  const groups = useMemo(() => groupByDate(meetings), [meetings]);

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group, i) => (
        <section key={group.dayKey}>
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{group.label}</h2>
            <span className="text-xs text-slate-400">
              {group.meetings.length} meeting{group.meetings.length !== 1 ? "s" : ""}
            </span>
            {i === 0 && (
              <span className="rounded bg-[#FE7F2D]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#FE7F2D]">
                Next up
              </span>
            )}
          </div>
          <MeetingsTable meetings={group.meetings} now={now} conflictIds={conflictIds} />
        </section>
      ))}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

function MeetingsTable({
  meetings,
  now,
  conflictIds,
}: {
  meetings: Meeting[];
  now: number;
  conflictIds: Set<string>;
}) {
  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[1050px] border-collapse text-left">
        <thead className="bg-white text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Meeting</th>
            <th className="px-4 py-3">Attendees</th>
            <th className="px-4 py-3">Date &amp; time</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {meetings.map((m) => (
            <MeetingRow key={m.id} meeting={m} now={now} conflict={conflictIds.has(m.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MeetingRow({ meeting, now, conflict }: { meeting: Meeting; now: number; conflict: boolean }) {
  const color = avatarColor(meeting.id);
  const done = meetingEndMs(meeting) <= now;
  const { date, time } = formatDateTime(meeting);
  const attendeesShown = meeting.attendees.slice(0, 2).join(", ");
  const extra = meeting.attendees.length - 2;

  return (
    <tr className={`border-t border-slate-200 bg-white align-top transition hover:bg-slate-50 ${done ? "opacity-70" : ""}`}>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${color}`}>
            {initials(meeting.title)}
          </span>
          <div className="min-w-0">
            <p className={`truncate text-sm font-medium ${done ? "text-slate-500 line-through" : "text-slate-900"}`}>
              {meeting.title}
            </p>
            {conflict && !done && (
              <span className="mt-0.5 inline-block rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                Conflict
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        {meeting.attendees.length > 0 ? (
          <p className="max-w-[220px] truncate text-sm text-slate-700">
            {attendeesShown}
            {extra > 0 ? ` +${extra}` : ""}
          </p>
        ) : (
          <p className="text-sm text-slate-400">—</p>
        )}
      </td>
      <td className="px-4 py-4 text-sm text-slate-700">
        <p>{date}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{time}</p>
      </td>
      <td className="max-w-[200px] px-4 py-4">
        <p className="truncate text-sm text-slate-700">{meeting.location || "—"}</p>
      </td>
      <td className="px-4 py-4">
        <span
          className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
            meeting.source === "calcom"
              ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-600"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
          }`}
        >
          {meeting.source === "calcom" ? "Cal.com" : "Google"}
        </span>
      </td>
      <td className="px-4 py-4 text-right">
        {done ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase text-slate-400">
            <CheckIcon /> Done
          </span>
        ) : meeting.meetingUrl ? (
          <a
            href={meeting.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-lg bg-[#FE7F2D] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-105"
          >
            Join
          </a>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

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

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13.5 8a5.5 5.5 0 1 1-1.6-3.89M13.5 2v3.2h-3.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MeetingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[22px] w-[22px] text-slate-400" aria-hidden="true">
      <rect x="2.5" y="5" width="13" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15.5 10l4.8-3v10l-4.8-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
