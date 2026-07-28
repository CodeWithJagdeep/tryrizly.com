import { Suspense } from 'react';
import type { Metadata } from "next";
import { AuthFlow } from "../components/auth/AuthFlow";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Log In",
  description: "Sign in to your Rizly workspace to review approvals, drafts, and your daily brief.",
  alternates: { canonical: `${SITE_URL}/login` },
  openGraph: {
    title: "Log In",
    description: "Sign in to your Rizly workspace.",
    url: `${SITE_URL}/login`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Log In",
    description: "Sign in to your Rizly workspace.",
  },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-1 items-center justify-center bg-black p-6">
        <div className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
          Preparing your workspace…
        </div>
      </div>
    }>
      <AuthFlow initialMode="login" />
    </Suspense>
  );
}
