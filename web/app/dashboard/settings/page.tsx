import { SettingsClient } from "./settings-client";
import { requireSession } from "../../api/onboarding/_lib/require-user";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <SettingsClient
      email={session?.email ?? ""}
      name={session?.name}
    />
  );
}
