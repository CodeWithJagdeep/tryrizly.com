import { callGateway } from "../../_lib/gateway";

// Always responds the same way regardless of whether the email has an
// account — the response itself must not become an enumeration oracle.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  if (typeof body.email === "string" && body.email.trim()) {
    await callGateway("/api/auth/password/forgot", { email: body.email.trim() }).catch(() => undefined);
  }
  return Response.json({ ok: true });
}
