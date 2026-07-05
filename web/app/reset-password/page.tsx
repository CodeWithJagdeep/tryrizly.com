import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "../components/auth/ResetPasswordForm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your Rizly account.",
  alternates: { canonical: `${SITE_URL}/reset-password` },
  robots: { index: false, follow: true },
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="text-sm font-medium text-gray-400">Loading…</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
