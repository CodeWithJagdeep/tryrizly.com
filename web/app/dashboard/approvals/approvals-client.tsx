"use client";

import { useEffect, useState } from "react";

type PendingApproval = {
  id: string;
  tool: string;
  preview: string;
  label: string;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return "";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TOOL_META: Record<string, { label: string; color: string; icon: "mail" | "calendar" | "booking" }> = {
  send_email: { label: "Send email", color: "bg-blue-50 text-blue-700 border-blue-200", icon: "mail" },
  create_calendar_event: { label: "Create event", color: "bg-violet-50 text-violet-700 border-violet-200", icon: "calendar" },
  reschedule_calendar_event: { label: "Reschedule event", color: "bg-amber-50 text-amber-700 border-amber-200", icon: "calendar" },
  calcom_book: { label: "Book meeting", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "booking" },
};
const DEFAULT_TOOL_META = { color: "bg-slate-100 text-slate-600 border-slate-200", icon: "mail" as const };

function toolMeta(tool: string) {
  return TOOL_META[tool] ?? { ...DEFAULT_TOOL_META, label: tool };
}

export function ApprovalsClient() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function load(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);
    try {
      const response = await fetch("/api/approvals");
      if (!response.ok) throw new Error("Failed to load approvals");
      const data = (await response.json()) as { approvals?: PendingApproval[]; error?: string };
      if (data.error) throw new Error(data.error);
      setApprovals(data.approvals ?? []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load approvals");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(id: string, decision: "approve" | "reject") {
    setDecidingId(id);
    try {
      const response = await fetch("/api/approvals/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      if (!response.ok) throw new Error("Failed to update approval");
      await load();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to update approval");
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 px-4 pt-5 sm:px-6">
        <div className="flex items-center justify-between gap-3 pb-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Approvals</h1>
            <p className="mt-0.5 max-w-2xl truncate text-sm text-slate-500 sm:whitespace-normal">
              Actions rizly wants to run on your behalf — sending an email, moving a
              meeting — waiting on your yes or no.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!loading && approvals.length > 0 && (
              <span className="hidden rounded-full bg-[#D9BEF4]/10 px-3 py-1 text-sm font-medium text-[#D9BEF4] sm:inline-block">
                {approvals.length} pending
              </span>
            )}
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing || loading}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-40"
            >
              <RefreshIcon spinning={refreshing} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <div className="w-full px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <span className="text-sm text-slate-500">Loading approvals…</span>
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {loadError}
          </div>
        ) : approvals.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <CheckShieldIcon />
            </div>
            <p className="font-medium">Nothing waiting on you</p>
            <p className="max-w-xs text-sm text-slate-500">
              When rizly wants to send an email, book a meeting, or move something
              on your calendar, it'll show up here first.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {approvals.map((approval) => (
              <ApprovalRow
                approval={approval}
                deciding={decidingId === approval.id}
                key={approval.id}
                onApprove={() => void decide(approval.id, "approve")}
                onReject={() => void decide(approval.id, "reject")}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ApprovalRow({
  approval,
  deciding,
  onApprove,
  onReject,
}: {
  approval: PendingApproval;
  deciding: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const meta = toolMeta(approval.tool);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 sm:flex sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${meta.color}`}>
          <ToolIcon icon={meta.icon} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
            <span className="text-[11px] text-slate-400">#{approval.id} · {timeAgo(approval.createdAt)}</span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-900">
            {approval.preview}
          </p>
        </div>
      </div>

      <div className="mt-3 flex shrink-0 items-center gap-2 sm:mt-0">
        <button
          className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
          disabled={deciding}
          onClick={onReject}
          type="button"
        >
          <XIcon />
          Reject
        </button>
        <button
          className="flex h-9 items-center gap-1.5 rounded-lg bg-[#D9BEF4] px-3.5 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-50"
          disabled={deciding}
          onClick={onApprove}
          type="button"
        >
          {deciding ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <CheckIcon />
          )}
          {deciding ? "Working…" : "Approve"}
        </button>
      </div>
    </article>
  );
}

function ToolIcon({ icon }: { icon: "mail" | "calendar" | "booking" }) {
  if (icon === "calendar") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M3 9.5h18" /><path d="M8 3v3" /><path d="M16 3v3" />
      </svg>
    );
  }
  if (icon === "booking") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M3 9.5h18" /><path d="m9 14 2 2 4-4" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6 8.5 6.5L20.5 6" />
    </svg>
  );
}

function CheckShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" aria-hidden="true">
      <path d="M12 3 4 6v6c0 4.5 3 8 8 9 5-1 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={spinning ? "animate-spin" : ""}
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}
