import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type Body = {
  instructions?: string;
};

type DraftReplyResult = {
  connected: boolean;
  to?: string;
  subject?: string;
  body?: string;
  threadId?: string;
  inReplyTo?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const { messageId } = await params;
  const body = (await request.json().catch(() => ({}))) as Body;

  const result = await callGateway<DraftReplyResult>(
    `/api/emails/${encodeURIComponent(messageId)}/draft-reply`,
    { userId: session.userId, instructions: body.instructions },
  );

  if (!result.connected) {
    return Response.json({ message: "Not connected" }, { status: 409 });
  }
  return Response.json(result);
}
