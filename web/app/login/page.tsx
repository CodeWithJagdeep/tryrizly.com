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
      <div className="flex-1 flex items-center justify-center p-6 min-h-[calc(100vh-3rem)]">
        <div className="text-sm font-medium text-gray-400">Loading authentication...</div>
      </div>
    }>
      <AuthFlow initialMode="login" />
    </Suspense>
  );
}
