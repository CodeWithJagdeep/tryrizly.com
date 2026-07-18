import { cookies } from "next/headers";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";
import { callGateway } from "@/app/api/auth/_lib/gateway";
import { invalidateTokenVersion } from "@/app/api/auth/_lib/session-version";

export async function DELETE(request: Request) {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { confirmation?: string };
  if (body.confirmation?.trim().toLowerCase() !== session.email.trim().toLowerCase()) {
    return Response.json({ message: "Type your account email exactly to confirm deletion." }, { status: 400 });
  }

  const result = await callGateway<{ ok?: boolean; error?: string }>("/api/auth/account/delete", {
    email: session.email,
    confirmation: body.confirmation,
  });
  if (!result.ok) {
    return Response.json({ message: result.error ?? "Account deletion failed" }, { status: 502 });
  }

  invalidateTokenVersion(session.userId);
  (await cookies()).delete("auth_token");
  return Response.json({ ok: true });
}
