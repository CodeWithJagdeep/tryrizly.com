import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "../../_lib/require-user";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";
  const body = (await request.json().catch(() => ({}))) as { returnTo?: string };
  // Lets the automation builder send the caller back to the flow it was
  // editing instead of always landing on /dashboard/discord.
  const returnTo = typeof body.returnTo === "string" && body.returnTo.startsWith("/") ? body.returnTo : undefined;

  const [{ token }, config] = await Promise.all([
    callGateway<{ token: string }>("/api/auth/onboarding/discord-token", { email: session.email, returnTo }),
    fetch(`${gatewayUrl}/api/discord/config`)
      .then((res) => (res.ok ? (res.json() as Promise<{ installConfigured: boolean }>) : null))
      .catch(() => null),
  ]);

  return Response.json({
    // "Add to Discord" bot-install OAuth — needs DISCORD_CLIENT_ID +
    // DISCORD_SURFACE_REDIRECT_URI configured on the gateway.
    installUrl: config?.installConfigured
      ? `${gatewayUrl}/api/discord/install?token=${encodeURIComponent(token)}`
      : null,
    // Manual fallback: paste this in a DM with the Rizly Discord bot.
    linkCommand: `link ${token}`,
  });
}
