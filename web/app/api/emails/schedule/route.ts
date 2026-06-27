import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type Body = {
  to: string;
  subject: string;
  body: string;
  sendAt: string;
};

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const body = (await request.json()) as Body;
  if (!body.to || !body.subject || !body.body || !body.sendAt) {
    return Response.json({ message: "to, subject, body and sendAt are required" }, { status: 400 });
  }

  const result = await callGateway<{ ok: boolean; sendAt: string }>(
    "/api/emails/schedule",
    { userId: session.userId, ...body },
  );

  return Response.json(result, { status: 202 });
}
