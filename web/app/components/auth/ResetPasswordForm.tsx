"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import api from "@/lib/api";
import { getErrorMessage, Spinner } from "@/app/components/auth/AuthShared";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/password/reset", { token, password });
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(getErrorMessage(err, "This reset link is invalid or has expired."));
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
            {!token ? (
              <>
                <h1 className="text-xl font-semibold text-slate-950">Invalid link</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This reset link is missing its token. Request a new one from the sign-in page.
                </p>
              </>
            ) : done ? (
              <>
                <h1 className="text-xl font-semibold text-slate-950">Password updated</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Redirecting you to sign in with your new password…
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-slate-950">Choose a new password</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  This will sign you out everywhere else, for safety.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600">New password</label>
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      autoFocus
                      className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#FE7F2D] focus:shadow-[0_0_0_3px_rgba(254,127,45,0.15)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Confirm password</label>
                    <input
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      placeholder="Re-enter your new password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#FE7F2D] focus:shadow-[0_0_0_3px_rgba(254,127,45,0.15)]"
                    />
                  </div>

                  {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading && <Spinner />}
                    Update password
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
