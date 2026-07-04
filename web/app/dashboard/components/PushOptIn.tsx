"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Browser-notification opt-in, shown only when Telegram is NOT linked.
 * Telegram is the primary channel; web push is the fallback so unlinked
 * users still get briefs, reminders, and approval prompts.
 */
export function PushOptIn() {
  const [state, setState] = useState<
    "hidden" | "available" | "enabling" | "enabled" | "blocked"
  >("hidden");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

    fetch("/api/telegram")
      .then((r) => r.json())
      .then(async (data: { linked?: boolean }) => {
        if (data.linked) return; // Telegram covers notifications; stay hidden.
        if (Notification.permission === "denied") {
          setState("blocked");
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        const existing = await registration?.pushManager.getSubscription();
        setState(existing ? "enabled" : "available");
      })
      .catch(() => null);
  }, []);

  async function enable() {
    setState("enabling");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "available");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setState("enabled");
    } catch {
      setState("available");
    }
  }

  if (state === "hidden") return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-900">Browser notifications</p>
        <p className="mt-0.5 text-sm text-slate-500">
          {state === "enabled"
            ? "Enabled. Briefs, reminders, and approvals will reach this browser until you link Telegram."
            : state === "blocked"
              ? "Blocked in your browser settings. Allow notifications for this site to receive alerts here."
              : "Telegram isn't linked yet. Get briefs, reminders, and approval prompts in this browser instead."}
        </p>
      </div>
      {state !== "enabled" && state !== "blocked" && (
        <button
          type="button"
          onClick={() => void enable()}
          disabled={state === "enabling"}
          className="shrink-0 rounded-lg bg-[#FE7F2D] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
        >
          {state === "enabling" ? "Enabling…" : "Enable notifications"}
        </button>
      )}
    </div>
  );
}
