"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CalendarEvent = {
  id: string;
  title: string;
  start?: string;
  end?: string;
  allDay: boolean;
  location?: string;
  hangoutLink?: string;
};

type Reminder = {
  id: string;
  message: string;
  recurring: boolean;
  runAt?: string;
  cron?: string;
  tz?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

type Task = {
  id: string;
  summary: string;
  source: string;
  status: string;
  createdAt: string;
};

type SubmitSuccess = {
  message: string;
  href?: string;
  linkLabel?: string;
};

type DialogTab = "reminder" | "meeting" | "mail";

type CalendarPayload = {
  connected: boolean;
  events: CalendarEvent[];
  reminders: Reminder[];
  tasks: Task[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CALENDAR_CACHE_PREFIX = "riz:calendar-dashboard:v2";

// AI-generated system reminders (morning briefs, meeting pre-alerts) should not
// appear as calendar items — those are internal Telegram notifications, not
// user-set reminders.
function filterUserReminders(reminders: Reminder[]): Reminder[] {
  return reminders.filter((r) => {
    const kind = r.metadata?.kind;
    if (r.source === "calendar") return false;
    if (kind === "morning_brief") return false;
    if (typeof kind === "string" && kind.startsWith("meeting_")) return false;
    return true;
  });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function greetingEmoji(): string {
  const h = new Date().getHours();
  if (h < 12) return "☀️";
  if (h < 17) return "🌤️";
  return "🌙";
}

// Text shades are dark (-700) for readability on this page's white/light
// backgrounds - a light shade (-300) reads fine on a dark UI but is nearly
// invisible here, which is exactly what made grid event chips unreadable.
const EVENT_COLORS = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-sky-50 text-sky-700 border-sky-200",
];

function eventColor(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return EVENT_COLORS[h % EVENT_COLORS.length];
}

function formatTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDialogDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function eventDateKey(ev: CalendarEvent) {
  const raw = ev.start ?? "";
  return raw ? (raw.includes("T") ? isoDate(new Date(raw)) : raw.slice(0, 10)) : null;
}

function reminderDateKey(r: Reminder) {
  return r.runAt ? isoDate(new Date(r.runAt)) : null;
}

function toISO(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}:00`).toISOString();
}

function calendarCacheKey(year: number, month: number) {
  return `${CALENDAR_CACHE_PREFIX}:${year}:${month}`;
}

// A transient backend hiccup (an outage, a provider error) can otherwise get
// cached as a false "this month has nothing" snapshot that then outlives the
// hiccup for the rest of the browser tab's session — cap how long a read is
// trusted instead of caching forever.
const CALENDAR_CACHE_TTL_MS = 2 * 60 * 1000;

type CachedCalendarPayload = CalendarPayload & { cachedAt: number };

function readCalendarCache(year: number, month: number): CalendarPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(calendarCacheKey(year, month));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedCalendarPayload;
    if (Date.now() - cached.cachedAt > CALENDAR_CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCalendarCache(year: number, month: number, payload: CalendarPayload) {
  if (typeof window === "undefined") return;
  try {
    const cached: CachedCalendarPayload = { ...payload, cachedAt: Date.now() };
    window.sessionStorage.setItem(calendarCacheKey(year, month), JSON.stringify(cached));
  } catch {
    // Ignore storage failures; the live fetch still keeps the page correct.
  }
}

function clearCalendarCache() {
  if (typeof window === "undefined") return;
  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(CALENDAR_CACHE_PREFIX)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Non-critical cache cleanup.
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CalendarClient() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(isoDate(today));

  // ── Dialog state ────────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<DialogTab>("reminder");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<SubmitSuccess | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reminder form
  const [remMessage, setRemMessage] = useState("");
  const [remWhen, setRemWhen] = useState("");

  // Meeting form
  const [mtgTitle, setMtgTitle] = useState("");
  const [mtgDate, setMtgDate] = useState("");
  const [mtgStartTime, setMtgStartTime] = useState("");
  const [mtgEndTime, setMtgEndTime] = useState("");
  const [mtgAttendees, setMtgAttendees] = useState<string[]>([]);
  const [mtgAttendeeInput, setMtgAttendeeInput] = useState("");
  const [mtgDescription, setMtgDescription] = useState("");
  // Set after a 409 conflict so the next submit can say "book it anyway".
  const [mtgConflict, setMtgConflict] = useState(false);
  // A changed slot is a new proposal — re-run the conflict check for it.
  useEffect(() => setMtgConflict(false), [mtgDate, mtgStartTime, mtgEndTime]);

  // Scheduled mail form
  const [mailTo, setMailTo] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [mailDate, setMailDate] = useState("");
  const [mailTime, setMailTime] = useState("");

  // ── Data fetching ───────────────────────────────────────────────────────────

  function applyCalendarPayload(payload: CalendarPayload) {
    setConnected(payload.connected);
    setEvents(payload.events);
    setReminders(filterUserReminders(payload.reminders));
    setTasks(payload.tasks);
  }

  async function fetchCalendarPayload(y: number, m: number): Promise<CalendarPayload> {
    const [calData, schedData] = await Promise.all([
      fetch(`/api/calendar?year=${y}&month=${m}`).then((r) => r.json()) as Promise<{
        connected?: boolean;
        events?: CalendarEvent[];
      }>,
      fetch("/api/scheduled").then((r) => r.json()) as Promise<{
        reminders?: Reminder[];
        tasks?: Task[];
      }>,
    ]);

    return {
      connected: calData.connected ?? true,
      events: calData.events ?? [],
      reminders: filterUserReminders(schedData.reminders ?? []),
      tasks: schedData.tasks ?? [],
    };
  }

  function loadData(y = year, m = month, options: { force?: boolean } = {}) {
    const cached = options.force ? null : readCalendarCache(y, m);
    if (cached) {
      applyCalendarPayload(cached);
      setLoading(false);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    fetchCalendarPayload(y, m)
      .then((payload) => {
        writeCalendarCache(y, m, payload);
        applyCalendarPayload(payload);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load calendar");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((d: { onboarding?: { telegramLinked?: boolean } }) => {
        setTelegramLinked(Boolean(d.onboarding?.telegramLinked));
      })
      .catch(() => setTelegramLinked(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = readCalendarCache(year, month);
    if (cached) {
      applyCalendarPayload(cached);
      setLoading(false);
      setLoadError(null);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setLoadError(null);
    fetchCalendarPayload(year, month)
      .then((payload) => {
        if (cancelled) return;
        writeCalendarCache(year, month, payload);
        applyCalendarPayload(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : "Failed to load calendar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [year, month]);

  // ── Dialog submit handlers ──────────────────────────────────────────────────

  async function submitReminder() {
    if (!remMessage.trim()) { setSubmitError("Tell Riz what to remind you about."); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const when = remWhen.trim();
      const chatMsg = when
        ? `Remind me to ${remMessage.trim()} — ${when}`
        : `Remind me to ${remMessage.trim()}`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: chatMsg }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to set reminder");
      setSubmitSuccess({ message: data.reply ?? "Reminder saved." });
      setRemMessage(""); setRemWhen("");
      clearCalendarCache();
      loadData(year, month, { force: true });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMeeting() {
    if (!mtgTitle.trim()) { setSubmitError("Title is required."); return; }
    if (!mtgDate || !mtgStartTime || !mtgEndTime) { setSubmitError("Date, start and end time are required."); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: mtgTitle.trim(),
          start: toISO(mtgDate, mtgStartTime),
          end: toISO(mtgDate, mtgEndTime),
          attendees: mtgAttendees,
          description: mtgDescription.trim() || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          ignoreConflict: mtgConflict,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; hangoutLink?: string; message?: string; code?: string };
      if (res.status === 409 && data.code === "conflict") {
        setMtgConflict(true);
        setSubmitError(`${data.message ?? "This slot clashes with another meeting."} Press "Create Anyway" to book it regardless.`);
        return;
      }
      if (!res.ok) throw new Error(data.message ?? "Failed to create meeting");
      setMtgConflict(false);
      setSubmitSuccess({
        message: data.hangoutLink
          ? "Meeting created. Google Meet link was added and sent to attendees."
          : "Meeting created on your calendar.",
        href: data.hangoutLink,
        linkLabel: "Open Meet link",
      });
      setMtgTitle(""); setMtgDate(""); setMtgStartTime(""); setMtgEndTime("");
      setMtgAttendees([]); setMtgAttendeeInput(""); setMtgDescription("");
      clearCalendarCache();
      loadData(year, month, { force: true });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMail() {
    if (!mailTo.trim() || !mailSubject.trim() || !mailBody.trim()) {
      setSubmitError("To, subject and body are required.");
      return;
    }
    if (!mailDate || !mailTime) { setSubmitError("Send date and time are required."); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/emails/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: mailTo.trim(),
          subject: mailSubject.trim(),
          body: mailBody.trim(),
          sendAt: toISO(mailDate, mailTime),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "Failed to schedule mail");
      }
      setSubmitSuccess({ message: "Email scheduled — Riz will send it then." });
      setMailTo(""); setMailSubject(""); setMailBody(""); setMailDate(""); setMailTime("");
      clearCalendarCache();
      loadData(year, month, { force: true });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function openDialog() {
    setDialogOpen(true);
    setSubmitSuccess(null);
    setSubmitError(null);
  }

  // Deep link from the Meetings page: /dashboard/calendar?new=meeting opens
  // the scheduling dialog on the meeting tab. window.location (not
  // useSearchParams) so the page needs no Suspense boundary.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "meeting") {
      setDialogTab("meeting");
      setDialogOpen(true);
    }
  }, []);

  function openDialogForDate(dateKey: string) {
    setSelectedDay(dateKey);
    setDialogTab("reminder");
    setRemWhen(`on ${formatDialogDate(dateKey)}`);
    setMtgDate(dateKey);
    setMailDate(dateKey);
    setDialogOpen(true);
    setSubmitSuccess(null);
    setSubmitError(null);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSubmitSuccess(null);
    setSubmitError(null);
  }

  function addAttendee(raw: string) {
    const email = raw.trim().replace(/,+$/, "");
    if (email && !mtgAttendees.includes(email)) {
      setMtgAttendees((prev) => [...prev, email]);
    }
    setMtgAttendeeInput("");
  }

  // ── Grid / display logic ────────────────────────────────────────────────────

  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - startOffset + 1;
      return dayNum < 1 || dayNum > daysInMonth ? null : new Date(year, month, dayNum);
    });
  }, [year, month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = eventDateKey(ev);
      if (!key) continue;
      map.set(key, [...(map.get(key) ?? []), ev]);
    }
    return map;
  }, [events]);

  const remindersByDay = useMemo(() => {
    const map = new Map<string, Reminder[]>();
    for (const r of reminders) {
      const key = reminderDateKey(r);
      if (!key) continue;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return map;
  }, [reminders]);

  const todayKey = isoDate(today);
  const selectedEvents = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : [];
  const selectedReminders = selectedDay ? (remindersByDay.get(selectedDay) ?? []) : [];
  const monthName = new Date(year, month).toLocaleString("default", { month: "long" });
  const hasLoadedItems = events.length > 0 || reminders.length > 0 || tasks.length > 0;
  const showInitialCalendarLoading = loading && !hasLoadedItems && connected;

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(todayKey);
  }

  const totalSelectedItems = selectedEvents.length + selectedReminders.length;

  return (
    <main className="flex min-h-screen flex-col bg-white text-slate-900">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-14 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold tracking-tight">
            {monthName} <span className="text-slate-500">{year}</span>
          </h1>
          <div className="flex items-center gap-1">
            <NavButton onClick={prevMonth} label="Previous month"><ChevronLeft /></NavButton>
            <NavButton onClick={nextMonth} label="Next month"><ChevronRight /></NavButton>
          </div>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-900"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 sm:flex">
            <LegendDot color="bg-blue-400" label="Calendar" />
            <LegendDot color="bg-amber-400" label="Reminders" />
            <LegendDot color="bg-violet-400" label="Tasks" />
          </div>
          {loading && (
            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="size-1.5 animate-pulse rounded-full bg-blue-300" />
              Loading meetings
            </span>
          )}
          {loadError && <span className="text-xs text-red-500">{loadError}</span>}

          {/* New button */}
          <button
            type="button"
            onClick={openDialog}
            className="flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <PlusIcon />
            New
          </button>
        </div>
      </header>

      {/* ── Telegram not linked warning ───────────────────────────────────── */}
      {telegramLinked === false && (
        <div className="flex items-center justify-between gap-4 border-b border-amber-500/20 bg-amber-500/8 px-6 py-2.5">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="text-amber-400">
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="M8 2L1.5 13.5h13L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-amber-800">
              Telegram isn&apos;t linked — reminders and notifications won&apos;t be delivered.
            </span>
          </div>
          <a
            href="/dashboard/telegram"
            className="shrink-0 rounded-md border border-amber-400 px-3 py-1 text-xs font-medium text-amber-800 transition hover:border-amber-500 hover:text-amber-900"
          >
            Link Telegram →
          </a>
        </div>
      )}

      {/* ── Daily briefing ────────────────────────────────────────────────── */}
      {connected && !loading && (
        <DailyBriefing
          todayEvents={eventsByDay.get(todayKey) ?? []}
          todayReminders={remindersByDay.get(todayKey) ?? []}
          onSelectToday={() => setSelectedDay(todayKey)}
        />
      )}

      {!connected ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <CalendarOffIcon />
          <p className="text-sm text-slate-400">Google Calendar isn&apos;t connected yet.</p>
          <Link
            href="/dashboard/connectors"
            className="rounded-lg bg-[#FE7F2D] px-4 py-2 text-sm font-medium text-white transition hover:brightness-105"
          >
            Connect Google
          </Link>
        </div>
      ) : (
        <div className="relative flex flex-1 overflow-hidden">
          {loading && (
            <div className="absolute left-0 right-0 top-0 z-20 border-b border-[#FE7F2D]/35 bg-[#FE7F2D]/12 px-6 py-3 text-sm font-semibold text-[#9A3D0E] backdrop-blur">
              <span className="inline-flex items-center gap-2 rounded-md border border-[#FE7F2D]/30 bg-white/80 px-3 py-1.5 shadow-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#FE7F2D]" />
                Syncing Google Calendar, reminders, and follow-ups...
              </span>
            </div>
          )}

          {/* ── Month grid ──────────────────────────────────────────────── */}
          <div className={`flex min-w-0 flex-1 flex-col overflow-auto ${loading ? "pt-10" : ""}`}>
            <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-slate-200 bg-white">
              {DAY_LABELS.map((d) => (
                <div key={d} className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  {d}
                </div>
              ))}
            </div>

            {showInitialCalendarLoading ? (
              <CalendarGridSkeleton cells={grid.length || 35} />
            ) : (
              <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(100px, auto)" }}>
                {grid.map((day, idx) => {
                  if (!day) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className={`border-b border-r border-slate-200 bg-white ${idx % 7 === 6 ? "border-r-0" : ""}`}
                      />
                    );
                  }

                  const key = isoDate(day);
                  const isToday = key === todayKey;
                  const isSelected = key === selectedDay;
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const dayReminders = remindersByDay.get(key) ?? [];
                  const totalItems = dayEvents.length + dayReminders.length;
                  const isCurrentMonth = day.getMonth() === month;

                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDay(isSelected ? null : key)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedDay(isSelected ? null : key);
                        }
                      }}
                      className={`group relative flex cursor-pointer flex-col gap-1 border-b border-r border-slate-200 p-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 ${
                        idx % 7 === 6 ? "border-r-0" : ""
                      } ${isSelected ? "bg-white" : "hover:bg-white"} ${!isCurrentMonth ? "opacity-35" : ""}`}
                    >
                      <button
                        type="button"
                        aria-label={`Create item on ${formatDialogDate(key)}`}
                        title={`Create on ${formatDialogDate(key)}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openDialogForDate(key);
                        }}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black text-white opacity-0 shadow-sm transition hover:bg-slate-800 focus:opacity-100 group-hover:opacity-100"
                      >
                        <PlusIcon />
                      </button>
                      <span
                        className={`mb-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-full text-xs font-semibold ${
                          isToday
                            ? "bg-[#FE7F2D] text-white"
                            : "text-slate-500 group-hover:text-slate-900"
                        }`}
                      >
                        {day.getDate()}
                      </span>

                      {dayEvents.slice(0, 2).map((ev) => (
                        <span
                          key={ev.id}
                          className={`truncate rounded border px-1.5 py-0.5 text-[10px] font-medium leading-4 ${eventColor(ev.title)}`}
                        >
                          {!ev.allDay && ev.start && (
                            <span className="mr-1 opacity-60">{formatTime(ev.start)}</span>
                          )}
                          {ev.title}
                        </span>
                      ))}

                      {dayReminders.slice(0, 1).map((r) => (
                        <span
                          key={r.id}
                          className="flex items-center gap-1 truncate rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-amber-800"
                        >
                          <BellDot />
                          {r.message}
                        </span>
                      ))}

                      {totalItems > 3 && (
                        <span className="px-1 text-[10px] text-slate-500">
                          +{totalItems - 3} more
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedDay && !showInitialCalendarLoading && (
              <section className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      {new Date(selectedDay + "T12:00:00").toLocaleDateString("default", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="mt-0.5 text-base font-semibold">
                      {totalSelectedItems === 0
                        ? "Nothing scheduled"
                        : `${totalSelectedItems} item${totalSelectedItems > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openDialogForDate(selectedDay)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-white"
                    aria-label={`Create item on ${formatDialogDate(selectedDay)}`}
                  >
                    <PlusIcon />
                  </button>
                </div>

                {totalSelectedItems === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                    Clear day
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedEvents.map((ev) => (
                      <div key={ev.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-blue-500/15">
                            <CalDot />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug text-slate-900">{ev.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {ev.allDay ? "All day" : `${formatTime(ev.start)} - ${formatTime(ev.end)}`}
                              {ev.location ? ` · ${ev.location}` : ""}
                            </p>
                            {ev.hangoutLink && (
                              <a
                                href={ev.hangoutLink}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                              >
                                <VideoIcon />
                                Join call
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {selectedReminders.map((r) => (
                      <div key={r.id} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-500/15">
                            <BellIcon />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">Reminder from Riz</p>
                            <p className="mt-0.5 text-sm leading-snug text-slate-900">{r.message}</p>
                            {r.runAt && (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {new Date(r.runAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                {r.tz ? ` · ${r.tz}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* ── Day detail panel ──────────────────────────────────────── */}
          {selectedDay && showInitialCalendarLoading ? (
            <CalendarAgendaSkeleton />
          ) : selectedDay && (
            <aside className="hidden w-72 shrink-0 flex-col border-l border-slate-200 lg:flex">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("default", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="mt-0.5 text-lg font-semibold">
                  {totalSelectedItems === 0
                    ? "Nothing scheduled"
                    : `${totalSelectedItems} item${totalSelectedItems > 1 ? "s" : ""}`}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                {totalSelectedItems === 0 ? (
                  <p className="mt-6 text-center text-sm text-slate-500">Clear day</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedEvents.map((ev) => (
                      <div key={ev.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-blue-500/15">
                            <CalDot />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug text-slate-900">{ev.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {ev.allDay ? "All day" : `${formatTime(ev.start)} – ${formatTime(ev.end)}`}
                              {ev.location ? ` · ${ev.location}` : ""}
                            </p>
                            {ev.hangoutLink && (
                              <a
                                href={ev.hangoutLink}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                              >
                                <VideoIcon />
                                Join call
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {selectedReminders.map((r) => (
                      <div key={r.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-500/15">
                            <BellIcon />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-500/70">Reminder from Riz</p>
                            <p className="mt-0.5 text-sm leading-snug text-slate-900">{r.message}</p>
                            {r.runAt && (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {new Date(r.runAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                {r.tz ? ` · ${r.tz}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tasks.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Open follow-ups
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {tasks.slice(0, 5).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                        >
                          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-violet-500/40 bg-violet-500/10">
                            <TaskDot />
                          </span>
                          <p className="text-xs leading-5 text-slate-400">{task.summary}</p>
                        </div>
                      ))}
                      {tasks.length > 5 && (
                        <Link
                          href="/dashboard/scheduled"
                          className="mt-1 text-center text-xs text-slate-500 hover:text-slate-400"
                        >
                          +{tasks.length - 5} more in Scheduled
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* ── Scheduling dialog ─────────────────────────────────────────────── */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Dialog header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold">Schedule something</h2>
              <button
                type="button"
                onClick={closeDialog}
                className="flex size-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-slate-200 px-6">
              {(["reminder", "meeting", "mail"] as DialogTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setDialogTab(tab); setSubmitError(null); setSubmitSuccess(null); }}
                  className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium capitalize transition ${
                    dialogTab === tab
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-400"
                  }`}
                >
                  {tab === "mail" ? "Scheduled Mail" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Success banner */}
            {submitSuccess && (
              <div className="mx-6 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <span>{submitSuccess.message}</span>
                {submitSuccess.href && (
                  <a
                    href={submitSuccess.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-emerald-950 underline decoration-emerald-400 underline-offset-2"
                  >
                    {submitSuccess.linkLabel ?? "Open link"}
                  </a>
                )}
              </div>
            )}

            {/* Error banner */}
            {submitError && (
              <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {/* ── Reminder tab ─────────────────────────────────────────── */}
            {dialogTab === "reminder" && (
              <div className="flex flex-col gap-4 px-6 py-5">
                {telegramLinked === false && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
                    <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true">
                      <path d="M8 2L1.5 13.5h13L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                      <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <p className="text-xs leading-5 text-amber-800">
                      Telegram isn&apos;t linked yet.{" "}
                      <a href="/dashboard/telegram" className="font-semibold underline underline-offset-2 hover:text-amber-900">
                        Connect it
                      </a>{" "}
                      so Riz can actually deliver this reminder to you.
                    </p>
                  </div>
                )}
                <Field label="What should Riz remind you about?">
                  <textarea
                    rows={3}
                    placeholder="e.g. Follow up with Priya about the invoice"
                    value={remMessage}
                    onChange={(e) => setRemMessage(e.target.value)}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-300"
                  />
                </Field>
                <Field label="When?">
                  <input
                    type="text"
                    placeholder="e.g. every day at 7pm · tomorrow at 9am · next Friday"
                    value={remWhen}
                    onChange={(e) => setRemWhen(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-300"
                  />
                </Field>
                <p className="text-xs text-slate-500">
                  Riz understands plain English — just say when you want to be reminded.
                </p>
                <DialogFooter onCancel={closeDialog} onSubmit={submitReminder} submitting={submitting} label="Set Reminder" />
              </div>
            )}

            {/* ── Meeting tab ───────────────────────────────────────────── */}
            {dialogTab === "meeting" && (
              <div className="flex flex-col gap-4 px-6 py-5">
                <Field label="Title">
                  <input
                    type="text"
                    placeholder="e.g. Q3 review with design team"
                    value={mtgTitle}
                    onChange={(e) => setMtgTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-300"
                  />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Date">
                    <input
                      type="date"
                      value={mtgDate}
                      onChange={(e) => setMtgDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300 [color-scheme:dark]"
                    />
                  </Field>
                  <Field label="Start">
                    <input
                      type="time"
                      value={mtgStartTime}
                      onChange={(e) => setMtgStartTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300 [color-scheme:dark]"
                    />
                  </Field>
                  <Field label="End">
                    <input
                      type="time"
                      value={mtgEndTime}
                      onChange={(e) => setMtgEndTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300 [color-scheme:dark]"
                    />
                  </Field>
                </div>

                {/* Attendees */}
                <Field label="Attendees">
                  <div className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 flex flex-wrap gap-1.5">
                    {mtgAttendees.map((a) => (
                      <span key={a} className="flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs text-slate-900">
                        {a}
                        <button
                          type="button"
                          onClick={() => setMtgAttendees((prev) => prev.filter((x) => x !== a))}
                          className="ml-0.5 text-slate-500 hover:text-slate-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="email"
                      placeholder={mtgAttendees.length === 0 ? "Type email, press Enter" : ""}
                      value={mtgAttendeeInput}
                      onChange={(e) => setMtgAttendeeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addAttendee(mtgAttendeeInput);
                        }
                      }}
                      onBlur={() => { if (mtgAttendeeInput.includes("@")) addAttendee(mtgAttendeeInput); }}
                      className="min-w-[140px] flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                    />
                  </div>
                </Field>

                <Field label="Description (optional)">
                  <textarea
                    rows={2}
                    placeholder="Agenda, links, notes…"
                    value={mtgDescription}
                    onChange={(e) => setMtgDescription(e.target.value)}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-300"
                  />
                </Field>

                <p className="text-xs text-slate-500">
                  A Google Meet link will be created and attendees emailed automatically. Riz will send you a Telegram reminder 15 min before.
                </p>

                <DialogFooter onCancel={closeDialog} onSubmit={submitMeeting} submitting={submitting} label={mtgConflict ? "Create Anyway" : "Create Meeting"} />
              </div>
            )}

            {/* ── Scheduled Mail tab ────────────────────────────────────── */}
            {dialogTab === "mail" && (
              <div className="flex flex-col gap-4 px-6 py-5">
                <Field label="To">
                  <input
                    type="email"
                    placeholder="recipient@example.com"
                    value={mailTo}
                    onChange={(e) => setMailTo(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-300"
                  />
                </Field>
                <Field label="Subject">
                  <input
                    type="text"
                    placeholder="Email subject line"
                    value={mailSubject}
                    onChange={(e) => setMailSubject(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-300"
                  />
                </Field>
                <Field label="Body">
                  <textarea
                    rows={4}
                    placeholder="Write the email body…"
                    value={mailBody}
                    onChange={(e) => setMailBody(e.target.value)}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-300"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Send on">
                    <input
                      type="date"
                      value={mailDate}
                      onChange={(e) => setMailDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300 [color-scheme:dark]"
                    />
                  </Field>
                  <Field label="At">
                    <input
                      type="time"
                      value={mailTime}
                      onChange={(e) => setMailTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300 [color-scheme:dark]"
                    />
                  </Field>
                </div>
                <p className="text-xs text-slate-500">
                  Riz will draft and send this email at the scheduled time via your connected Gmail.
                </p>
                <DialogFooter onCancel={closeDialog} onSubmit={submitMail} submitting={submitting} label="Schedule Email" />
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function DailyBriefing({
  todayEvents,
  todayReminders,
  onSelectToday,
}: {
  todayEvents: CalendarEvent[];
  todayReminders: Reminder[];
  onSelectToday: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const totalItems = todayEvents.length + todayReminders.length;
  const now = new Date();

  // Find the next upcoming event today
  const upcomingEvents = todayEvents
    .filter((ev) => ev.start && new Date(ev.start) > now)
    .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime());

  const nextEvent = upcomingEvents[0];
  const minsUntilNext = nextEvent?.start
    ? Math.round((new Date(nextEvent.start).getTime() - now.getTime()) / 60000)
    : null;

  return (
    <div className="border-b border-slate-200 bg-gradient-to-r from-slate-100 via-slate-100 to-slate-100 px-6 py-4">
      <div className="mx-auto flex max-w-none items-start justify-between gap-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl leading-none" aria-hidden="true">
            {greetingEmoji()}
          </span>
          <div>
            <p className="text-base font-semibold text-slate-900">
              {greeting()} —{" "}
              {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            </p>

            {totalItems === 0 ? (
              <p className="mt-0.5 text-sm text-slate-500">Nothing on your calendar today. Enjoy the clear day.</p>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {/* Today's event count */}
                {todayEvents.length > 0 && (
                  <button
                    type="button"
                    onClick={onSelectToday}
                    className="flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-900"
                  >
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                    {todayEvents.length} meeting{todayEvents.length > 1 ? "s" : ""} today
                  </button>
                )}

                {/* Reminders today */}
                {todayReminders.length > 0 && (
                  <button
                    type="button"
                    onClick={onSelectToday}
                    className="flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-900"
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    {todayReminders.length} reminder{todayReminders.length > 1 ? "s" : ""}
                  </button>
                )}

                {/* Next up pill */}
                {nextEvent && minsUntilNext !== null && minsUntilNext >= 0 && minsUntilNext <= 120 && (
                  <span className="flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                    {minsUntilNext <= 5
                      ? `${nextEvent.title} starting now`
                      : `${nextEvent.title} in ${minsUntilNext} min`}
                  </span>
                )}
              </div>
            )}

            {/* Today's events inline preview */}
            {todayEvents.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {todayEvents.slice(0, 4).map((ev) => (
                  <span
                    key={ev.id}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-400"
                  >
                    {!ev.allDay && ev.start && (
                      <span className="text-slate-500">{formatTime(ev.start)}</span>
                    )}
                    <span className="truncate max-w-[140px]">{ev.title}</span>
                    {ev.hangoutLink && (
                      <a
                        href={ev.hangoutLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-0.5 text-blue-600 transition hover:text-blue-700"
                        title="Join call"
                      >
                        <VideoIcon />
                      </a>
                    )}
                  </span>
                ))}
                {todayEvents.length > 4 && (
                  <button
                    type="button"
                    onClick={onSelectToday}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500 transition hover:text-slate-400"
                  >
                    +{todayEvents.length - 4} more
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-400"
          title="Dismiss"
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function CalendarGridSkeleton({ cells }: { cells: number }) {
  return (
    <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(100px, auto)" }}>
      {Array.from({ length: cells }, (_, idx) => (
        <div
          key={`calendar-loading-${idx}`}
          className={`min-h-[100px] border-b border-r border-slate-200 bg-white p-2 ${
            idx % 7 === 6 ? "border-r-0" : ""
          }`}
        >
          <div className="mb-4 h-5 w-5 animate-pulse rounded-full bg-slate-100" />
          <div className="space-y-2">
            {idx % 3 !== 0 && <div className="h-4 w-4/5 animate-pulse rounded-sm bg-blue-300/15" />}
            {idx % 4 === 0 && <div className="h-4 w-2/3 animate-pulse rounded-sm bg-amber-300/15" />}
            {idx % 5 === 0 && <div className="h-4 w-1/2 animate-pulse rounded-sm bg-violet-300/15" />}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarAgendaSkeleton() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-slate-200 lg:flex">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="h-3 w-32 animate-pulse rounded-sm bg-slate-100" />
        <div className="mt-3 h-6 w-40 animate-pulse rounded-sm bg-white/15" />
      </div>
      <div className="flex-1 space-y-3 px-4 py-3">
        {Array.from({ length: 4 }, (_, idx) => (
          <div key={`agenda-loading-${idx}`} className="border border-slate-200 bg-white px-4 py-3">
            <div className="flex gap-3">
              <div className="size-5 shrink-0 animate-pulse rounded-sm bg-blue-300/15" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-4/5 animate-pulse rounded-sm bg-white/15" />
                <div className="h-3 w-1/2 animate-pulse rounded-sm bg-slate-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ── Shared dialog sub-components ──────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function DialogFooter({
  onCancel,
  onSubmit,
  submitting,
  label,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
  label: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-900"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="rounded-lg bg-[#FE7F2D] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
      >
        {submitting ? "Saving…" : label}
      </button>
    </div>
  );
}

// ── Small calendar sub-components ────────────────────────────────────────────

function NavButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className={`size-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
function BellDot() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
function CalDot() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400" aria-hidden="true">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
function TaskDot() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function CalendarOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300" aria-hidden="true">
      <path d="M4.2 4.2A2 2 0 0 0 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 1.82-1.18" /><path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 10h4.93" /><path d="M21 10H11" /><path d="m21 21-18-18" />
    </svg>
  );
}
