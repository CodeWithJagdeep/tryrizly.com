import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "../api/onboarding/_lib/require-user";
import { ChatSidebar } from "./components/ChatSidebar";
import { DashboardContentShell } from "./components/DashboardContentShell";
import { MobileNav } from "./components/MobileNav";
import { WelcomeTour } from "./components/WelcomeTour";

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
      <div className="relative flex min-h-0 flex-1">
        <Suspense fallback={null}>
          <ChatSidebar />
        </Suspense>
        <DashboardContentShell>
          {children}
        </DashboardContentShell>
      </div>
      <MobileNav />
      <WelcomeTour />
    </div>
  );
}
