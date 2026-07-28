"use client";

import { useEffect, useState } from "react";

type OnboardingStatus = {
  onboarding?: { dashboardTourSeenAt?: string };
  email?: string;
};

type Step = {
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    title: "Welcome to Rizly",
    body: "I'm Riz, your AI operator. Ask me anything from the chat, or just wait — I'll message you when something needs your attention.",
  },
  {
    title: "Connect your inbox",
    body: "Link Gmail from Connectors so I can triage email, draft replies, and catch what matters. I'll never send anything without your approval first.",
  },
  {
    title: "Get notified on Telegram",
    body: "Link Telegram from Settings so reminders, morning briefs, and approval requests land directly in your chat — not just in the dashboard.",
  },
  {
    title: "Track your AI credits",
    body: "Every plan includes AI credits for chat and background work. Check your balance and top up any time from the credits badge in the header.",
  },
  {
    title: "Explore your workspace",
    body: "People, Meetings, Calendar, and Emails live in the sidebar — Rizly builds all of them automatically from what it sees in your connected accounts.",
  },
];

/**
 * One-time, per-account welcome tour. Shown once — dismissing/finishing it
 * marks onboarding.dashboardTourSeenAt server-side (same pattern as the rest
 * of onboarding state), so it never reappears on this account, on any device.
 */
export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data: OnboardingStatus) => {
        const key = welcomeTourStorageKey(data.email);
        setStorageKey(key);
        if (data.onboarding?.dashboardTourSeenAt || localStorage.getItem(key)) return;
        setOpen(true);
      })
      .catch(() => undefined);
  }, []);

  async function finish() {
    if (dismissing) return;
    setDismissing(true);
    setOpen(false);
    if (storageKey) localStorage.setItem(storageKey, new Date().toISOString());
    try {
      const res = await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dashboardTourSeenAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("tour_save_failed");
    } catch {
      // Non-fatal — local storage already prevents repeat prompts on this browser.
    }
  }

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Rizly"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D9BEF4]/10 text-[#D9BEF4]">
            <SparkleIcon />
          </span>
          <button
            type="button"
            onClick={() => void finish()}
            aria-label="Close"
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <CloseIcon />
          </button>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">{current.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{current.body}</p>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition ${i === step ? "bg-[#D9BEF4]" : "bg-slate-200"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? void finish() : setStep((s) => s + 1))}
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-[#D9BEF4]"
            >
              {isLast ? "Get started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function welcomeTourStorageKey(email: string | undefined): string {
  return `rizly:welcome-tour-seen:${email?.trim().toLowerCase() || "current"}`;
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M8 1.5l1.1 3.4L12.5 6l-3.4 1.1L8 10.5l-1.1-3.4L3.5 6l3.4-1.1L8 1.5Z" />
      <path d="M13 9.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
