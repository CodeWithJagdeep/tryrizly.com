import { NextResponse } from "next/server";
import { callGateway } from "../auth/_lib/gateway";
import { requireSession } from "../onboarding/_lib/require-user";

type ChatTurn = { role: "user" | "assistant"; content: string };
type PendingApproval = { tool: string; payload: unknown };

type ChatReply = {
  reply?: string;
  pendingApproval?: { tool: string; payload: unknown; preview: string };
  error?: string;
};

type ChatBody = {
  message?: string;
  history?: ChatTurn[];
  approve?: boolean;
  pendingApproval?: PendingApproval;
};

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ChatBody | null;
  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  try {
    const result = await callGateway<ChatReply>("/api/ai/chat", {
      userId: session.userId,
      message,
      history: body?.history ?? [],
      ...(body?.approve ? { approve: true, pendingApproval: body.pendingApproval } : {}),
    });

    if (!result?.reply) {
      return NextResponse.json({ error: result?.error || "The assistant didn't respond." }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to reach the assistant." }, { status: 502 });
  }
}
