"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CookieNotice } from "./CookieNotice";

type Session = { email: string; name?: string; userId: string };

export function AppShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  const pathname = usePathname();
  const isBareAuthPage =
    pathname === "/forgot-password" || pathname === "/reset-password";
  const isMinimalHeaderAuthPage = pathname === "/login" || pathname === "/signup";
  const isAppPage = pathname === "/onboarding" || pathname.startsWith("/dashboard");

  if (isAppPage || isBareAuthPage) {
    return <main className="flex flex-1 flex-col">{children}</main>;
  }

  if (isMinimalHeaderAuthPage) {
    return (
      <>
        <Header session={session} variant="minimal" />
        <main className="flex flex-1 flex-col">{children}</main>
      </>
    );
  }

  return (
    <>
      <Header session={session} />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
      <CookieNotice />
    </>
  );
}
