import { OnboardingClient } from "./onboarding-client";

export const metadata = {
  title: "Get started",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <OnboardingClient />;
}
