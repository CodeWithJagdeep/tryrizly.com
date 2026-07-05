"use client";

import Link from "next/link";
import { CreditsBadge } from "./CreditsBadge";

function HelpIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M6.2 6.3a1.8 1.8 0 1 1 2.6 1.62c-.5.26-.8.55-.8 1.08v.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="11.2" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

/**
 * Permanent app chrome, deliberately separate from TrialBar — that component
 * is about trial/subscription *state* and its content (or presence) can
 * change with billing status; credits and help must stay visible regardless
 * of plan state, so they live in their own always-mounted row instead of
 * being injected into every TrialBar branch.
 */
export function DashboardHeader() {
  return (
    <div className="sticky top-0 z-30 flex h-12 w-full shrink-0 items-center justify-end gap-2 border-b border-slate-200 bg-white px-4 lg:px-6">
      <CreditsBadge />
      <Link
        href="/faq"
        title="Help & FAQ"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
      >
        <HelpIcon />
      </Link>
    </div>
  );
}
