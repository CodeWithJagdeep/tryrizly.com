import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "../../_lib/require-user";

export async function POST() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";

  const [{ token }, config] = await Promise.all([
    callGateway<{ token: string }>("/api/auth/onboarding/slack-token", { email: session.email }),
    fetch(`${gatewayUrl}/api/slack/config`)
      .then((res) => (res.ok ? (res.json() as Promise<{ installConfigured: boolean }>) : null))
      .catch(() => null),
  ]);

  return Response.json({
    // "Add to Slack" OAuth (production — needs SLACK_CLIENT_ID etc. on the
    // gateway; Slack requires HTTPS, so this is never available on localhost).
    installUrl: config?.installConfigured
      ? `${gatewayUrl}/api/slack/install?token=${encodeURIComponent(token)}`
      : null,
    // Manual fallback: paste this in a DM with the Rizly Slack app.
    linkCommand: `link ${token}`,
  });
}
