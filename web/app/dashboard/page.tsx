import { Suspense } from "react";
import { requireSession } from "../api/onboarding/_lib/require-user";
import { ChatHome } from "./components/ChatHome";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  await requireSession();
  return (
    <Suspense fallback={null}>
      <ChatHome />
    </Suspense>
  );
}
