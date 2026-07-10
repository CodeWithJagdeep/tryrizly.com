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

  function dismiss(choice: "accepted" | "rejected") {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Non-fatal — worst case it reappears next visit.
    }
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-left shadow-[0_24px_80px_-35px_rgba(15,23,42,0.45)]"
      role="dialog"
      aria-label="Cookie preferences"
    >
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-normal text-slate-950">Cookies</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            We use one essential cookie to keep you signed in — no analytics or ad tracking. See our{" "}
            <Link href="/privacy" className="text-slate-900 underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => dismiss("rejected")}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-normal text-slate-950 transition hover:bg-slate-50"
          >
            Reject all
          </button>
          <button
            type="button"
            onClick={() => dismiss("accepted")}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-normal text-white transition hover:bg-slate-800"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
