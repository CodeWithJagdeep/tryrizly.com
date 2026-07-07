import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type GmailMessage = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  snippet: string;
  date: string;
  body: string;
  bodyHtml?: string;
  messageIdHeader?: string;
};

type GetMessageResult = {
  connected: boolean;
  message?: GmailMessage;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const { messageId } = await params;
  const query = new URLSearchParams({ userId: session.userId });
  const result = await callGateway<GetMessageResult>(
    `/api/emails/${encodeURIComponent(messageId)}?${query.toString()}`,
  );

  if (!result.connected || !result.message) {
    return Response.json({ message: "Not found" }, { status: 404 });
  }
  return Response.json(result.message);
}
