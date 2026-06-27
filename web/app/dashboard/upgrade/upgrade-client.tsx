"use client";

import { useEffect, useState } from "react";

type Plan = {
  id: string;
  name: string;
  kind: "free" | "subscription" | "one_time";
  description: string;
  currency: string;
  amount: number;
  interval?: "month" | "year";
  trialDays: number;
  aiBudgetUsd: number;
  features: string[];
  configured: boolean;
};

type BillingStatus = {
  plan?: { id: string; name: string };
  trial?: { active: boolean; endsAt: string } | null;
  access?: { active: boolean; state: string; expiresAt: string | null };
};

const PLAN_ORDER = ["starter", "pro", "business"];

export function UpgradeClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/plans").then((r) => r.json()) as Promise<{ plans?: Plan[] }>,
      fetch("/api/billing/status").then((r) => r.json()) as Promise<BillingStatus>,
    ])
      .then(([plansData, statusData]) => {
        const sorted = (plansData.plans ?? [])
          .filter((p) => p.kind === "subscription")
          .sort((a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id));
        setPlans(sorted);
        setStatus(statusData);
      })
      .catch(() => setError("Failed to load plans. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  async function subscribe(planId: string) {
    setSubscribing(planId);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId,
          mode: "subscription",
          returnUrl: `${window.location.origin}/dashboard`,
        }),
      });
      const data = (await res.json()) as { checkoutUrl?: string; error?: string; ok?: boolean };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to start checkout");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError("Payment provider not configured. Contact support.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setSubscribing(null);
    }
  }

  const currentPlanId = status?.plan?.id;
  const trialActive = status?.trial?.active;
  const trialEndsAt = status?.trial?.endsAt;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const trialExpired = status?.access?.state === "free" && !trialActive;

  return (
    <main className="min-h-screen bg-[#1a1a19] text-[#f2f1ec]">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#f2f1ec]">
            {trialExpired ? "Your trial has ended — choose a plan" : "Choose your plan"}
          </h1>
          <p className="mt-3 text-base text-white/55">
            {trialActive
              ? `You have ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left on your free trial. Subscribe now to keep access.`
              : trialExpired
                ? "Subscribe to continue using HeyRiz and unlock full access."
                : "All plans include a 15-day free trial. Cancel any time."}
          </p>
        </div>

        {error ? (
          <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl border border-[#2e2e2c] bg-[#1f1f1e]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan, idx) => {
              const isCurrent = currentPlanId === plan.id;
              const isPopular = idx === 1;
              const price = (plan.amount / 100).toLocaleString("en-US", {
                style: "currency",
                currency: plan.currency,
                minimumFractionDigits: 0,
              });

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-6 ${
                    isPopular
                      ? "border-[#f2f1ec]/30 bg-[#242422]"
                      : "border-[#2e2e2c] bg-[#1f1f1e]"
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#f2f1ec] px-3 py-0.5 text-xs font-bold text-[#1a1a19]">
                      Most popular
                    </span>
                  )}

                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-[#f2f1ec]">{plan.name}</h2>
                    <p className="mt-1 text-sm text-white/50">{plan.description}</p>
                    <div className="mt-4 flex items-end gap-1">
                      <span className="text-4xl font-bold text-[#f2f1ec]">{price}</span>
                      <span className="mb-1 text-sm text-white/45">/ {plan.interval ?? "month"}</span>
                    </div>
                    <p className="mt-1 text-xs text-white/40">
                      AI budget: ${plan.aiBudgetUsd}/mo
                    </p>
                  </div>

                  <ul className="mb-8 flex-1 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-white/70">
                        <CheckIcon />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 py-2.5 text-center text-sm font-semibold text-emerald-300">
                      Current plan
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={subscribing !== null || !plan.configured}
                      onClick={() => void subscribe(plan.id)}
                      className={`rounded-xl py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        isPopular
                          ? "bg-[#f2f1ec] text-[#1a1a19] hover:bg-white"
                          : "border border-[#3a3a36] text-[#f2f1ec] hover:bg-[#2b2b28]"
                      }`}
                    >
                      {subscribing === plan.id
                        ? "Opening checkout…"
                        : !plan.configured
                          ? "Not available"
                          : trialActive
                            ? "Subscribe now"
                            : "Get started"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-white/35">
          Payments are processed securely by Razorpay. Cancel any time from settings.
        </p>
      </div>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
