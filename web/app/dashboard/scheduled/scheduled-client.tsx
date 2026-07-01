"use client";

import { useEffect, useMemo, useState } from "react";

type PrincipalTask = {
  id: string;
  summary: string;
  source: string;
  status: string;
  createdAt: string;
};

type ScheduledReminder = {
  id: string;
  message: string;
  recurring: boolean;
  state: "upcoming" | "fired" | "failed";
  runAt?: string;
  firedAt?: string;
  cron?: string;
  tz?: string;
};

type ScheduleTab = "all" | "active" | "today" | "week" | "reminders" | "followups" | "priority" | "history";

type ScheduleRow = {
  id: string;
  rawId: string;
  type: "Reminder" | "Follow-up";
  title: string;
  detail: string;
  priority: "High" | "Medium" | "Low";
  dueAt?: string;
  createdAt?: string;
  source: string;
  status: string;
  state: "active" | "done" | "fired" | "failed";
  recurring?: boolean;
  cron?: string;
  tz?: string;
  sample?: boolean;
};

const TABS: { key: ScheduleTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "reminders", label: "Reminders" },
  { key: "followups", label: "Follow-ups" },
  { key: "priority", label: "Priority" },
  { key: "history", label: "History" },
];

const HIGH_WORDS = ["urgent", "asap", "today", "now", "important", "critical", "deadline", "payment", "invoice"];
const MEDIUM_WORDS = ["follow", "reply", "call", "meeting", "review", "send", "check"];

