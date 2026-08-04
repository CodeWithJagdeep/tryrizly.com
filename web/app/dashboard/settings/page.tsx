import { Suspense } from "react";
import { SettingsClient } from "./settings-client";
import { requireSession } from "../../api/onboarding/_lib/require-user";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <Suspense fallback={null}>
      <SettingsClient
        email={session?.email ?? ""}
        name={session?.name}
      />
    </Suspense>
  );
}
