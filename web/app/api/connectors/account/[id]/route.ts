import { deleteGateway, patchGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const result = await deleteGateway<{ ok: boolean }>(
    `/api/connectors/account/${id}?userId=${encodeURIComponent(session.userId)}`,
  );
  return Response.json(result.payload, { status: result.ok ? 200 : 500 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { metadata?: Record<string, unknown> };

  const result = await patchGateway<{ ok?: boolean; error?: string }>(
    `/api/connectors/account/${id}?userId=${encodeURIComponent(session.userId)}`,
    { metadata: body.metadata ?? {} },
  );
  return Response.json(result.payload, { status: result.ok ? 200 : 400 });
}
