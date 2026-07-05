import { Inject, Injectable } from "@nestjs/common";
import { EntityRepository, type AliasInput, type EntityType } from "./entity.repository";

const FUZZY_THRESHOLD = 0.45;
const CACHE_MAX = 5000;
const ROLE_LOCAL_PARTS = new Set([
  "accounts",
  "admin",
  "alert",
  "alerts",
  "auto",
  "automated",
  "billing",
  "bounce",
  "bounces",
  "bot",
  "careers",
  "contact",
  "daemon",
  "digest",
  "donotreply",
  "do-not-reply",
  "feedback",
  "hello",
  "help",
  "hr",
  "info",
  "invoices",
  "jobs",
  "mail",
  "mailer",
  "mailer-daemon",
  "marketing",
  "news",
  "newsletter",
  "no-reply",
  "noreply",
  "notification",
  "notifications",
  "notify",
  "offers",
  "orders",
  "postmaster",
  "promo",
  "promotions",
  "receipts",
  "recruiting",
  "recruitment",
  "reminder",
  "reminders",
  "robot",
  "root",
  "sales",
  "security",
  "shipping",
  "support",
  "system",
  "team",
  "updates",
  "verification",
  "verify",
  "webmaster",
]);
/** Catches automated locals the set can't enumerate: "noreply-orders", "billing.alerts", "us-marketing+tag"… */
const AUTOMATED_LOCAL_RE =
  /(^|[-_.+])(no-?reply|do-?not-?reply|noreply\w*|notif(?:y|ications?)?|robot|bot|mailer|daemon|bounces?|automated|alerts?|updates?|newsletters?|postmaster)($|[-_.+\d])/i;
/** Display names that describe the mailbox, not the org ("No Reply", "Google Accounts Team"). */
const GENERIC_DISPLAY_RE =
  /^(no[- ]?reply|do[- ]?not[- ]?reply|notifications?|alerts?|accounts?|support|info|admin|robot|bot|mail(?:er)? ?(?:daemon|delivery(?: subsystem)?)?|system|team|updates?|news(?:letter)?s?)$/i;
const PERSONAL_LOCAL_RE = /^[a-z][a-z]+[._-][a-z][a-z]+(?:[._-]\d+)?$/i;
const FREE_EMAIL_DOMAINS = new Set([
  "aol.com",
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "msn.com",
  "pm.me",
  "yahoo.com",
  "ymail.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
]);
const SECOND_LEVEL_TLDS = new Set(["ac", "co", "com", "edu", "gov", "net", "org"]);

type SenderType = "human" | "automated" | "customer" | "investor" | "vendor" | "internal" | "unknown";

export type ResolveInput = {
  name?: string;
  email?: string;
  type?: EntityType;
  senderType?: SenderType;
  isAutomated?: boolean;
  isMarketing?: boolean;
  source: string;
};

export type ResolveResult = {
  entityId: string;
  created: boolean;
  canonicalName: string;
};

/**
 * Resolves a raw person/company reference to one canonical entity id.
 * Deterministic-first (exact email → exact name → fuzzy name → create); the LLM
 * is NOT in this path — it's an enhancer added later, never the source of truth.
 */
@Injectable()
export class EntityResolverService {
  // Positive email→entity hits only (stable); avoids re-querying for repeat senders.
  private readonly cache = new Map<string, string>();

  constructor(
    @Inject(EntityRepository)
    private readonly repo: EntityRepository,
  ) {}

  /** Finds an existing entity without creating one (for query/recall paths). */
  async lookup(
    userId: string,
    ref: { name?: string; email?: string },
  ): Promise<string | undefined> {
    if (!this.repo.hasDb()) return undefined;
    const emailNorm = ref.email ? normalizeEmail(ref.email) : undefined;
    const nameNorm = ref.name ? normalizeName(ref.name) : undefined;
    if (emailNorm) {
      const hit = await this.repo.findEntityByAlias(userId, emailNorm, "email");
      if (hit) return hit;
    }
    if (nameNorm) {
      const hit = await this.repo.findEntityByAlias(userId, nameNorm, "name");
      if (hit) return hit;
      const fuzzy = await this.repo.findEntityByFuzzyName(userId, nameNorm, FUZZY_THRESHOLD);
      if (fuzzy) return fuzzy.entityId;
    }
    return undefined;
  }

