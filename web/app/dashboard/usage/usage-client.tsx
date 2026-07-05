"use client";

import { useEffect, useRef, useState } from "react";
import { dayLabel, taskLabel } from "../lib/usage-labels";

type UsageBreakdownRow = {
  task: string;
  costUsd: number;
  calls: number;
};

type DailyTaskRow = {
  task: string;
  credits: number;
  calls: number;
};

type DailyTotal = {
  day: string;
  credits: number;
  tasks: DailyTaskRow[];
};

type UsageSummary = {
  state: "ok" | "warn" | "exceeded";
  spendUsd: number;
  budgetUsd: number;
  creditsUsed: number;
  creditsBudget: number;
  planId: string;
  ratio: number;
  cycleStart: string;
  cycleEnd: string | null;
  breakdown: UsageBreakdownRow[];
  daily: DailyTotal[];
};

type BillingStatus = {
  plan?: { name?: string };
  access?: { state?: string; expiresAt?: string | null };
};

type CheckoutResponse = {
  ok?: boolean;
  keyId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  message?: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

// Mirrors shared/src/billing/plan-budgets.ts CREDIT_PACKS — kept in sync by hand
// since web/ doesn't share that package (separate deploy target on Vercel).
const CREDIT_PACK = { id: "credits_1000", credits: 1000, priceUsd: 10 };

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay checkout")));
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.head.appendChild(script);
  });
}

function formatDate(iso: string | Date): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return String(iso).slice(0, 10);
  }
}

