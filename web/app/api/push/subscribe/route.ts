import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const body = (await request.json()) as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  };
  if (!body.subscription?.endpoint) {
    return Response.json({ message: "subscription required" }, { status: 400 });
  }

  try {
    const result = await callGateway<{ ok?: boolean; error?: string }>("/api/push/subscribe", {
      userId: session.userId,
      subscription: body.subscription,
    });
    if (!result?.ok) {
      return Response.json({ message: result?.error ?? "subscribe failed" }, { status: 502 });
    }
  } catch {
    return Response.json({ message: "Push service unreachable" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
