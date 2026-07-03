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

const DEMO_PEOPLE_IDS = new Set([
  "sample-person-arjun",
  "sample-person-maya",
  "sample-person-sarah",
  "sample-company-ledgerflow",
  "sample-company-northstar",
]);
const DEMO_CONTACT_DOMAINS = ["northstar.vc", "ledgerflow.io", "brightdesk.co"];

function isDemoPerson(person: PersonRow) {
  if (DEMO_PEOPLE_IDS.has(person.id)) return true;
  return person.emails.some((email) => DEMO_CONTACT_DOMAINS.some((domain) => email.toLowerCase().endsWith(`@${domain}`)));
}

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const params = new URLSearchParams({ userId: session.userId, limit: "60" });
  const [people, connectorsRaw] = await Promise.all([
    callGateway<PersonRow[]>(`/api/people?${params.toString()}`).catch(() => []),
    callGateway<ConnectorRow[]>(`/api/connectors?userId=${encodeURIComponent(session.userId)}`).catch(() => null),
  ]);

  const gmailConnected = (connectorsRaw ?? []).some((c) => c.provider === "google" || c.provider === "gmail");

  return Response.json({ people: (people ?? []).filter((person) => !isDemoPerson(person)), gmailConnected });
}