  /** Convenience for an RFC-5322-ish "Name <email>" header. */
  resolveFromHeader(
    userId: string,
    rawFrom: string,
    source: string,
  ): Promise<ResolveResult | undefined> {
    const { name, email } = parseHeader(rawFrom);
    return this.resolve(userId, { name, email, source });
  }

  async resolve(userId: string, input: ResolveInput): Promise<ResolveResult | undefined> {
    if (!this.repo.hasDb()) return undefined;

    const emailNorm = input.email ? normalizeEmail(input.email) : undefined;
    const emailParts = emailNorm ? splitEmail(emailNorm) : undefined;
    const automatedHint =
      input.isAutomated === true || input.isMarketing === true || input.senderType === "automated";
    const inferredName = input.name?.trim() || inferPersonNameFromEmail(emailNorm);
    const nameNorm = inferredName ? normalizeName(inferredName) : undefined;
    if (!emailNorm && !nameNorm) return undefined;

    // A machine mailbox is NEVER a person, display name or not — "Botster"
    // <robot@botster.io> and "Google" <no-reply@accounts.google.com> are the
    // org talking, so resolve them to the company. A non-generic display name
    // ("Botster") beats the domain-derived name; a generic one ("No Reply",
    // "Accounts") is about the mailbox and is ignored. On a free-email domain
    // there is no org — record nothing rather than a fake person.
    if (!input.type && emailParts && (isRoleLocalPart(emailParts.local) || automatedHint)) {
      const displayName = input.name?.trim();
      const orgName =
        displayName && !GENERIC_DISPLAY_RE.test(displayName) ? displayName : undefined;
      return this.resolveCompanyFromEmail(userId, emailNorm!, input.source, orgName);
    }

    const canonicalName = inferredName || input.email!;
    const type = input.type ?? "person";

    const cacheKey = emailNorm ? `${userId}:email:${emailNorm}` : undefined;
    if (cacheKey) {
      const hit = this.cache.get(cacheKey);
      if (hit) {
        // Still record any new name alias seen for a known sender.
        if (nameNorm && input.name) {
          await this.repo
            .upsertAlias(userId, hit, {
              alias: input.name,
              normalized: nameNorm,
              kind: "name",
              source: input.source,
              confidence: 0.8,
            })
            .catch(() => undefined);
        }
        return { entityId: hit, created: false, canonicalName };
      }
    }

    // Deterministic match cascade.
    let entityId: string | undefined;
    if (emailNorm) {
      entityId = await this.repo.findEntityByAlias(userId, emailNorm, "email");
    }
    if (!entityId && nameNorm) {
      entityId = await this.repo.findEntityByAlias(userId, nameNorm, "name");
    }
    if (!entityId && nameNorm) {
      const fuzzy = await this.repo.findEntityByFuzzyName(userId, nameNorm, FUZZY_THRESHOLD);
      entityId = fuzzy?.entityId;
    }
    if (entityId) {
      const existing = await this.repo.getEntity(userId, entityId).catch(() => undefined);
      if (existing?.type !== type) entityId = undefined;
    }

    let created = false;
    if (!entityId) {
      entityId = await this.repo.createEntity(userId, type, canonicalName);
      created = true;
    }

    // Always store the raw forms (idempotent).
    if (emailNorm && input.email) {
      await this.repo.upsertAlias(userId, entityId, {
        alias: input.email,
        normalized: emailNorm,
        kind: "email",
        source: input.source,
        confidence: 1,
      });
    }
    if (nameNorm && inferredName) {
      await this.repo.upsertAlias(userId, entityId, {
        alias: inferredName,
        normalized: nameNorm,
        kind: "name",
        source: input.source,
        confidence: created ? 1 : 0.8,
      });
    }

    if (!input.type && emailNorm) {
      await this.ensureCompanyFromEmail(userId, emailNorm, input.source).catch(() => undefined);
    }

    if (cacheKey) this.remember(cacheKey, entityId);
    return { entityId, created, canonicalName };
  }

  listPeople(userId: string, limit = 50) {
    return this.repo.listEntities(userId, limit);
  }

