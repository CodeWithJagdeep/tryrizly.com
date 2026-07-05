"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { dayLabel } from "../lib/usage-labels";

type UsageSummary = {
  state: "ok" | "warn" | "exceeded";
  creditsUsed: number;
  creditsBudget: number;
  planId: string;
  daily: Array<{ day: string; credits: number }>;
};

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

/**
 * Small always-visible credits pill (sparkle + remaining count), shown in the
 * dashboard's top chrome. Click opens a popover with the plan, a used/total
 * bar, and the real recent-activity feed — no page navigation needed for the
 * common case; "View full usage" still links to /dashboard/usage for the
 * complete history and the buy-credits flow.
 */
export function CreditsBadge() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data: Partial<UsageSummary>) => {
        // Defensive against an old backend / partial response mid-deploy —
        // this crashed the whole page when `recent` was simply absent.
        setUsage({
          state: data.state ?? "ok",
          creditsUsed: data.creditsUsed ?? 0,
          creditsBudget: data.creditsBudget ?? Number.POSITIVE_INFINITY,
          planId: data.planId ?? "free",
          daily: data.daily ?? [],
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (!usage) return null;

  const unlimited = !Number.isFinite(usage.creditsBudget);
  const remaining = unlimited ? Infinity : Math.max(0, usage.creditsBudget - usage.creditsUsed);
  const pct = unlimited ? 0 : Math.min(100, Math.round((usage.creditsUsed / Math.max(usage.creditsBudget, 1)) * 100));
  const barColor = usage.state === "exceeded" ? "bg-red-600" : usage.state === "warn" ? "bg-amber-600" : "bg-emerald-600";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
      >
        <SparkleIcon />
        {unlimited ? "Unlimited" : remaining.toLocaleString()}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-slate-900">{PLAN_NAMES[usage.planId] ?? "Free"}</p>
            <Link
              href="/dashboard/upgrade"
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-[#FE7F2D]"
            >
              Upgrade
            </Link>
          </div>

          {!unlimited && (
            <>
              <div className="mt-3 flex items-baseline justify-between">
                <p className="text-3xl font-semibold text-slate-900">{remaining.toLocaleString()}</p>
                <p className="text-sm text-slate-400">of {usage.creditsBudget.toLocaleString()} credits</p>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </>
          )}

          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recent activity
          </p>
          {usage.daily.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">No usage recorded yet.</p>
          ) : (
            <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
              {usage.daily.map((d) => (
                <div key={d.day} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                  <p className="text-slate-800">{dayLabel(d.day)}</p>
                  <p className="font-medium text-slate-500">{d.credits.toLocaleString()} credits</p>
                </div>
              ))}
            </div>
          )}

          <Link
            href="/dashboard/usage"
            onClick={() => setOpen(false)}
            className="mt-3 block w-full rounded-lg border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            View full usage & buy credits
          </Link>
        </div>
      )}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 text-[#FE7F2D]" aria-hidden="true">
      <path d="M8 1.5l1.1 3.4L12.5 6l-3.4 1.1L8 10.5l-1.1-3.4L3.5 6l3.4-1.1L8 1.5Z" />
      <path d="M13 9.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" />
    </svg>
  );
}
