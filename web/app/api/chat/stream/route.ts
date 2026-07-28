import { gatewayHeaders } from "../../auth/_lib/gateway";
import { requireSession } from "../../onboarding/_lib/require-user";

// SSE proxy for the dashboard chat's live "what I'm doing" trace. Plain
// /api/chat (the non-streaming route) is unaffected and still used by
// anything that doesn't need live progress.

const gatewayUrl =
  process.env.NEXT_PUBLIC_GATEWAY_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:4000" : "https://api.getrizly.com");

type ChatTurn = { role: "user" | "assistant"; content: string };

type ChatBody = {
  message?: string;
  history?: ChatTurn[];
  approve?: boolean;
  pendingApprovalId?: string;
};

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ChatBody | null;
  const message = body?.message?.trim();
  if (!message) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const upstream = await fetch(`${gatewayUrl}/api/ai/chat/stream`, {
    method: "POST",
    headers: gatewayHeaders(true),
    body: JSON.stringify({
      userId: session.userId,
      message,
      history: body?.history ?? [],
      ...(body?.approve ? { approve: true, pendingApprovalId: body.pendingApprovalId } : {}),
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!upstream || !upstream.body) {
    return Response.json({ error: "Failed to reach the assistant." }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