export function ScheduledClient() {
  const [tasks, setTasks] = useState<PrincipalTask[]>([]);
  const [reminders, setReminders] = useState<ScheduledReminder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ScheduleTab>("all");
  const [query, setQuery] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  async function load(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/scheduled");
      if (!response.ok) throw new Error("Failed to load scheduled items");
      const data = (await response.json()) as {
        tasks?: PrincipalTask[];
        reminders?: ScheduledReminder[];
        error?: string;
      };
      if (data.error) throw new Error(data.error);
      setTasks(data.tasks ?? []);
      setReminders(data.reminders ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load scheduled items");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => buildRows(reminders, tasks), [reminders, tasks]);
  const counts = useMemo(() => buildCounts(rows), [rows]);

  const displayedRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows
      .filter((row) => matchesTab(row, activeTab))
      .filter((row) => {
        if (!normalizedQuery) return true;
        return [row.title, row.detail, row.source, row.status, row.type, row.priority]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });
  }, [activeTab, query, rows]);

  function openCreate() {
    setCreateMessage("");
    setCreateError(null);
    setCreateOpen(true);
  }

  async function submitCreate() {
    if (!createMessage.trim()) {
      setCreateError("Tell Riz what to remind you about.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: createMessage.trim() }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to schedule reminder");
      setCreateOpen(false);
      await load(true);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to schedule reminder");
    } finally {
      setCreating(false);
    }
  }

  async function markTaskDone(row: ScheduleRow) {
    setActioning(row.id);
    try {
      await fetch(`/api/tasks/${row.rawId}/done`, { method: "POST" });
      await load(true);
    } finally {
      setActioning(null);
    }
  }

  async function cancelReminder(row: ScheduleRow) {
    setActioning(row.id);
    try {
      await fetch(`/api/reminders/${row.rawId}`, { method: "DELETE" });
      await load(true);
    } finally {
      setActioning(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#1a1a19] text-[#f2f1ec]">
      <header className="border-b border-[#2e2e2c] bg-[#1a1a19] px-6 pt-5">
        <div className="flex items-center justify-between gap-4 pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Scheduled</h1>
            <p className="mt-0.5 text-sm text-white/55">
              Reminders, follow-ups and priorities Riz is tracking
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-2 rounded-md border border-[#2e2e2c] bg-[#1f1f1e] px-3 py-1.5 text-sm text-white/65 transition hover:border-[#3e3e3c] hover:text-[#f2f1ec] disabled:opacity-40"
            >
              <RefreshIcon spinning={refreshing} />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-2 rounded-md bg-[#f2f1ec] px-3 py-1.5 text-sm font-semibold text-[#1a1a19] transition hover:bg-white"
            >
              <PlusIcon />
              New Reminder
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search schedule..."
            className="w-full rounded-md border border-[#2e2e2c] bg-[#1f1f1e] py-2 pl-9 pr-4 text-sm text-[#f2f1ec] placeholder:text-white/45 outline-none transition focus:border-[#3e3e3c]"
          />
        </div>

        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-[#f2f1ec] text-[#f2f1ec]"
                  : "border-transparent text-white/55 hover:text-white/65"
              }`}
            >
              {tab.label}
              {!loading && countForTab(tab.key, counts) > 0 && (
                <span className={`rounded px-1.5 py-0.5 text-[11px] leading-none ${
                  activeTab === tab.key ? "bg-[#f2f1ec]/15 text-[#f2f1ec]" : "bg-[#2e2e2c] text-white/55"
                }`}>
                  {countForTab(tab.key, counts)}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="w-full px-6 py-6">
        {loadError ? (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
            {loadError}
          </div>
        ) : null}

        {loading ? (
          <TableSkeleton />
        ) : (
          <ScheduleTable
            rows={displayedRows}
            actioning={actioning}
            onMarkDone={(row) => void markTaskDone(row)}
            onCancel={(row) => void cancelReminder(row)}
          />
        )}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 px-4 py-5 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-[#3a3a36] bg-[#1f1f1e] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2e2e2c] px-5 py-4">
              <h2 className="text-base font-semibold text-[#f2f1ec]">New Reminder</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-[#8f8b83] transition hover:bg-[#2a2a28] hover:text-[#f2f1ec]"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-white/45">
                Describe what you want — Riz handles the rest. Try "remind me for medicine every day at 8 PM" or "follow up with Arjun next Monday".
              </p>
              <textarea
                autoFocus
                value={createMessage}
                onChange={(e) => setCreateMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submitCreate();
                }}
                placeholder="Remind me to take medicine every day at 8 PM…"
                rows={3}
                className="w-full resize-none rounded-lg border border-[#343431] bg-[#1a1a19] px-3 py-2 text-sm leading-6 text-[#f2f1ec] outline-none transition placeholder:text-[#5d5d58] focus:border-[#595951]"
              />
              {createError ? <p className="text-sm text-red-300">{createError}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white/65 transition hover:bg-[#292927] hover:text-[#f2f1ec]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitCreate()}
                  disabled={creating}
                  className="rounded-lg bg-[#f2f1ec] px-4 py-2 text-sm font-semibold text-[#1a1a19] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? "Scheduling…" : "Schedule"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function buildRows(reminders: ScheduledReminder[], tasks: PrincipalTask[]): ScheduleRow[] {
  const reminderRows = reminders.map((reminder): ScheduleRow => {
    const isFired = reminder.state === "fired";
    const isFailed = reminder.state === "failed";
    return {
      id: `reminder-${reminder.id}`,
      rawId: reminder.id,
      type: "Reminder",
      title: reminder.message,
      detail: reminder.recurring
        ? `Repeats ${reminder.cron ?? "on schedule"}${reminder.tz ? ` in ${reminder.tz}` : ""}`
        : isFired
          ? `Sent ${formatDateTime(reminder.firedAt ?? reminder.runAt)}`
          : isFailed
            ? `Failed to send${reminder.runAt ? ` — was due ${formatDateTime(reminder.runAt)}` : ""}`
            : reminder.runAt
              ? `Will remind ${formatDateTime(reminder.runAt)}`
              : "Waiting for a scheduled time",
      priority: inferPriority(reminder.message, reminder.runAt),
      dueAt: reminder.runAt,
      source: reminder.recurring ? "Recurring reminder" : "Reminder",
      status: isFired ? "Sent" : isFailed ? "Failed" : reminder.recurring ? "Repeating" : reminder.runAt ? "Scheduled" : "Pending",
      state: isFired ? "fired" : isFailed ? "failed" : "active",
      recurring: reminder.recurring,
      cron: reminder.cron,
      tz: reminder.tz,
    };
  });

  const taskRows = tasks.map((task): ScheduleRow => ({
    id: `followup-${task.id}`,
    rawId: task.id,
    type: "Follow-up",
    title: task.summary,
    detail: task.status === "done" ? "Marked done" : "Open follow-up Riz is tracking for you",
    priority: inferPriority(`${task.summary} ${task.source}`),
    createdAt: task.createdAt,
    source: task.source || "Riz",
    status: normalizeStatus(task.status),
    state: task.status === "done" ? "done" : "active",
  }));

  return [...reminderRows, ...taskRows].sort((a, b) => sortDate(a).getTime() - sortDate(b).getTime());
}

function isHistoric(row: ScheduleRow) {
  return row.state === "done" || row.state === "fired" || row.state === "failed";
}

function buildCounts(rows: ScheduleRow[]) {
  const active = rows.filter((r) => !isHistoric(r));
  return {
    all: rows.length,
    active: active.length,
    today: active.filter((row) => isToday(row.dueAt ?? row.createdAt)).length,
    week: active.filter((row) => isThisWeek(row.dueAt ?? row.createdAt)).length,
    reminders: active.filter((row) => row.type === "Reminder").length,
    followups: active.filter((row) => row.type === "Follow-up").length,
    priority: active.filter((row) => row.priority === "High").length,
    history: rows.filter(isHistoric).length,
  };
}

function matchesTab(row: ScheduleRow, tab: ScheduleTab) {
  if (tab === "all") return true;
  if (tab === "history") return isHistoric(row);
  if (tab === "active") return !isHistoric(row);
  if (isHistoric(row)) return false; // remaining tabs show only active
  if (tab === "today") return isToday(row.dueAt ?? row.createdAt);
  if (tab === "week") return isThisWeek(row.dueAt ?? row.createdAt);
  if (tab === "reminders") return row.type === "Reminder";
  if (tab === "followups") return row.type === "Follow-up";
  return row.priority === "High";
}

function countForTab(tab: ScheduleTab, counts: ReturnType<typeof buildCounts>) {
  return counts[tab];
}

function inferPriority(text: string, dueAt?: string): ScheduleRow["priority"] {
  const lower = text.toLowerCase();
  if (dueAt && isToday(dueAt)) return "High";
  if (HIGH_WORDS.some((word) => lower.includes(word))) return "High";
  if (dueAt && isThisWeek(dueAt)) return "Medium";
  if (MEDIUM_WORDS.some((word) => lower.includes(word))) return "Medium";
  return "Low";
}

function normalizeStatus(status: string) {
  if (!status) return "Open";
  return status
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function sortDate(row: ScheduleRow) {
  const raw = row.dueAt ?? row.createdAt;
  if (!raw) return new Date("2999-01-01T00:00:00.000Z");
  return new Date(raw);
}

function isToday(iso?: string) {
  if (!iso) return false;
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isThisWeek(iso?: string) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  const start = startOfToday().getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return time >= start && time < end;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}


function formatDateTime(iso?: string) {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso?: string) {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function ScheduleTable({
  rows,
  actioning,
  onMarkDone,
  onCancel,
}: {
  rows: ScheduleRow[];
  actioning: string | null;
  onMarkDone: (row: ScheduleRow) => void;
  onCancel: (row: ScheduleRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-[#343431] bg-[#242422]">
          <CalendarIcon />
        </div>
        <p className="mt-4 text-sm font-medium text-[#f2f1ec]">No scheduled work in this view</p>
        <p className="mt-1 max-w-sm text-sm leading-6 text-[#77736a]">
          Try another tab or ask Riz to create a reminder or follow-up.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-md border border-[#2e2e2c] bg-[#1f1f1e]">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left">
        <thead className="bg-[#1a1a19] text-xs font-semibold uppercase tracking-[0.08em] text-white/55">
          <tr>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Schedule item</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Remember date</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Source / status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2e2e2c]">
          {rows.map((row) => {
            const historic = isHistoric(row);
            return (
            <tr key={row.id} className={`align-top transition hover:bg-[#242422] ${historic ? "opacity-55" : ""}`}>
              <td className="whitespace-nowrap px-4 py-4">
                <TypeBadge type={row.type} />
              </td>
              <td className="max-w-[380px] px-4 py-4">
                <p className={`text-sm font-medium leading-5 ${historic ? "line-through text-white/40" : "text-[#f2f1ec]"}`}>{row.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#77736a]">{row.detail}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <PriorityBadge priority={row.priority} />
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-white/80 tabular-nums">
                {row.recurring ? (
                  <span>
                    Repeats
                    <span className="block text-xs text-[#77736a]">{row.cron ?? "Custom"} {row.tz ? `(${row.tz})` : ""}</span>
                  </span>
                ) : (
                  formatDateTime(row.dueAt)
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-white/65 tabular-nums">
                {formatDate(row.createdAt)}
              </td>
              <td className="px-4 py-4">
                <p className="text-sm text-white/80">{row.source}</p>
                <p className="mt-1 text-xs text-[#77736a]">{row.status}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-right">
                {row.sample ? (
                  <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                    Sample
                  </span>
                ) : historic ? (
                  <StateBadge state={row.state} />
                ) : row.type === "Follow-up" ? (
                  <button
                    type="button"
                    disabled={actioning === row.id}
                    onClick={() => onMarkDone(row)}
                    className="rounded border border-emerald-500/25 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actioning === row.id ? "…" : "Done"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={actioning === row.id}
                    onClick={() => onCancel(row)}
                    className="rounded border border-red-500/20 px-3 py-1.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actioning === row.id ? "…" : "Cancel"}
                  </button>
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: ScheduleRow["type"] }) {
  const classes =
    type === "Reminder"
      ? "border-sky-500/20 bg-sky-500/10 text-sky-300"
      : "border-violet-500/20 bg-violet-500/10 text-violet-300";

  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${classes}`}>{type}</span>;
}

function StateBadge({ state }: { state: ScheduleRow["state"] }) {
  if (state === "fired" || state === "done") {
    return (
      <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
        {state === "fired" ? "Sent" : "Done"}
      </span>
    );
  }
  return (
    <span className="rounded border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
      Failed
    </span>
  );
}

function PriorityBadge({ priority }: { priority: ScheduleRow["priority"] }) {
  const classes = {
    High: "border-red-500/25 bg-red-500/10 text-red-300",
    Medium: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    Low: "border-[#3a3a36] bg-[#292927] text-white/65",
  }[priority];

  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${classes}`}>{priority}</span>;
}


function TableSkeleton() {
  return (
    <div className="p-4">
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid min-h-16 grid-cols-[120px_1fr_110px_150px_130px] gap-4 rounded-lg border border-[#292927] bg-[#20201f] p-4">
            {Array.from({ length: 5 }).map((__, cellIndex) => (
              <span key={cellIndex} className="h-4 animate-pulse rounded bg-[#30302d]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13.2 8a5.2 5.2 0 1 1-1.52-3.68" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13.2 3.2v3.2H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5d5d58]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.6-2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-5 w-5 text-[#8f8b83]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 2.8v3.4M13.5 2.8v3.4M3.5 8h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
