"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SlackIcon, TelegramIcon } from "../../components/ConnectorIcons";

const DISMISS_KEY = "rizly-telegram-banner-dismissed";

/**
 * Persistent nudge for users who haven't linked any chat channel — reminders,
 * briefs, and approvals are delivered there, so an unlinked user is missing
 * most of the product. Dismissal lasts for the browser session only.
 */
export function TelegramBanner() {
  const pathname = usePathname();
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const [slackLinked, setSlackLinked] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    fetch("/api/telegram")
      .then((r) => r.json())
      .then((d: { linked?: boolean }) => setTelegramLinked(Boolean(d.linked)))
      .catch(() => setTelegramLinked(null));
    fetch("/api/slack")
      .then((r) => r.json())
      .then((d: { linked?: boolean }) => setSlackLinked(Boolean(d.linked)))
      .catch(() => setSlackLinked(null));
  }, []);

  const anyLinked = telegramLinked === true || slackLinked === true;
  const statusKnown = telegramLinked !== null && slackLinked !== null;

  if (!statusKnown || anyLinked || dismissed || pathname?.startsWith("/dashboard/channels")) return null;

  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex shrink-0 -space-x-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-white">
            <TelegramIcon className="h-full w-full" />
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-white">
            <SlackIcon className="h-full w-full" />
          </span>
        </span>
        <p className="min-w-0 truncate text-sm text-black">
          Channels disconnected. Link Telegram or Slack to chat with Rizly anytime.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/dashboard/channels"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-black px-4 text-sm font-medium text-white transition hover:opacity-90"
        >
          Connect
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
