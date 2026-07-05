import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "../api/onboarding/_lib/require-user";
import { ChatSidebar } from "./components/ChatSidebar";
import { CreditsBadge } from "./components/CreditsBadge";
import { MobileNav } from "./components/MobileNav";
import { TelegramBanner } from "./components/TelegramBanner";
import { TrialBar } from "./components/TrialBar";

// Auth-gated app surface — keep the whole tree out of search indexes
// (robots.txt disallow alone doesn't prevent indexing of externally linked URLs).
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <TrialBar />
      <div className="relative flex min-h-0 flex-1">
        <Suspense fallback={null}>
          <ChatSidebar name={session.name} email={session.email} />
        </Suspense>
        <div className="fixed right-4 top-3 z-40 lg:right-6">
          <Suspense fallback={null}>
            <CreditsBadge />
          </Suspense>
        </div>
        <div className="flex min-h-0 flex-1 flex-col pb-16 lg:pb-0 lg:pl-64">
          <TelegramBanner />
          {children}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
