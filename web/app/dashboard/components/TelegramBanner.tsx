"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const DISMISS_KEY = "rizly-telegram-banner-dismissed";

/**
 * Slim persistent nudge for users who haven't linked Telegram — reminders,
 * briefs, and approvals are delivered there, so an unlinked user is missing
 * most of the product. Dismissal lasts for the browser session only.
 */
export function TelegramBanner() {
  const pathname = usePathname();
  const [linked, setLinked] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    fetch("/api/telegram")
      .then((r) => r.json())
      .then((data: { linked?: boolean }) => setLinked(Boolean(data.linked)))
      .catch(() => setLinked(null));
  }, []);

  if (linked !== false || dismissed || pathname?.startsWith("/dashboard/telegram")) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#FE7F2D]/30 bg-[#FE7F2D]/5 px-5 py-2.5">
      <p className="text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Riz delivers on Telegram.</span>{" "}
        Reminders, morning briefs, and approvals can&apos;t reach you until you link it.
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/dashboard/telegram"
          className="inline-flex items-center justify-center rounded-md border border-[#FE7F2D] bg-[#FE7F2D] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#e96f24]"
        >
          Link Telegram
        </Link>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          className="text-slate-400 transition hover:text-slate-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
