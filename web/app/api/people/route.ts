import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";

type PersonRow = {
  id: string;
  type: "person" | "company";
  canonicalName: string;
  createdAt: string;
  emails: string[];
  phones: string[];
  urls: string[];
};

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const params = new URLSearchParams({ userId: session.userId, limit: "60" });
  const people = await callGateway<PersonRow[]>(`/api/people?${params.toString()}`).catch(() => []);

  return Response.json({ people: people ?? [] });
}
