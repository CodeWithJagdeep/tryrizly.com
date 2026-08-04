import { NextResponse } from "next/server";
import { callGateway } from "../auth/_lib/gateway";
import { requireSession } from "../onboarding/_lib/require-user";

type ChatTurn = { role: "user" | "assistant"; content: string };

type ChatReply = {
  reply?: string;
  /** Opaque id + human preview only — the real tool/payload never leave the server. */
  pendingApproval?: { id: string; preview: string };
  error?: string;
  upgradeRequired?: boolean;
};

type ChatBody = {
  message?: string;
  history?: ChatTurn[];
  approve?: boolean;
  pendingApprovalId?: string;
  sessionId?: string;
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
      sessionId: body?.sessionId,
      ...(body?.approve ? { approve: true, pendingApprovalId: body.pendingApprovalId } : {}),
    });

    if (result?.upgradeRequired || result?.error === "upgrade_required") {
      return NextResponse.json(
        {
          error: "Your trial has ended. Choose a paid plan to continue using Riz.",
          upgradeRequired: true,
        },
        { status: 402 },
      );
    }

    if (!result?.reply) {
      return NextResponse.json({ error: result?.error || "The assistant didn't respond." }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to reach the assistant." }, { status: 502 });
  }
}