export function UsageClient() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadUsage() {
    try {
      const response = await fetch("/api/usage");
      if (!response.ok) throw new Error("Failed to load usage");
      const data = (await response.json()) as Partial<UsageSummary> & { message?: string };
      if (data.message && data.budgetUsd === undefined) throw new Error(data.message);
      setUsage({
        state: data.state ?? "ok",
        spendUsd: data.spendUsd ?? 0,
        budgetUsd: data.budgetUsd ?? Number.POSITIVE_INFINITY,
        creditsUsed: data.creditsUsed ?? 0,
        creditsBudget: data.creditsBudget ?? Number.POSITIVE_INFINITY,
        planId: data.planId ?? "free",
        ratio: data.ratio ?? 0,
        cycleStart: data.cycleStart ?? new Date().toISOString(),
        cycleEnd: data.cycleEnd ?? null,
        breakdown: data.breakdown ?? [],
        daily: data.daily ?? [],
      });
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load usage");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsage();
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((d: BillingStatus) => setBilling(d))
      .catch(() => undefined);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buyCredits() {
    setBuying(true);
    setBuyError(null);
    setBuySuccess(false);
    try {
      await loadRazorpayScript();

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "purchase", planId: CREDIT_PACK.id }),
      });
      const data = (await res.json()) as CheckoutResponse;
      if (!data.ok || !data.orderId || !data.keyId) {
        throw new Error(data.message ?? "Could not start checkout");
      }

      const razorpay = new window.Razorpay!({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: data.currency,
        name: "Rizly",
        description: `${CREDIT_PACK.credits.toLocaleString()} AI credits`,
        theme: { color: "#FE7F2D" },
        handler: () => {
          setBuySuccess(true);
          // The Razorpay webhook confirms the payment asynchronously — poll
          // for a few seconds so the new budget shows up without a manual refresh.
          let attempts = 0;
          pollTimer.current = setInterval(() => {
            attempts += 1;
            void loadUsage();
            if (attempts >= 6 && pollTimer.current) {
              clearInterval(pollTimer.current);
              pollTimer.current = null;
            }
          }, 2000);
        },
        modal: {
          ondismiss: () => setBuying(false),
        },
      });
      razorpay.open();
    } catch (error) {
      setBuyError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBuying(false);
    }
  }

  const unlimited = usage ? !Number.isFinite(usage.creditsBudget) : false;
  const remaining = usage && !unlimited ? Math.max(0, usage.creditsBudget - usage.creditsUsed) : 0;
  const pct = usage ? Math.min(100, Math.round(usage.ratio * 100)) : 0;
  const barColor =
    usage?.state === "exceeded" ? "bg-red-600" : usage?.state === "warn" ? "bg-amber-600" : "bg-emerald-600";

  const trialOrRenewLabel = billing?.access?.state === "trialing" ? "Trial ends" : "Renews";
  const trialOrRenewValue = billing?.access?.expiresAt ? formatDate(billing.access.expiresAt) : "—";

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 px-6 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Credits</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Your AI credits for this billing cycle — every chat, email triage, and background task spends credits.
            </p>
          </div>
          {!loading && usage && !unlimited && (
            <button
              type="button"
              onClick={() => void buyCredits()}
              disabled={buying}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FE7F2D] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
            >
              {buying ? "Opening checkout…" : `+${CREDIT_PACK.credits.toLocaleString()} credits — $${CREDIT_PACK.priceUsd}`}
            </button>
          )}
        </div>
      </header>

      <div className="w-full px-6 py-6">
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <span className="text-sm text-slate-500">Loading usage…</span>
          </div>
        ) : usage ? (
          <div className="flex flex-col gap-6">
            {/* Stat tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Plan" value={billing?.plan?.name ?? PLAN_NAMES[usage.planId] ?? "Free"} />
              <StatTile
                label="Remaining"
                value={unlimited ? "Unlimited" : remaining.toLocaleString()}
                accent={usage.state === "exceeded" ? "text-red-600" : usage.state === "warn" ? "text-amber-600" : undefined}
              />
              <StatTile label="Used this cycle" value={usage.creditsUsed.toLocaleString()} />
              <StatTile label={trialOrRenewLabel} value={trialOrRenewValue} />
            </div>

            {/* Usage bar */}
            {!unlimited && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm font-medium text-slate-500">
                    Credits since {formatDate(usage.cycleStart)}
                    {usage.cycleEnd ? ` · resets ${formatDate(usage.cycleEnd)}` : ""}
                  </p>
                  <p className="text-sm font-medium text-slate-500">{usage.creditsBudget.toLocaleString()} credits included</p>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {usage.state === "exceeded"
                    ? "Credits used up — background features (decisions, memory, morning brief) are paused, and chat has switched to a lighter model until next cycle."
                    : usage.state === "warn"
                      ? "Running low on credits — background features will pause once they're used up."
                      : `${pct}% of this cycle's credits used.`}
                </p>
                {buyError && <p className="mt-2 text-xs text-red-500">{buyError}</p>}
                {buySuccess && (
                  <p className="mt-2 text-xs text-emerald-600">
                    Payment received — your balance above updates once it&apos;s confirmed (a few seconds).
                  </p>
                )}
              </div>
            )}

            {/* By feature summary (whole cycle) */}
            <Section title="By feature">
              {usage.breakdown.length === 0 ? (
                <EmptyRow text="No AI usage recorded yet this cycle." />
              ) : (
                usage.breakdown
                  .slice()
                  .sort((a, b) => b.costUsd - a.costUsd)
                  .map((row) => (
                    <article key={row.task} className="flex items-center justify-between px-5 py-4 transition hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{taskLabel(row.task)}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {row.calls} call{row.calls === 1 ? "" : "s"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {Math.round(row.costUsd * 200).toLocaleString()} credits
                      </p>
                    </article>
                  ))
              )}
            </Section>

            {/* Recent activity — one group per day, each day showing which
                features consumed its total (a single call can cost a fraction
                of a credit, so a per-call feed mostly read as "-0"). */}
            <Section title="Recent activity, by day">
              {usage.daily.length === 0 ? (
                <EmptyRow text="No AI usage recorded yet." />
              ) : (
                <div className="divide-y divide-slate-200">
                  {usage.daily.map((d) => (
                    <div key={d.day}>
                      <div className="flex items-center justify-between bg-slate-50 px-5 py-2.5">
                        <p className="text-sm font-semibold text-slate-900">{dayLabel(d.day)}</p>
                        <p className="text-sm font-semibold text-slate-900">{d.credits.toLocaleString()} credits</p>
                      </div>
                      {d.tasks
                        .slice()
                        .sort((a, b) => b.credits - a.credits)
                        .map((t) => (
                          <article key={t.task} className="flex items-center justify-between px-5 py-2.5 pl-8 transition hover:bg-slate-50">
                            <p className="text-sm text-slate-700">{taskLabel(t.task)}</p>
                            <p className="text-xs text-slate-400">
                              {t.calls} call{t.calls === 1 ? "" : "s"} · {t.credits.toLocaleString()} credits
                            </p>
                          </article>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ?? "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-200">{children}</div>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-5 py-8 text-center text-sm text-slate-400">{text}</p>;
}
