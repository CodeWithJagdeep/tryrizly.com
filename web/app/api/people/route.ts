import { callGateway } from "@/app/api/auth/_lib/gateway";
import { demoPeople, isDemoUser } from "@/app/api/_lib/demo-dashboard-data";
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
const ROLE_LOCAL_PARTS = new Set([
  "accounts",
  "admin",
  "alerts",
  "billing",
  "bot",
  "contact",
  "hello",
  "info",
  "mail",
  "mailer",
  "marketing",
  "newsletter",
  "no-reply",
  "noreply",
  "notification",
  "notifications",
  "robot",
  "sales",
  "security",
  "support",
  "system",
  "team",
  "updates",
]);
const AUTOMATED_LOCAL_RE =
  /(^|[-_.+])(no-?reply|do-?not-?reply|noreply\w*|notif(?:y|ications?)?|robot|bot|mailer|daemon|bounces?|automated|alerts?|updates?|newsletters?|postmaster)($|[-_.+\d])/i;
const GENERIC_COMPANY_NAMES = new Set([
  "accounts",
  "alerts",
  "notifications",
  "support",
  "system",
  "team",
  "updates",
]);
const SECOND_LEVEL_TLDS = new Set(["ac", "co", "com", "edu", "gov", "net", "org"]);

function isDemoPerson(person: PersonRow) {
  if (DEMO_PEOPLE_IDS.has(person.id)) return true;
  return person.emails.some((email) => DEMO_CONTACT_DOMAINS.some((domain) => email.toLowerCase().endsWith(`@${domain}`)));
}

function isSyntheticMailboxPerson(person: PersonRow) {
  return person.type === "person" && person.emails.some(isRoleMailbox);
}

function isLegacyMailboxCompany(person: PersonRow) {
  if (person.type !== "company") return false;
  const name = person.canonicalName.trim().toLowerCase();
  if (!GENERIC_COMPANY_NAMES.has(name)) return false;
  return person.urls.some((url) => {
    const host = hostnameFromUrl(url);
    if (!host) return false;
    return host !== registrableDomain(host) && GENERIC_COMPANY_NAMES.has(host.split(".")[0] ?? "");
  });
}

function isRoleMailbox(email: string) {
  const local = email.toLowerCase().split("@")[0] ?? "";
  const normalized = local.replace(/[_.+].*$/, "");
  return ROLE_LOCAL_PARTS.has(local) || ROLE_LOCAL_PARTS.has(normalized) || AUTOMATED_LOCAL_RE.test(local);
}

function hostnameFromUrl(value: string) {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function registrableDomain(domain: string) {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const tld = labels.at(-1);
  const secondLevel = labels.at(-2);
  if (tld?.length === 2 && secondLevel && SECOND_LEVEL_TLDS.has(secondLevel) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }
  return labels.slice(-2).join(".");
}

function sanitizePerson(person: PersonRow): PersonRow {
  return {
    ...person,
    phones: person.phones.filter(isPlausiblePhone),
  };
}

function isPlausiblePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  if (isDemoUser(session.userId)) {
    return Response.json({ people: demoPeople(), gmailConnected: true });
  }

  const params = new URLSearchParams({ userId: session.userId, limit: "200" });
  const [people, connectorsRaw] = await Promise.all([
    callGateway<PersonRow[]>(`/api/people?${params.toString()}`).catch(() => []),
    callGateway<ConnectorRow[]>(`/api/connectors?userId=${encodeURIComponent(session.userId)}`).catch(() => null),
  ]);

  const gmailConnected = (connectorsRaw ?? []).some((c) => c.provider === "google" || c.provider === "gmail");

  return Response.json({
    people: (people ?? [])
      .filter(
        (person) =>
          person.type === "person" &&
          !isDemoPerson(person) &&
          !isSyntheticMailboxPerson(person) &&
          !isLegacyMailboxCompany(person),
      )
      .map(sanitizePerson),
    gmailConnected,
  });
}