  /** Attach a phone/url/name alias directly to a known entity id. */
  attachAlias(userId: string, entityId: string, alias: AliasInput): Promise<void> {
    return this.repo.upsertAlias(userId, entityId, alias);
  }

  private remember(key: string, entityId: string) {
    if (this.cache.size >= CACHE_MAX) this.cache.clear();
    this.cache.set(key, entityId);
  }

  private async resolveCompanyFromEmail(
    userId: string,
    email: string,
    source: string,
    preferredName?: string,
  ): Promise<ResolveResult | undefined> {
    const company = await this.ensureCompanyFromEmail(userId, email, source, preferredName, {
      includeMailboxAlias: true,
    });
    if (!company) return undefined;
    return company;
  }

  private async ensureCompanyFromEmail(
    userId: string,
    email: string,
    source: string,
    preferredName?: string,
    opts?: { includeMailboxAlias?: boolean },
  ): Promise<{ entityId: string; created: boolean; canonicalName: string } | undefined> {
    const parts = splitEmail(email);
    if (!parts || isFreeEmailDomain(parts.domain)) return undefined;
    const domain = registrableDomain(parts.domain);
    const companyName = preferredName || companyNameFromDomain(domain);
    if (!companyName) return undefined;
    // Alias the registrable domain, not the mail subdomain — accounts.google.com
    // and mail.google.com must land on the same "Google" entity.
    const domainUrl = `https://${domain}`;
    const result = await this.resolve(userId, {
      name: companyName,
      email: undefined,
      type: "company",
      source,
    });
    if (!result) return undefined;
    if (opts?.includeMailboxAlias) {
      await this.repo.upsertAlias(userId, result.entityId, {
        alias: email,
        normalized: normalizeEmail(email),
        kind: "email",
        source,
        confidence: 0.95,
      });
    }
    await this.repo.upsertAlias(userId, result.entityId, {
      alias: domainUrl,
      normalized: domainUrl,
      kind: "url",
      source,
      confidence: 0.9,
    });
    await this.repo.upsertAlias(userId, result.entityId, {
      alias: domain,
      normalized: domain,
      kind: "url",
      source,
      confidence: 0.8,
    });
    return result;
  }
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function normalizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/\s+/g, " ");
}

function splitEmail(email: string): { local: string; domain: string } | undefined {
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain) return undefined;
  return { local, domain };
}

function isRoleLocalPart(local: string): boolean {
  const normalized = local.replace(/[_.+].*$/, "").toLowerCase();
  return (
    ROLE_LOCAL_PARTS.has(local.toLowerCase()) ||
    ROLE_LOCAL_PARTS.has(normalized) ||
    AUTOMATED_LOCAL_RE.test(local)
  );
}

function inferPersonNameFromEmail(email: string | undefined): string | undefined {
  const parts = email ? splitEmail(email) : undefined;
  if (!parts || isRoleLocalPart(parts.local) || !PERSONAL_LOCAL_RE.test(parts.local)) return undefined;
  const name = parts.local
    .replace(/[+].*$/, "")
    .split(/[._-]/)
    .filter((part) => part && !/^\d+$/.test(part))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
  return name.includes(" ") ? name : undefined;
}

function companyNameFromDomain(domain: string): string | undefined {
  const base = registrableDomain(domain).split(".").filter(Boolean)[0];
  if (!base || base.length < 2) return undefined;
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isFreeEmailDomain(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(registrableDomain(domain));
}

function registrableDomain(domain: string): string {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");

  const tld = labels.at(-1);
  const secondLevel = labels.at(-2);
  if (tld?.length === 2 && secondLevel && SECOND_LEVEL_TLDS.has(secondLevel) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }

  return labels.slice(-2).join(".");
}

/** Pulls a name and/or email out of a "From"-style header. */
export function parseHeader(raw: string): { name?: string; email?: string } {
  const email =
    raw.match(/<([^>]+)>/)?.[1] ?? raw.match(/[^\s<>"]+@[^\s<>"]+/)?.[0] ?? undefined;
  let name = raw.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  // A bare email with no display name shouldn't become a "name" alias.
  if (name && name.includes("@")) name = undefined;
  if (!name && !email) {
    const bare = raw.trim();
    if (bare && !bare.includes("@")) name = bare;
  }
  return { name: name || undefined, email: email?.toLowerCase() };
}
