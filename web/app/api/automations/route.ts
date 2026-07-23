import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const data = await callGateway<{ flows?: unknown[]; error?: string }>(
    `/api/automations?userId=${encodeURIComponent(session.userId)}`,
  ).catch(() => null);
  if (!data || data.error) {
    return Response.json({ message: data?.error ?? "Automations service unreachable" }, { status: 502 });
  }
  return Response.json({ flows: data.flows ?? [] });
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
    return Response.json({ message: "Invalid automation request" }, { status: 400 });
  }

  const data = await callGateway<{ flow?: unknown; error?: string }>("/api/automations", {
    ...body,
    userId: session.userId,
  }).catch(() => null);
  if (!data || data.error) {
    return Response.json({ message: data?.error ?? "Could not save automation" }, { status: 400 });
  }
  return Response.json({ flow: data.flow });
}
