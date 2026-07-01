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

type ConnectorRow = {
  provider: string;
};

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const params = new URLSearchParams({ userId: session.userId, limit: "60" });
  const [people, connectorsRaw] = await Promise.all([
    callGateway<PersonRow[]>(`/api/people?${params.toString()}`).catch(() => []),
    callGateway<ConnectorRow[]>(`/api/connectors?userId=${encodeURIComponent(session.userId)}`).catch(() => null),
  ]);

  const gmailConnected = (connectorsRaw ?? []).some((c) => c.provider === "google");

  return Response.json({ people: people ?? [], gmailConnected });
}
