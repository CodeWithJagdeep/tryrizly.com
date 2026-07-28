"use client";

import { useState, type FormEvent } from "react";

export function NewsletterSignup() {
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get("email");
    setStatus("submitting");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("submit_failed");
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  if (status === "submitted") {
    return (
      <p className="text-sm font-black uppercase tracking-widest text-emerald-600">
        You&apos;re on the list — first issue lands soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="flex overflow-hidden border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all focus-within:border-[#D9BEF4] focus-within:shadow-[6px_6px_0px_0px_rgba(217,190,244,1)]">
        <input
          type="email"
          name="email"
          required
          placeholder="you@company.com"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-black placeholder:text-gray-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="shrink-0 border-l-2 border-black bg-black px-5 text-[12px] font-black uppercase tracking-wide text-white transition-colors hover:bg-[#D9BEF4] disabled:opacity-60"
        >
          {status === "submitting" ? "…" : "Subscribe"}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-xs font-semibold text-red-600">
          Subscription failed. Please try again.
        </p>
      )}
      <p className="mt-2 text-xs text-gray-400">
        No spam, unsubscribe anytime. See our{" "}
        <a href="/privacy" className="underline">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
