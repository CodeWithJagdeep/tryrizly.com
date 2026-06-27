import { callGateway } from "../../_lib/gateway";
import { jsonError } from "../../_lib/auth-store";

type RegisterResult = { email?: string; needsVerification?: boolean; error?: string; conflict?: boolean };

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; email?: string; password?: string };

  const result = await callGateway<RegisterResult>("/api/auth/register", body);
  if (result.error) {
    return jsonError(result.error, result.conflict ? 409 : 400);
  }

  return Response.json({ email: result.email, needsVerification: true });
}
