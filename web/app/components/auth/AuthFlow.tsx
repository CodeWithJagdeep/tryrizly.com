"use client";

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
      className={`grid h-12 w-full grid-cols-[48px_1fr_48px] items-center rounded-xl border border-black/15 bg-black/[0.04] text-black transition duration-200 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <span className="flex items-center justify-center">{icon}</span>
      <span className="text-center text-sm font-medium leading-none text-black">
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

  const fieldClass =
    "mt-2 h-12 w-full rounded-xl border border-black/15 bg-black/[0.03] px-4 text-sm font-medium text-black outline-none transition placeholder:text-black/35 focus:border-[#8b5fbf] focus:ring-2 focus:ring-[#8b5fbf]/15";
  const primaryButtonClass =
    "mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="font-display relative flex flex-1 flex-col overflow-hidden bg-black pt-0 pb-10 pl-10 pr-10 text-black antialiased sm:pb-14 sm:pl-14 sm:pr-14">
      <div className="mx-auto flex w-full max-w-8xl flex-1 flex-col overflow-hidden rounded-2xl bg-white">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 pb-16 pt-8 text-center sm:px-8 sm:pb-20 sm:pt-10 lg:px-12 lg:pb-24 lg:pt-12">
            <div className="mb-8">
              <h1 className="mx-auto w-full max-w-full pt-8 text-4xl font-normal leading-[1.1] tracking-[-0.02em] text-black">
                Never miss something important.
              </h1>
              <p className="mx-auto mt-3 max-w-full text-base leading-7 text-black/55">
                {mode === "login" ? "Sign in with your work email" : "Sign up with your work email"}
              </p>
            </div>

            <div className="grid w-full gap-3">
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

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-black/10" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/35">or use email</span>
              <div className="h-px flex-1 bg-black/10" />
            </div>

            {error && (
              <div role="alert" className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {pendingVerifyEmail ? (
              <>
                <form onSubmit={handleVerifyOtp} className="w-full">
                  <label className="block text-sm font-medium text-black/90">
                    6-digit code sent to {pendingVerifyEmail}
                  </label>
                  <input
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    autoFocus
                    className={`${fieldClass} text-center tracking-[0.35em]`}
                  />
                  <button type="submit" disabled={Boolean(loading) || otp.length !== 6} className={primaryButtonClass}>
                    {loading === "email" && <Spinner />}
                    Verify and continue
                  </button>
                </form>
                <p className="mt-4 text-center text-sm text-black/50">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending}
                    className="font-semibold text-black underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:opacity-50"
                  >
                    {resent ? "Code resent — check your inbox" : resending ? "Sending…" : "Resend code"}
                  </button>
                </p>
              </>
            ) : (
              <>
                <form onSubmit={handleEmailLogin} className="w-full">
                  <label className="block text-sm font-medium text-black/90">Email address</label>
                  <input
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (showPassword) setShowPassword(false);
                    }}
                    placeholder="you@company.com"
                    type="email"
                    autoComplete="username"
                    required
                    className={fieldClass}
                  />

                  {showPassword && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-black/90">Password</label>
                        {mode === "login" && (
                          <Link
                            href="/forgot-password"
                            className="text-xs font-medium text-black/50 underline-offset-4 hover:text-black hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
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
                        className={fieldClass}
                      />
                    </div>
                  )}

                  <button type="submit" disabled={Boolean(loading)} className={primaryButtonClass}>
                    {loading === "email" && <Spinner />}
                    {showPassword ? (mode === "signup" ? "Create workspace" : "Sign in") : "Continue"}
                  </button>
                </form>

                <p className="mt-4 text-center text-base text-black/70">
                  {mode === "login" ? "New to Rizly? " : "Already have an account? "}
                  <button
                    type="button"
                    onClick={() => navigateToMode(mode === "login" ? "signup" : "login")}
                    className="font-semibold text-black underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                  >
                    {mode === "login" ? "Create a workspace" : "Log in"}
                  </button>
                </p>

                <p className="mx-auto mt-6 max-w-full text-center text-sm leading-6 text-black/70">
                  By continuing, you agree to the{" "}
                  <Link href="/terms" className="font-medium text-black/60 underline underline-offset-2 hover:text-black">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="font-medium text-black/60 underline underline-offset-2 hover:text-black">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
      </div>
    </div>
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
