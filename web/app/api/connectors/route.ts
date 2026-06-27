import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type GatewayError = { error?: string; message?: string };

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const connectors = await callGateway(`/api/connectors?userId=${encodeURIComponent(session.userId)}`);
  return Response.json(connectors);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const result = await callGateway<GatewayError>("/api/connectors", {
    ...body,
    userId: session.userId,
    metadata: {
      ...(typeof body.metadata === "object" && body.metadata ? body.metadata : {}),
      webSessionEmail: session.email,
    },
  });

  if (result?.error) {
    return Response.json({ message: result.error }, { status: 400 });
  }

  return Response.json(result);
}
