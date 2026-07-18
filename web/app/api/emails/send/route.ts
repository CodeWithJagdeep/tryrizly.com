import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type Body = {
  to?: string;
  subject?: string;
  body?: string;
  threadId?: string;
  inReplyTo?: string;
  sendAt?: string;
};

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const body = (await request.json()) as Body;
  if (!body.to || !body.subject || !body.body) {
    return Response.json({ message: "to, subject and body are required" }, { status: 400 });
  }
  if (body.sendAt) {
    const sendAt = new Date(body.sendAt);
    if (Number.isNaN(sendAt.getTime()) || sendAt.getTime() <= Date.now()) {
      return Response.json({ message: "sendAt must be a valid future date" }, { status: 400 });
    }
    body.sendAt = sendAt.toISOString();
  }
  const result = await callGateway<{ approval: { id: string; preview: string } }>(
    "/api/approvals/propose",
    {
      userId: session.userId,
      tool: "send_email",
      payload: body,
      preview: `${body.sendAt ? "Schedule" : "Send"} email to ${body.to} with subject: ${body.subject}`,
    },
  );
  return Response.json({ ok: true, approvalRequired: true, ...result }, { status: 202 });
}
