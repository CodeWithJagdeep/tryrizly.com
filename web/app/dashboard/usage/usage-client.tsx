"use client";

import { useEffect, useState } from "react";

type UsageBreakdownRow = {
  task: string;
  costUsd: number;
  calls: number;
};

type UsageSummary = {
  state: "ok" | "warn" | "exceeded";
  spendUsd: number;
  budgetUsd: number;
  ratio: number;
  cycleStart: string;
  breakdown: UsageBreakdownRow[];
};

const TASK_LABELS: Record<string, string> = {
  agent: "Chat & tool calls",
  extract: "Email reading",
  decide: "Decision tracking",
  draft: "Drafting replies",
  memory: "Memory notes",
  brief: "Morning brief",
  query: "Business data lookups",
  classify: "Inbox triage",
};

export function UsageClient() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/usage");
        if (!response.ok) throw new Error("Failed to load usage");
        const data = (await response.json()) as UsageSummary & { message?: string };
        if (data.message && data.budgetUsd === undefined) throw new Error(data.message);
        if (!cancelled) {
          setUsage(data);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load usage");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlimited = usage ? !Number.isFinite(usage.budgetUsd) : false;
  const pct = usage ? Math.min(100, Math.round(usage.ratio * 100)) : 0;
  const barColor =
    usage?.state === "exceeded" ? "bg-red-600" : usage?.state === "warn" ? "bg-amber-600" : "bg-emerald-600";

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">rizly</p>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Usage</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Your AI spend for this billing cycle, against your plan&apos;s budget.
            </p>
          </div>
        </header>

        {loadError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-500">
            {loadError}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : usage ? (
          <>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm font-medium text-slate-400">This cycle (since {formatDate(usage.cycleStart)})</p>
                <p className="text-sm font-medium text-slate-500">
                  {unlimited ? "No budget cap" : `$${usage.budgetUsd.toFixed(2)} budget`}
                </p>
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">${usage.spendUsd.toFixed(2)}</p>

              {!unlimited ? (
                <>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {usage.state === "exceeded"
                      ? "Budget used up — background features (decisions, memory, morning brief) are paused, and chat has switched to a lighter model until next cycle."
                      : usage.state === "warn"
                        ? "Approaching your budget — background features will pause once it's used up."
                        : `${pct}% of this cycle's budget used.`}
                  </p>
                </>
              ) : null}
            </div>

            <Section title="By feature">
              {usage.breakdown.length === 0 ? (
                <EmptyRow text="No AI usage recorded yet this cycle." />
              ) : (
                usage.breakdown.map((row) => (
                  <article key={row.task} className="flex items-center justify-between px-5 py-4 transition hover:bg-white/60">
                    <div>
                      <p className="text-sm leading-6 text-slate-900">
                        {TASK_LABELS[row.task] ?? row.task}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {row.calls} call{row.calls === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-slate-900">${row.costUsd.toFixed(2)}</p>
                  </article>
                ))
              )}
            </Section>
          </>
        ) : null}
      </section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{title}</p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-200">{children}</div>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-5 py-8 text-center text-sm text-slate-400">{text}</p>;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}
