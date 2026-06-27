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
    return <div className="sticky top-0 z-40 h-9 w-full border-b border-white/[0.05] bg-[#161615]" />;
  }

  const { state, expiresAt } = status.access;
  const planName = status.plan?.name ?? "Free";
  const isPaid = state === "active" || state === "authenticated" || state === "purchased";

  // Paid & active — minimal dark bar, no CTA
  if (isPaid && !expiresAt) {
    return (
      <div className="sticky top-0 z-40 flex h-9 w-full items-center justify-between border-b border-white/[0.05] bg-[#161615] px-4">
        <div className="flex items-center gap-2 text-xs text-[#5d5d58]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="font-medium text-[#7a7a72]">{planName} plan</span>
          <span>· Active</span>
        </div>
        <Link href="/dashboard/upgrade" className="text-xs text-[#4a4a46] transition hover:text-[#9a9990]">
          Manage
        </Link>
      </div>
    );
  }

  // Paid with renewal date — minimal dark bar
  if (isPaid && expiresAt) {
    const days = daysRemaining(expiresAt);
    return (
      <div className="sticky top-0 z-40 flex h-9 w-full items-center justify-between border-b border-white/[0.05] bg-[#161615] px-4">
        <div className="flex items-center gap-2 text-xs text-[#5d5d58]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="font-medium text-[#7a7a72]">{planName} plan</span>
          <span>· Renews {days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : `on ${shortDate(expiresAt)}`}</span>
        </div>
        <Link href="/dashboard/upgrade" className="text-xs text-[#4a4a46] transition hover:text-[#9a9990]">
          Manage
        </Link>
      </div>
    );
  }

  // Free plan — soft light blue banner
  if (state === "free") {
    return (
      <div className="sticky top-0 z-40 w-full bg-gradient-to-r from-[#dbeafe] to-[#e0e7ff] px-4 py-2">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-700">
              <InfoIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#1e3a8a]">You&apos;re on the free plan</p>
              <p className="text-xs text-[#3b5fc0]">Upgrade to unlock unlimited messages, connectors, and AI features.</p>
            </div>
          </div>
          <Link
            href="/dashboard/upgrade"
            className="shrink-0 rounded-md bg-[#2563eb] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
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
        <div className="sticky top-0 z-40 w-full bg-gradient-to-r from-[#fee2e2] to-[#fecdd3] px-4 py-2">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-700">
                <InfoIcon />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#991b1b]">Your free trial has ended</p>
                <p className="text-xs text-[#b91c1c]">Choose a plan to restore access to all features.</p>
              </div>
            </div>
            <Link
              href="/dashboard/upgrade"
              className="shrink-0 rounded-md bg-[#dc2626] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#b91c1c]"
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
        <div className="sticky top-0 z-40 w-full bg-gradient-to-r from-[#fef3c7] to-[#fde68a] px-4 py-2">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700">
                <InfoIcon />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#92400e]">
                  Your trial ends in {days} day{days === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-[#b45309]">
                  Upgrade before {shortDate(expiresAt)} to keep all features.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/upgrade"
              className="shrink-0 rounded-md bg-[#d97706] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#b45309]"
            >
              Upgrade now
            </Link>
          </div>
        </div>
      );
    }

    // Healthy trial — soft lavender banner (Zapier-style)
    return (
      <div className="sticky top-0 z-40 w-full bg-gradient-to-r from-[#ede9fe] via-[#f3e8ff] to-[#e0e7ff] px-4 py-2">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-700">
              <InfoIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#4c1d95]">
                Welcome to your free trial!
              </p>
              <p className="text-xs text-[#6d28d9]">
                You have {days} day{days === 1 ? "" : "s"} to try all features.{" "}
                <Link href="/dashboard/upgrade" className="font-semibold underline underline-offset-2 hover:text-[#4c1d95]">
                  Upgrade
                </Link>{" "}
                anytime to keep access.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/upgrade"
            className="shrink-0 rounded-md bg-[#7c3aed] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6d28d9]"
          >
            Upgrade now
          </Link>
        </div>
      </div>
    );
  }

  // Fallback
  return <div className="sticky top-0 z-40 h-9 w-full border-b border-white/[0.05] bg-[#161615]" />;
}
