"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "rizly-cookie-notice-dismissed";

/**
 * Rizly doesn't run analytics or ad-tracking scripts — the only cookie is the
 * essential auth session, which GDPR/ePrivacy exempt from consent. This is
 * an honest notice, not a consent-manager: it doesn't claim to offer opt-out
 * of something that doesn't exist. Revisit if analytics/tracking is ever
 * added — that would need real opt-in consent, not just this notice.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage unavailable (private browsing etc.) — skip rather than nag every load.
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Non-fatal — worst case it reappears next visit.
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.15)] sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600">
          We use one essential cookie to keep you signed in — no analytics or ad tracking. See our{" "}
          <Link href="/privacy" className="font-semibold text-slate-900 underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#FE7F2D]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
