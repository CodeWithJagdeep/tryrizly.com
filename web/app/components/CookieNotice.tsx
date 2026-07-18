"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_EVENT } from "./Analytics";

const STORAGE_KEY = COOKIE_CONSENT_KEY;

/**
 * Real opt-in consent gate, not just a notice: the essential auth-session
 * cookie is GDPR/ePrivacy-exempt and always set, but Google Analytics and
 * Microsoft Clarity (see Analytics.tsx) load only after "Accept all". The
 * stored choice is broadcast via COOKIE_CONSENT_EVENT so analytics start or
 * stay off in the same session without a reload.
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
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: choice }));
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
            We use one essential cookie to keep you signed in, plus optional analytics (Google
            Analytics, Microsoft Clarity) to improve Rizly — those only run if you accept. See our{" "}
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
