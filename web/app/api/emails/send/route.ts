import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type Body = {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  sendAt?: string;
};

type SendReplyResult = {
  ok: boolean;
  scheduled?: boolean;
  sendAt?: string;
  messageId?: string;
  threadId?: string;
  error?: string;
  placeholder?: string;
};

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const body = (await request.json()) as Body;
  if (!body.to || !body.subject || !body.body) {
    return Response.json({ message: "to, subject and body are required" }, { status: 400 });
  }

  const result = await callGateway<SendReplyResult>("/api/emails/send", {
    userId: session.userId,
    ...body,
  });

  if (!result.ok) {
    return Response.json(result, { status: 422 });
  }
  return Response.json(result);
}
