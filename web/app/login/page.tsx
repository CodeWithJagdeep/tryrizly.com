'use client';

import { Suspense } from 'react';
import { AuthFlow } from "../components/auth/AuthFlow";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center p-6 min-h-[calc(100vh-3rem)]">
        <div className="text-body-small font-mono text-text-muted">Loading authentication...</div>
      </div>
    }>
      <AuthFlow initialMode="login" />
    </Suspense>
  );
}
