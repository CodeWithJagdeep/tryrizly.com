import { Suspense } from 'react';
import { AuthFlow } from "../components/auth/AuthFlow";

export const metadata = {
  title: "Sign up",
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-black p-6 min-h-[calc(100vh-3rem)]">
        <div className="text-sm font-medium text-white/40">Loading authentication...</div>
      </div>
    }>
      <AuthFlow initialMode="signup" />
    </Suspense>
  );
}
