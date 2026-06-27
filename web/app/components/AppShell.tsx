"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isAppPage = pathname === "/onboarding" || pathname.startsWith("/dashboard");
  const hideHeader = isAuthPage || isAppPage;

  if (isAuthPage || isAppPage) {
    return <main className="flex flex-1 flex-col">{children}</main>;
  }

  return (
    <>
      {!hideHeader && <Header />}
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </>
  );
}
