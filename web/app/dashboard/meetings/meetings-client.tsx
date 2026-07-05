"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function chipLabel(offset: number, date: Date): string {
  if (offset === -1) return "Yesterday";
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function meetingEndMs(m: Meeting): number {
  if (m.end) return Date.parse(m.end);
  // No end: assume 1h after start; all-day events last through their day.
  if (m.start) {
    return m.allDay
      ? startOfDay(addDays(new Date(m.start), 1)).getTime()
      : Date.parse(m.start) + 60 * 60 * 1000;
  }
  return 0;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MeetingsClient() {
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));
  const [monthCache, setMonthCache] = useState<Record<string, Meeting[]>>({});
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [now, setNow] = useState<number>(() => Date.now());
  const [upcomingShown, setUpcomingShown] = useState(PAGE_SIZE);
  const [doneShown, setDoneShown] = useState(PAGE_SIZE);
  const fetchedMonths = useRef(new Set<string>());

  // Meetings auto-complete as their end time passes — tick twice a minute.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const mKey = monthKey(selected);

  useEffect(() => {
    if (fetchedMonths.current.has(mKey)) return;
    fetchedMonths.current.add(mKey);
    setLoadingMonth(mKey);
    setError(null);

    const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 0, 23, 59, 59);
    const params = new URLSearchParams({
      start: monthStart.toISOString(),
      end: monthEnd.toISOString(),
    });

    fetch(`/api/meetings?${params.toString()}`)
      .then((r) => r.json() as Promise<MeetingsPayload & { message?: string }>)
      .then((payload) => {
        if (!Array.isArray(payload.meetings)) {
          throw new Error(payload.message ?? "Failed to load meetings");
        }
        setConnected(payload.connected);
        setMonthCache((cache) => ({ ...cache, [mKey]: payload.meetings }));
      })
      .catch((err) => {
        fetchedMonths.current.delete(mKey);
        setError(err instanceof Error ? err.message : "Failed to load meetings");
      })
      .finally(() => setLoadingMonth((current) => (current === mKey ? null : current)));
  }, [mKey, selected]);

  // Reset pagination when the day changes.
  useEffect(() => {
    setUpcomingShown(PAGE_SIZE);
    setDoneShown(PAGE_SIZE);
  }, [selected]);

  const selectedKey = dayKey(selected);
  const dayMeetings = useMemo(() => {
    const monthMeetings = monthCache[mKey] ?? [];
    return monthMeetings.filter((m) => m.start && dayKey(new Date(m.start)) === selectedKey);
  }, [monthCache, mKey, selectedKey]);

  // Two timed meetings overlapping is a conflict worth flagging on both cards.
  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    const timed = dayMeetings.filter((m) => !m.allDay && m.start);
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
  }, [dayMeetings]);

  const upcoming = useMemo(
    () =>
      dayMeetings
        .filter((m) => meetingEndMs(m) > now)
        .sort((a, b) => Date.parse(a.start ?? "") - Date.parse(b.start ?? "")),
    [dayMeetings, now],
  );
  const completed = useMemo(
    () =>
      dayMeetings
        .filter((m) => meetingEndMs(m) <= now)
        .sort((a, b) => Date.parse(b.start ?? "") - Date.parse(a.start ?? "")),
    [dayMeetings, now],
  );

  const today = startOfDay(new Date());
  const chips = [-1, 0, 1, 2, 3].map((offset) => {
    const date = addDays(today, offset);
    return { offset, date, label: chipLabel(offset, date), key: dayKey(date) };
  });
  const selectedIsChip = chips.some((c) => c.key === selectedKey);
  const loading = loadingMonth === mKey && !monthCache[mKey];

  const headerDate = selected.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-white px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Meetings</h1>
            <p className="mt-0.5 text-sm text-slate-500">{headerDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedKey}
              onChange={(e) => {
                const picked = new Date(`${e.target.value}T00:00:00`);
                if (!Number.isNaN(picked.getTime())) setSelected(startOfDay(picked));
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700"
              aria-label="Jump to date"
            />
            <Link
              href="/dashboard/calendar?new=meeting"
              className="rounded-lg bg-[#FE7F2D] px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-105"
            >
              + Schedule
            </Link>
          </div>
        </div>

        {/* Day tabs: ‹ › walk one day at a time (previous meetings live to the left) */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelected((d) => addDays(d, -1))}
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
            aria-label="Previous day"
          >
            ‹
          </button>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setSelected(chip.date)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                chip.key === selectedKey
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {chip.label}
            </button>
          ))}
          {!selectedIsChip && (
            <span className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
              {selected.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          <button
            type="button"
            onClick={() => setSelected((d) => addDays(d, 1))}
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
            aria-label="Next day"
          >
            ›
          </button>
        </div>

        {error && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {!error && !connected && !loading && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            No meeting sources connected.{" "}
            <Link href="/dashboard/connectors" className="font-semibold text-[#FE7F2D] underline">
              Connect Google Calendar or Cal.com
            </Link>{" "}
            to see meetings here.
          </div>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading meetings…</p>
        ) : (
          <>
            <Section
              title="Upcoming"
              empty={connected ? "No upcoming meetings this day." : undefined}
              meetings={upcoming.slice(0, upcomingShown)}
              total={upcoming.length}
              onMore={() => setUpcomingShown((n) => n + PAGE_SIZE)}
              done={false}
              conflictIds={conflictIds}
            />
            <Section
              title="Completed"
              empty={completed.length === 0 && upcoming.length > 0 ? "Nothing finished yet." : undefined}
              meetings={completed.slice(0, doneShown)}
              total={completed.length}
              onMore={() => setDoneShown((n) => n + PAGE_SIZE)}
              done
              conflictIds={conflictIds}
            />
          </>
        )}
      </div>
    </main>
  );
}

function Section({
  title,
  meetings,
  total,
  empty,
  onMore,
  done,
  conflictIds,
}: {
  title: string;
  meetings: Meeting[];
  total: number;
  empty?: string;
  onMore: () => void;
  done: boolean;
  conflictIds: Set<string>;
}) {
  if (total === 0 && !empty) return null;
  return (
    <section className="mt-7">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
        <span className="text-xs font-normal text-slate-400">{total}</span>
      </h2>
      {total === 0 ? (
        <p className="mt-2 text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} done={done} conflict={!done && conflictIds.has(m.id)} />
          ))}
        </ul>
      )}
      {meetings.length < total && (
        <button
          type="button"
          onClick={onMore}
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Show more ({total - meetings.length} left)
        </button>
      )}
    </section>
  );
}

