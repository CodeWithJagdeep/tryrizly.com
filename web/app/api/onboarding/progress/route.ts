import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "../_lib/require-user";

// Only the client-driven steps live here. `telegramLinked`/`completedAt` are
// only ever set by the Telegram webhook once a real link token is consumed —
// never trust the browser for those.
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const body = (await request.json()) as {
    source?: string;
    googleConnected?: boolean;
    completedAt?: string;
  };
  const patch: { source?: string; googleConnected?: boolean; completedAt?: string } = {};
  if (typeof body.source === "string") patch.source = body.source;
  if (typeof body.googleConnected === "boolean") patch.googleConnected = body.googleConnected;
  if (typeof body.completedAt === "string") patch.completedAt = body.completedAt;

  const result = await callGateway<{ ok?: boolean; error?: string }>(
    "/api/auth/onboarding/progress",
    { email: session.email, ...patch },
  );
  if (result?.error) {
    return Response.json({ message: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
