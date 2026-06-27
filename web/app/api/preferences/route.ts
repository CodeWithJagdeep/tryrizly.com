import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type Preferences = {
  timezone: string;
  honorific: string;
  language?: string;
};

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const result = await callGateway<Preferences>(
    `/api/preferences?userId=${encodeURIComponent(session.userId)}`,
  );
  return Response.json(result);
}
