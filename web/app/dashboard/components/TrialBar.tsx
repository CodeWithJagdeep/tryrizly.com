"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BillingStatus = {
  ok?: boolean;
  plan?: { id: string; name: string };
  access?: { active: boolean; state: string; expiresAt: string | null };
};

function daysRemaining(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TrialBar() {
  const [status, setStatus] = useState<BillingStatus | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((d: BillingStatus) => setStatus(d))
      .catch(() => null);
  }, []);

  // Skeleton — same height so layout doesn't shift
  if (!status?.access) {
    return <div className="sticky top-0 z-40 h-14 w-full border-b-2 border-[#FE7F2D] bg-black" />;
  }

  const { state, expiresAt } = status.access;
  const planName = status.plan?.name ?? "Free";
  const isPaid = state === "active" || state === "authenticated" || state === "purchased";

  // Paid & active — minimal dark bar, no CTA
  if (isPaid && !expiresAt) {
    return (
      <div className="sticky top-0 z-40 flex min-h-11 w-full items-center justify-between gap-4 border-b-2 border-[#FE7F2D] bg-black px-5 py-2.5">
        <div className="flex items-center gap-2 text-left text-xs text-white/60">
          <span className="h-2 w-2 bg-emerald-400" />
          <span className="font-semibold text-white">{planName} plan</span>
          <span>· Active</span>
        </div>
        <Link href="/dashboard/upgrade" className="border border-[#FE7F2D] bg-[#FE7F2D] px-3 py-1 text-xs font-semibold text-white transition hover:bg-white hover:text-black">
          Manage
        </Link>
      </div>
    );
  }

  // Paid with renewal date — minimal dark bar
  if (isPaid && expiresAt) {
    const days = daysRemaining(expiresAt);
    return (
      <div className="sticky top-0 z-40 flex min-h-11 w-full items-center justify-between gap-4 border-b-2 border-[#FE7F2D] bg-black px-5 py-2.5">
        <div className="flex items-center gap-2 text-left text-xs text-white/60">
          <span className="h-2 w-2 bg-emerald-400" />
          <span className="font-semibold text-white">{planName} plan</span>
          <span>· Renews {days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : `on ${shortDate(expiresAt)}`}</span>
        </div>
        <Link href="/dashboard/upgrade" className="border border-[#FE7F2D] bg-[#FE7F2D] px-3 py-1 text-xs font-semibold text-white transition hover:bg-white hover:text-black">
          Manage
        </Link>
      </div>
    );
  }

  // Free plan — soft light blue banner
  if (state === "free") {
    return (
      <div className="sticky top-0 z-40 w-full border-b-2 border-[#FE7F2D] bg-black px-5 py-3">
        <div className="flex w-full items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/20 bg-white/10 text-white">
              <InfoIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">You&apos;re on the free plan</p>
              <p className="text-xs text-white/60">Upgrade to unlock unlimited messages, connectors, and AI features.</p>
            </div>
          </div>
          <Link
            href="/dashboard/upgrade"
            className="shrink-0 border border-[#FE7F2D] bg-[#FE7F2D] px-4 py-1.5 text-xs font-semibold text-white transition hover:border-white hover:bg-white hover:text-black"
          >
            Upgrade
          </Link>
        </div>
      </div>
    );
  }

  // Trial — active or expired
  if (state === "trialing" && expiresAt) {
    const days = daysRemaining(expiresAt);
    const expired = days <= 0;
    const urgent = !expired && days <= 3;

    // Expired — soft red banner
    if (expired) {
      return (
        <div className="sticky top-0 z-40 w-full border-b-2 border-[#FE7F2D] bg-black px-5 py-3">
          <div className="flex w-full items-center justify-between gap-4 text-left">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-red-400/50 bg-red-500/20 text-red-200">
                <InfoIcon />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Your free trial has ended</p>
                <p className="text-xs text-white/60">Choose a plan to restore access to all features.</p>
              </div>
            </div>
            <Link
              href="/dashboard/upgrade"
              className="shrink-0 border border-[#FE7F2D] bg-[#FE7F2D] px-4 py-1.5 text-xs font-semibold text-white transition hover:border-white hover:bg-white hover:text-black"
            >
              Choose a plan
            </Link>
          </div>
        </div>
      );
    }

    // Urgent (≤3 days) — soft amber banner
    if (urgent) {
      return (
        <div className="sticky top-0 z-40 w-full border-b-2 border-[#FE7F2D] bg-black px-5 py-3">
          <div className="flex w-full items-center justify-between gap-4 text-left">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-amber-300/50 bg-amber-500/20 text-amber-100">
                <InfoIcon />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  Your trial ends in {days} day{days === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-white/60">
                  Upgrade before {shortDate(expiresAt)} to keep all features.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/upgrade"
              className="shrink-0 border border-[#FE7F2D] bg-[#FE7F2D] px-4 py-1.5 text-xs font-semibold text-white transition hover:border-white hover:bg-white hover:text-black"
            >
              Upgrade now
            </Link>
          </div>
        </div>
      );
    }

    // Healthy trial — soft lavender banner (Zapier-style)
    return (
      <div className="sticky top-0 z-40 w-full border-b-2 border-[#FE7F2D] bg-black px-5 py-3">
        <div className="flex w-full items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/20 bg-white/10 text-white">
              <InfoIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">
                Welcome to your free trial
              </p>
              <p className="text-xs text-white/60">
                You have {days} day{days === 1 ? "" : "s"} to try all features.{" "}
                <Link href="/dashboard/upgrade" className="font-semibold text-white underline underline-offset-2 hover:text-[#FE7F2D]">
                  Upgrade
                </Link>{" "}
                anytime to keep access.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/upgrade"
            className="shrink-0 border border-[#FE7F2D] bg-[#FE7F2D] px-4 py-1.5 text-xs font-semibold text-white transition hover:border-white hover:bg-white hover:text-black"
          >
            Upgrade now
          </Link>
        </div>
      </div>
    );
  }

  // Fallback
  return <div className="sticky top-0 z-40 h-14 w-full border-b-2 border-[#FE7F2D] bg-black" />;
}
