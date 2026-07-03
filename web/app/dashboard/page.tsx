import { Suspense } from "react";
import { requireSession } from "../api/onboarding/_lib/require-user";
import { ChatHome } from "./components/ChatHome";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await requireSession();
  return (
    <Suspense fallback={null}>
      <ChatHome name={session?.name} />
    </Suspense>
  );
}
