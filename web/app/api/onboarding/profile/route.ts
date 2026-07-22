import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "../_lib/require-user";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const body = (await request.json()) as { name?: string; phone?: string };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!name) {
    return Response.json({ message: "Name is required" }, { status: 400 });
  }

  const result = await callGateway<{ ok?: boolean; error?: string }>(
    "/api/auth/onboarding/profile",
    { email: session.email, name, phone: phone || undefined },
  );
  if (result?.error) {
    return Response.json({ message: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
