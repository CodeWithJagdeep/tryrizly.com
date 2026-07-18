import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type GatewayError = { error?: string; message?: string; statusCode?: number };

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  let connectors: unknown;
  try {
    connectors = await callGateway(`/api/connectors?userId=${encodeURIComponent(session.userId)}`);
  } catch {
    return Response.json({ message: "Connector service unreachable" }, { status: 502 });
  }
  // The gateway returns an array on success; anything else is an error payload.
  if (!Array.isArray(connectors)) {
    const payload = connectors as GatewayError;
    return Response.json(
      { message: payload?.message ?? payload?.error ?? "Failed to load connectors" },
      { status: 502 },
    );
  }
  return Response.json(connectors);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ message: "Invalid connector request" }, { status: 400 });
  }

  let result: GatewayError;
  try {
    result = await callGateway<GatewayError>("/api/connectors", {
      ...body,
      userId: session.userId,
      metadata: {
        ...(typeof body.metadata === "object" && body.metadata ? body.metadata : {}),
        webSessionEmail: session.email,
      },
    });
  } catch {
    return Response.json({ message: "Connector service unreachable" }, { status: 502 });
  }

  if (result?.error || result?.message || (result?.statusCode ?? 0) >= 400) {
    return Response.json(
      { message: result.message ?? result.error ?? "Could not save connector" },
      { status: 400 },
    );
  }

  return Response.json(result);
}
