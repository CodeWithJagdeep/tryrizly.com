import type { Metadata } from "next";
import { ForgotPasswordForm } from "../components/auth/ForgotPasswordForm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a password reset link for your Rizly account.",
  alternates: { canonical: `${SITE_URL}/forgot-password` },
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
