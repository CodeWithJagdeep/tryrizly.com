'use client';

import { Suspense } from 'react';
import { AuthFlow } from "../components/auth/AuthFlow";

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center p-6 min-h-[calc(100vh-3rem)]">
        <div className="text-sm font-medium text-gray-400">Loading authentication...</div>
      </div>
    }>
      <AuthFlow initialMode="signup" />
    </Suspense>
  );
}
