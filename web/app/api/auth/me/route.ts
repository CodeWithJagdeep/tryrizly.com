import { cookies } from "next/headers";
import { verifyAuthToken } from "../_lib/auth-store";

export async function GET() {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const user = verifyAuthToken(token);
  if (!user) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  return Response.json({ email: user.email, name: user.name });
}
