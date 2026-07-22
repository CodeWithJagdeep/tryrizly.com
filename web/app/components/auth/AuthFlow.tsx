"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import {
  getErrorMessage,
  getRequestedPlan,
  GoogleIcon,
  LinkedInIcon,
  Spinner,
} from "@/app/components/auth/AuthShared";

type AuthResponse = {
  isNew?: boolean;
  next?: string;
  needsVerification?: boolean;
  email?: string;
  user?: { name?: string };
};

function AuthOption({
  icon,
  label,
  onClick,
  disabled,
  className = "",
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`grid h-[52px] w-full grid-cols-[56px_1fr_56px] items-center rounded-full border border-black/70 bg-white text-slate-950 transition hover:border-black hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <span className="flex items-center justify-center">{icon}</span>
      <span className="text-center text-base font-normal leading-none text-slate-950">
        {label}
      </span>
      <span aria-hidden="true" />
    </button>
  );
}

export function AuthFlow({ initialMode }: { initialMode: "login" | "signup" }) {
  const params = useSearchParams();
  const router = useRouter();
  const requestedPlan = getRequestedPlan(params.get("plan"));

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const mode = initialMode;

  useEffect(() => {
    const next = sanitizeReturnPath(params.get("next"));
    api
      .get("/auth/me")
      .then(async () => {
        // Already signed in. Users who never finished onboarding go there,
        // not to the dashboard, otherwise they can never reach the flow again.
        try {
          const res = await fetch("/api/onboarding/status");
          const data = (await res.json()) as { onboarding?: { completedAt?: string } };
          if (res.ok && !data.onboarding?.completedAt) {
            router.replace("/onboarding");
            return;
          }
        } catch {
          // fall through to the dashboard on status errors
        }
        router.replace(
          next || (requestedPlan ? `/dashboard?plan=${requestedPlan}` : "/dashboard"),
        );
      })
      .catch(() => null);
  }, [router, params, requestedPlan]);

  function navigateToMode(next: "login" | "signup", keepError = false) {
    const qs = new URLSearchParams(params.toString());
    if (!keepError) setError(null);
    setShowPassword(false);
    setPassword("");
    router.push(`/${next === "signup" ? "signup" : "login"}${qs.toString() ? `?${qs.toString()}` : ""}`);
  }

  function getPostAuthDestination(data: AuthResponse) {
    const next = sanitizeReturnPath(params.get("next"));
    if (data?.isNew) return "/onboarding";
    return next || (requestedPlan ? `/dashboard?plan=${requestedPlan}` : sanitizeReturnPath(data?.next) || "/dashboard");
  }

  const handleLinkedInLogin = () => {
    const next = sanitizeReturnPath(params.get("next"));
    const returnTo = next || (requestedPlan ? `/dashboard?plan=${requestedPlan}` : "/dashboard");
    setLoading("linkedin");
    window.location.href = `/api/auth/oauth/linkedin?return_to=${encodeURIComponent(returnTo)}`;
  };

  const handleGoogleLogin = () => {
    const next = sanitizeReturnPath(params.get("next"));
    const returnTo = next || (requestedPlan ? `/dashboard?plan=${requestedPlan}` : "/dashboard");
    setLoading("google");
    window.location.href = `/api/auth/google?return_to=${encodeURIComponent(returnTo)}`;
  };

  const handleEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!showPassword) {
      setShowPassword(true);
      return;
    }

    setLoading("email");
    try {
      if (mode === "signup") {
        const { data } = await api.post<AuthResponse>("/auth/password/register", { name: email.split("@")[0], email, password });
        setPendingVerifyEmail(data.email ?? email);
        return;
      }
      const { data } = await api.post<AuthResponse>("/auth/password/login", { email, password });
      if (data.needsVerification) {
        setPendingVerifyEmail(data.email ?? email);
        return;
      }
      router.push(getPostAuthDestination(data));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (mode === "signup" && status === 409) {
        setError("That email is already registered. Switching you to sign in.");
        navigateToMode("login", true);
        return;
      }
      setError(getErrorMessage(err, mode === "signup" ? "Could not create your account" : "Could not sign in"));
    } finally {
      setLoading(null);
    }
  };

  const handleVerified = (data: AuthResponse) => {
    router.push(getPostAuthDestination(data));
  };

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingVerifyEmail) return;
    setError(null);
    setLoading("email");
    try {
      const { data } = await api.post<AuthResponse>("/auth/email/verify", { email: pendingVerifyEmail, otp });
      handleVerified(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Invalid or expired code"));
    } finally {
      setLoading(null);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingVerifyEmail) return;
    setResending(true);
    setError(null);
    setResent(false);
    try {
      await api.post("/auth/email/send-verification", { email: pendingVerifyEmail });
      setResent(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not resend code"));
    } finally {
      setResending(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen overflow-hidden bg-white px-4 py-8 text-slate-950 antialiased sm:px-6 lg:px-10"
      style={{
        fontFamily:
          'var(--font-rethink-sans), var(--font-inter-tight), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(254,127,45,0.10),rgba(255,255,255,0))]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(15,23,42,0.07),transparent_34rem)]"
        aria-hidden="true"
      />

      <Link
        href="/"
        className="fixed left-5 top-5 z-20 flex h-9 items-center sm:left-8 sm:top-7"
        aria-label="rizly home"
      >
        <Image src="/rizly_white.png" alt="rizly" width={140} height={33} className="h-10 w-auto object-contain" priority />
      </Link>

      <button
        type="button"
        aria-label="Help"
        className="fixed right-5 bottom-5 z-10 flex h-8 w-8 items-center justify-center border border-slate-300 bg-white text-sm font-normal text-slate-500 transition hover:border-slate-300 hover:text-slate-950"
      >
        ?
      </button>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[460px] items-center justify-center pt-16">
        <div className="w-full">
          <section className="p-6 sm:p-8">
            <div className="mb-8 text-center">
              <p className="text-xs font-normal uppercase tracking-[0.14em] text-slate-400">
                {mode === "login" ? "Welcome back" : "Start with rizly"}
              </p>
              <h1 className="mt-2 text-2xl font-normal tracking-[-0.01em] text-slate-950 sm:text-3xl">
                {mode === "login" ? "Sign in to your workspace" : "Create your workspace"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {mode === "login"
                  ? "Continue to your operator dashboard."
                  : "Set up your operator and connect your work tools."}
              </p>
            </div>

            <div className="flex flex-col gap-3">
          <AuthOption
            icon={loading === "google" ? <Spinner dark /> : <GoogleIcon />}
            label="Continue with Google"
            onClick={handleGoogleLogin}
            disabled={Boolean(loading) || Boolean(pendingVerifyEmail)}
          />
          <AuthOption
            icon={loading === "linkedin" ? <Spinner dark /> : <LinkedInIcon />}
            label="Continue with LinkedIn"
            onClick={handleLinkedInLogin}
            disabled={Boolean(loading) || Boolean(pendingVerifyEmail)}
          />
            </div>

            <div className="mt-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-normal uppercase tracking-[0.12em] text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {error && (
              <div className="mt-5 border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-normal text-rose-700">
                {error}
              </div>
            )}

        {pendingVerifyEmail ? (
          <>
            <form onSubmit={handleVerifyOtp} className="mt-6">
              <label className="block text-base font-normal text-slate-900">
                6-digit code sent to {pendingVerifyEmail}
              </label>
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                className="mt-2 h-[52px] w-full rounded-full border border-black/70 bg-white px-5 text-center text-base font-normal tracking-[0.3em] text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#FE7F2D]"
              />

              <button
                type="submit"
                disabled={Boolean(loading) || otp.length !== 6}
                className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-slate-950 text-base font-normal text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "email" && <Spinner />}
                Verify and continue
              </button>
            </form>

            <p className="mt-5 text-center text-sm font-normal text-slate-500">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending}
                className="font-normal text-slate-950 underline-offset-2 hover:underline disabled:opacity-50"
              >
                {resent ? "Code resent - check your inbox" : resending ? "Sending..." : "Resend code"}
              </button>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleEmailLogin} className="mt-6">
              <div>
                <label className="block text-base font-normal text-slate-900">Email address</label>
                <input
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (showPassword) setShowPassword(false);
                  }}
                  placeholder="Enter email address"
                  type="email"
                  autoComplete="username"
                  required
                  className="mt-2 h-[52px] w-full rounded-full border border-black/70 bg-white px-5 text-base font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#FE7F2D]"
                />
              </div>

              {showPassword && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-base font-normal text-slate-900">Password</label>
                    {mode === "login" && (
                      <Link
                        href="/forgot-password"
                        className="text-xs font-normal text-slate-500 underline-offset-2 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    minLength={8}
                    required
                    autoFocus
                    className="mt-2 h-[52px] w-full rounded-full border border-black/70 bg-white px-5 text-base font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#FE7F2D]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={Boolean(loading)}
                className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-slate-950 text-base font-normal text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "email" && <Spinner />}
                {showPassword ? (mode === "signup" ? "Create account" : "Sign in") : "Continue"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm font-normal text-slate-500">
              {mode === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigateToMode("signup")}
                    className="font-normal text-slate-950 underline-offset-2 hover:underline"
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigateToMode("login")}
                    className="font-normal text-slate-950 underline-offset-2 hover:underline"
                  >
                    Log in
                  </button>
                </>
              )}
            </p>

            <p className="mx-auto mt-7 max-w-[420px] text-center text-xs font-normal leading-5 text-slate-400">
              By continuing, you acknowledge that you understand and agree to the{" "}
              <Link href="/terms" className="text-slate-600 underline underline-offset-2 hover:text-slate-950">
                Terms & Conditions
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-slate-600 underline underline-offset-2 hover:text-slate-950">
                Privacy Policy
              </Link>
            </p>
          </>
        )}
          </section>
        </div>
      </div>
    </main>
  );
}

function sanitizeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "";
  }
  try {
    const parsed = new URL(value, "https://rizly.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "";
  }
}