function MeetingCard({ meeting, done, conflict }: { meeting: Meeting; done: boolean; conflict?: boolean }) {
  const time = meeting.allDay
    ? "All day"
    : `${formatTime(meeting.start)}${meeting.end ? ` – ${formatTime(meeting.end)}` : ""}`;
  const attendees = meeting.attendees.slice(0, 3).join(", ");
  const extra = meeting.attendees.length - 3;

  return (
    <li
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
        done ? "border-slate-100 bg-slate-50 opacity-75" : "border-slate-200 bg-white"
      }`}
    >
      <div className="w-24 shrink-0 pt-0.5 text-xs font-medium text-slate-500">{time}</div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${done ? "text-slate-500 line-through" : "text-slate-900"}`}>
          {meeting.title}
        </p>
        {(attendees || meeting.location) && (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {attendees}
            {extra > 0 ? ` +${extra}` : ""}
            {attendees && meeting.location ? " · " : ""}
            {meeting.location}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {conflict && (
          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-600">
            Conflict
          </span>
        )}
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
            meeting.source === "calcom" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {meeting.source === "calcom" ? "Cal.com" : "Google"}
        </span>
        {done ? (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400">✓ Done</span>
        ) : (
          meeting.meetingUrl && (
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-[#FE7F2D] px-2.5 py-1 text-xs font-semibold text-white transition hover:brightness-105"
            >
              Join
            </a>
          )
        )}
      </div>
    </li>
  );
}
