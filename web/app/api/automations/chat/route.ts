import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

// The flow-builder's chat panel. Unlike /api/chat (the general assistant),
// this talks to ai-core's dedicated builder agent: it receives the flow
// currently on the canvas and returns edit operations plus a reply, with no
// tool loop and no connector involvement.

type BuilderChatBody = {
  flowId?: string;
  name?: string;
  steps?: unknown;
  message?: string;
  history?: Array<{ role?: string; content?: string }>;
};

type BuilderChatReply = {
  ok?: boolean;
  reply?: string;
  thinking?: string;
  name?: string;
  operations?: unknown[];
  error?: string;
};

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as BuilderChatBody | null;
  const message = body?.message?.trim();
  if (!message) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const result = await callGateway<BuilderChatReply>("/api/automations/builder-chat", {
    userId: session.userId,
    message,
    history: Array.isArray(body?.history) ? body?.history : [],
    flow: { id: body?.flowId, name: body?.name, steps: body?.steps },
  }).catch(() => null);

  // typeof-check catches gateway error blobs (e.g. a Nest 500 body) that
  // parse as JSON but carry no reply — those must not be relayed as success.
  if (!result || result.ok === false || result.error || typeof result.reply !== "string") {
    const detail =
      result?.error === "ai_budget_exceeded"
        ? "Your AI budget for this cycle is used up."
        : "The assistant didn't respond — try that again.";
    return Response.json({ error: detail }, { status: 502 });
  }
  return Response.json(result);
}
