"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import api from "@/lib/api";
import { getErrorMessage, Spinner } from "@/app/components/auth/AuthShared";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/password/forgot", { email });
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-white px-4 py-8 text-slate-950 antialiased sm:px-6 lg:px-10">
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[460px] items-center justify-center pt-16">
        <div className="w-full">
          <Link href="/" className="mx-auto flex w-fit items-center gap-2">
            <Image src="/rizly_white.png" alt="Rizly" width={112} height={26} className="h-8 w-auto object-contain" />
          </Link>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {sent ? (
              <>
                <h1 className="text-xl font-semibold text-slate-950">Check your email</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  If an account exists for <span className="font-medium text-slate-700">{email}</span>, a password
                  reset link is on its way. It expires in 30 minutes.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-slate-950">Reset your password</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Enter the email on your account and we&apos;ll send you a reset link.
                </p>

                <form onSubmit={handleSubmit} className="mt-6">
                  <label className="block text-sm font-medium text-slate-600">Email</label>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#D9BEF4] focus:shadow-[0_0_0_3px_rgba(217,190,244,0.15)]"
                  />

                  {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading && <Spinner />}
                    Send reset link
                  </button>
                </form>
              </>
            )}

            <p className="mt-5 text-center text-sm font-medium text-slate-500">
              <Link href="/login" className="font-semibold text-slate-950 underline-offset-2 hover:underline">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
