"use client";

import { useEffect, useRef, useState } from "react";

type UsageBreakdownRow = {
  task: string;
  costUsd: number;
  calls: number;
};

type UsageSummary = {
  state: "ok" | "warn" | "exceeded";
  spendUsd: number;
  budgetUsd: number;
  creditsUsed: number;
  creditsBudget: number;
  ratio: number;
  cycleStart: string;
  breakdown: UsageBreakdownRow[];
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

export function UsageClient() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
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
      const data = (await response.json()) as UsageSummary & { message?: string };
      if (data.message && data.budgetUsd === undefined) throw new Error(data.message);
      setUsage(data);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load usage");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsage();
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
  const pct = usage ? Math.min(100, Math.round(usage.ratio * 100)) : 0;
  const barColor =
    usage?.state === "exceeded" ? "bg-red-600" : usage?.state === "warn" ? "bg-amber-600" : "bg-emerald-600";

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">rizly</p>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Credits</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Your AI credits for this billing cycle. Every chat, email triage, and background task spends credits.
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
                  {unlimited ? "No credit cap" : `${usage.creditsBudget.toLocaleString()} credits`}
                </p>
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {usage.creditsUsed.toLocaleString()} <span className="text-base font-normal text-slate-400">used</span>
              </p>

              {!unlimited ? (
                <>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {usage.state === "exceeded"
                      ? "Credits used up — background features (decisions, memory, morning brief) are paused, and chat has switched to a lighter model until next cycle."
                      : usage.state === "warn"
                        ? "Running low on credits — background features will pause once they're used up."
                        : `${pct}% of this cycle's credits used.`}
                  </p>
                </>
              ) : null}

              {!unlimited && (
                <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Need more this cycle? +{CREDIT_PACK.credits.toLocaleString()} credits for ${CREDIT_PACK.priceUsd}
                    </p>
                    <p className="text-xs text-slate-400">Applies immediately, lasts through this billing cycle.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void buyCredits()}
                    disabled={buying}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#FE7F2D] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
                  >
                    {buying ? "Opening checkout…" : "Buy credits"}
                  </button>
                </div>
              )}
              {buyError && <p className="mt-2 text-xs text-red-500">{buyError}</p>}
              {buySuccess && (
                <p className="mt-2 text-xs text-emerald-600">
                  Payment received — your balance below updates once it's confirmed (a few seconds).
                </p>
              )}
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
                    <p className="text-sm font-medium text-slate-900">
                      {Math.round(row.costUsd * 200).toLocaleString()} credits
                    </p>
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
