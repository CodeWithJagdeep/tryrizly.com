import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const baseId = new URL(request.url).searchParams.get("baseId");
  if (!baseId) {
    return Response.json({ connected: false, tables: [] });
  }

  const result = await callGateway(
    `/api/automations/airtable-tables?userId=${encodeURIComponent(session.userId)}&baseId=${encodeURIComponent(baseId)}`,
  );
  return Response.json(result);
}
