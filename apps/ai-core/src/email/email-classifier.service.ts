import { Injectable } from "@nestjs/common";
import { LlmRouterService } from "../llm/llm-router.service";
import { extractJson } from "../llm/llm-router.service";
import { describeNow, localDateTimeToUtc, parseNaiveDateTime } from "../lib/timezone";
import { logger } from "@heyriz/shared/logger";
import type {
  EmailCategory,
  EmailReplyIntent,
  EmailRiskLevel,
  EmailSenderType,
  EmailSuggestedAction,
  EmailUrgency,
  ExtractedContactCandidate,
  ExtractedEmailFacts,
} from "./email.types";

const OTP_PATTERNS = [
  /\botp\b/i,
  /\bverif(y|ication)\b/i,
  /\bone.?time.?pass(word|code)\b/i,
  /\bsecurity code\b/i,
  /\b\d{4,8}[-\s]?(is your|:)\s*(code|otp|pin)\b/i,
  /\bconfirm(ation)? code\b/i,
  /\bmagic link\b/i,
  /\blog.?in link\b/i,
];

const BULK_CAREER_MAIL_PATTERN =
  /\b(jobs? matching your profile|job alert|job feed|new jobs? for you|still looking for a job|work at a startup|community digest|first \d+ applicants|career (digest|newsletter|coaching)|apply to \d+ jobs?|weekly job)\b/i;

@Injectable()
export class EmailClassifierService {
  constructor(private readonly llm: LlmRouterService) {}

  isOtp(subject: string, snippet: string): boolean {
    const text = `${subject} ${snippet}`;
    return OTP_PATTERNS.some((p) => p.test(text));
  }

  async classify(input: {
    from: string;
    subject: string;
    body: string;
    timezone?: string;
    now?: Date;
    userId?: string;
  }): Promise<ExtractedEmailFacts> {
    if (this.isOtp(input.subject, input.body.slice(0, 300))) {
      return {
        category: "otp",
        summary: "OTP / verification code - ignored.",
        requiresReply: false,
        urgency: "low",
        senderType: "automated",
        suggestedAction: "ignore",
        reason: "Matches one-time code or verification pattern.",
        riskLevel: "low",
        isAutomated: true,
        isMarketing: false,
        replyIntent: "ignore",
        contactCandidate: rejectContactCandidate("OTP or verification email"),
        confidence: "high",
      };
    }

    if (!this.llm.hasProvider("extract")) {
      return this.rulesClassify(input);
    }

    const truncatedBody = input.body.slice(0, 2000);
    const timezone = input.timezone ?? "UTC";
    const now = input.now ?? new Date();

    try {
      const raw = await this.llm.complete({
        task: "extract",
        userId: input.userId,
        messages: [
          {
            role: "system",
            content: [
              "You classify an email for a founder's personal assistant.",
              "Categories:",
              "  otp          - OTP, magic link, verification code",
              "  payment_due  - invoice, subscription renewal, payment due, bill",
              "  account_alert - automated notice that an account, project, service, domain, or subscription will be paused, suspended, deleted, deactivated, or will expire (cloud/hosting/database/SaaS infra alerts, security alerts, new login / sign-in alerts, suspicious activity warnings, domain or certificate expiry, 'inactive project' warnings). Use this even when there is no human sender — these are time-sensitive and must never be treated as newsletter or general mail.",
              "  meeting_request - interview, meeting invite, call request, schedule",
              "  investor_update - investor asking for update, term sheet, cap table, due diligence",
              "  follow_up_needed - email that requires a reply the founder hasn't sent",
              "  newsletter   - digest, marketing, blog, announcement, cold outreach, job alert/feed, community digest, career campaign, or bulk recruiting promotion. Never use this for a direct message from a specific recruiter about a specific role. Never use this for an email warning that an account/service/project will stop working — that is account_alert, even if the email also has an unsubscribe footer.",
              "  general_high - urgent message from a real person that doesn't fit above",
              "  general_medium - normal reply or update from a known contact",
              "  general_low  - misc low-importance email",
              "",
              "Extract these facts (omit fields you can't confidently extract):",
              "  person       - real human sender/contact name only; omit for no-reply/system/company mail",
              "  contactCandidate - contact extraction decision for the People CRM. Return isRealContact=true ONLY when the sender/body identifies a real person the founder may correspond with. Return false for no-reply, notifications, newsletters, receipts, security alerts, digest/marketing mail, job-board bots, social network notifications, and brand/service mail.",
              "    contactCandidate shape: {isRealContact:boolean, contactType:'person'|'company', name?:string, email?:string, company?:string, confidence:'high'|'medium'|'low', reason?:string}. Prefer contactType='person'. Use company only as the person's company, not a standalone brand notification.",
              "  serviceName  - service / product name (for payments)",
              "  amount       - money amount (for payments)",
              "  dueDate      - due date or deadline",
              "  meetingTime  - proposed meeting start time",
              "  meetingEndTime - proposed meeting end time, only if the email states a duration or end time",
              "  meetingTitle - meeting/interview title",
              "  action       - what the founder needs to do (short phrase)",
              "  requiresReply - true when a human reply is expected or useful",
              "  urgency      - urgent|soon|normal|low",
              "  senderType   - human|automated|customer|investor|vendor|internal|unknown",
              "  suggestedAction - ignore|notify|remind|schedule|draft_reply|watch_thread|review_manually",
              "  reason       - <=16 words explaining why this category/action was chosen",
              "  riskLevel    - high|medium|low, based on consequence if missed",
              "  isAutomated  - true for no-reply/system/transactional messages",
              "  isMarketing  - true for marketing/newsletter/cold outreach",
              "  replyIntent  - ask|approve|decline|schedule|pay|review|ignore|delegate|unknown",
              "  entities     - short list of people/companies/products mentioned, including sender company when useful",
              "",
              `Current date/time for the founder: ${describeNow(now, timezone)}.`,
              `Resolve any date or time in the email against this reference — weekday names ("Thursday"), relative terms ("tomorrow", "next week"), and dates without a year all mean the soonest matching date on or after today unless the email clearly states otherwise. A bare time like "2:00 PM" with no timezone stated means the founder's own local time, not UTC and not the sender's possible timezone.`,
              `Output dueDate/meetingTime/meetingEndTime as a LOCAL datetime with NO timezone suffix and NO offset — just "YYYY-MM-DDTHH:mm:ss", e.g. "2026-06-25T14:00:00". Do not attempt to convert to UTC or append any offset yourself — that conversion happens elsewhere. Omit a field entirely if the email does not actually specify it; never guess or default to a placeholder time.`,
              "",
              'Reply ONLY with compact JSON: {"category":"...","person":"...","contactCandidate":{"isRealContact":true,"contactType":"person","name":"...","email":"...","company":"...","confidence":"high|medium|low","reason":"..."},"entities":["..."],"serviceName":"...","amount":"...","dueDate":"...","meetingTime":"...","meetingEndTime":"...","meetingTitle":"...","action":"...","requiresReply":true,"urgency":"urgent|soon|normal|low","senderType":"human|automated|customer|investor|vendor|internal|unknown","suggestedAction":"ignore|notify|remind|schedule|draft_reply|watch_thread|review_manually","reason":"<=16 words","riskLevel":"high|medium|low","isAutomated":true,"isMarketing":false,"replyIntent":"ask|approve|decline|schedule|pay|review|ignore|delegate|unknown","summary":"<=20 words","confidence":"high|medium|low"}',
            ].join("\n"),
          },
          {
            role: "user",
            content: `From: ${input.from}\nSubject: ${input.subject}\n\n${truncatedBody}`,
          },
        ],
        temperature: 0,
      });

      const parsed = extractJson<Partial<ExtractedEmailFacts> & { category?: string }>(raw ?? "");
      const category = normalizeCategory(parsed?.category);
      const senderType = normalizeSenderType(parsed?.senderType);
      const isAutomated = normalizeBoolean(parsed?.isAutomated);
      const isMarketing = normalizeBoolean(parsed?.isMarketing);

      if (!parsed?.summary?.trim()) {
        // The model returned parseable JSON but dropped the summary field —
        // this is the silent path that used to leave the user-facing
        // notification with zero body context. Log it so a spike is visible
        // instead of only showing up as vague user reports.
        logger.warn("email classifier: model omitted summary, using body snippet", {
          category,
          hadRawResponse: Boolean(raw),
        });
      }

      return {
        category,
        person: parsed?.person?.trim() || undefined,
        contactCandidate: normalizeContactCandidate(parsed?.contactCandidate, input.from, input.body, {
          senderType,
          isAutomated,
          isMarketing,
        }),
        entities: normalizeEntities(parsed?.entities),
        serviceName: parsed?.serviceName?.trim() || undefined,
        amount: parsed?.amount?.trim() || undefined,
        dueDate: this.toUtcIso(parsed?.dueDate, timezone),
        meetingTime: this.toUtcIso(parsed?.meetingTime, timezone),
        meetingEndTime: this.toUtcIso(parsed?.meetingEndTime, timezone),
        meetingTitle: parsed?.meetingTitle?.trim() || undefined,
        action: parsed?.action?.trim() || undefined,
        requiresReply: normalizeBoolean(parsed?.requiresReply),
        urgency: normalizeUrgency(parsed?.urgency),
        senderType,
        suggestedAction: normalizeSuggestedAction(parsed?.suggestedAction),
        reason: parsed?.reason?.trim() || undefined,
        riskLevel: normalizeRiskLevel(parsed?.riskLevel),
        isAutomated,
        isMarketing,
        replyIntent: normalizeReplyIntent(parsed?.replyIntent),
        summary: parsed?.summary?.trim() || this.bodySnippetSummary(input.from, truncatedBody),
        confidence: normalizeConfidence(parsed?.confidence),
      };
    } catch (error) {
      logger.warn("email classifier llm failed; using rules", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.rulesClassify(input);
    }
  }

  /**
   * Converts the model's naive local datetime (no offset) to a real UTC ISO
   * instant. Tolerates the model ignoring instructions and emitting a value
   * with its own (often wrong) offset/Z by just re-parsing it as a fallback.
   */
  private toUtcIso(value: string | undefined, timezone: string): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;

    const naive = parseNaiveDateTime(trimmed);
    if (naive) {
      const instant = localDateTimeToUtc(
        naive.year,
        naive.month,
        naive.day,
        naive.hour,
        naive.minute,
        timezone,
      );
      if (!Number.isNaN(instant.getTime())) return instant.toISOString();
    }

    const fallbackMs = Date.parse(trimmed);
    if (!Number.isNaN(fallbackMs)) return new Date(fallbackMs).toISOString();

    logger.warn("email classifier: unparseable datetime, dropping", { value: trimmed });
    return undefined;
  }

  /** First real sentence/line of the body, so a degraded classification still carries actual content instead of just the sender. */
  private bodySnippetSummary(from: string, body: string): string {
    const snippet = body
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140);
    if (!snippet) return `Email from ${from}`;
    return `${shortFrom(from)}: ${snippet}${body.length > 140 ? "…" : ""}`;
  }

  private rulesClassify(input: {
    from: string;
    subject: string;
    body: string;
  }): ExtractedEmailFacts {
    const text = `${input.subject} ${input.body}`.toLowerCase();

    // Checked first and ahead of the newsletter/unsubscribe regex below: an
    // automated "your project/account will be paused" notice often carries an
    // unsubscribe footer like any other transactional mail, and would
    // otherwise get misclassified as a newsletter and silently dropped.
    if (
      /will be (paused|suspended|deleted|terminated|deactivated|archived|disabled)|account (has been |is )?(suspend|terminat|deactivat|disabl)|project (will be |is going to be |has been )?(paused|suspended|deleted)|(domain|certificate|ssl).{0,20}(expir)|expir(e|ing|ation).{0,20}(domain|certificate|ssl|plan|subscription)|security alert|unusual (sign-in|activity|login)|new (login|sign.?in) (to|detected|from)|inactiv(e|ity).{0,30}(project|paused|pause)/i.test(
        text,
      )
    ) {
      return {
        category: "account_alert",
        person: shortFrom(input.from),
        summary: `Account/service alert from ${shortFrom(input.from)}`,
        entities: [shortFrom(input.from)],
        contactCandidate: rejectContactCandidate("Automated account/service alert"),
        requiresReply: false,
        urgency: "urgent",
        senderType: "automated",
        suggestedAction: "review_manually",
        reason: "Automated service or security warning with possible account impact.",
        riskLevel: "high",
        isAutomated: true,
        isMarketing: false,
        replyIntent: "review",
        confidence: "medium",
      };
    }

    if (
      /invoice|payment due|subscription|renew|billing|amount due|receipt/i.test(text)
    ) {
      return {
        category: "payment_due",
        person: shortFrom(input.from),
        summary: `Payment or invoice from ${shortFrom(input.from)}`,
        entities: [shortFrom(input.from)],
        contactCandidate: rejectContactCandidate("Automated billing or receipt email"),
        requiresReply: false,
        urgency: "soon",
        senderType: "automated",
        suggestedAction: "remind",
        reason: "Mentions billing, invoice, renewal, receipt, or amount due.",
        riskLevel: "medium",
        isAutomated: true,
        isMarketing: false,
        replyIntent: "pay",
        confidence: "medium",
      };
    }

    // Bulk job feeds often contain words such as "interview" or "schedule" in
    // their recommendations. Classify them before the direct meeting-request
    // rule so a digest cannot become a false action item.
    if (BULK_CAREER_MAIL_PATTERN.test(`${input.from} ${text}`)) {
      return {
        category: "newsletter",
        summary: "Bulk career or community update",
        contactCandidate: rejectContactCandidate("Bulk career or community email"),
        requiresReply: false,
        urgency: "low",
        senderType: "automated",
        suggestedAction: "ignore",
        reason: "Bulk career, job-feed, or community campaign.",
        riskLevel: "low",
        isAutomated: true,
        isMarketing: true,
        replyIntent: "ignore",
        confidence: "high",
      };
    }

    if (
      /interview|meeting|calendar invite|schedule a call|let'?s connect|availability/i.test(text)
    ) {
      return {
        category: "meeting_request",
        person: shortFrom(input.from),
        summary: `Meeting request from ${shortFrom(input.from)}`,
        entities: [shortFrom(input.from)],
        contactCandidate: inferContactCandidateFromHeader(input.from, {
          senderType: "human",
          isAutomated: false,
          isMarketing: false,
        }),
        requiresReply: true,
        urgency: "soon",
        senderType: "human",
        suggestedAction: "schedule",
        reason: "Mentions a meeting, interview, call, schedule, or availability.",
        riskLevel: "medium",
        isAutomated: false,
        isMarketing: false,
        replyIntent: "schedule",
        confidence: "medium",
      };
    }

    if (
      /investor|term sheet|cap table|due diligence|update on|portfolio/i.test(text)
    ) {
      return {
        category: "investor_update",
        person: shortFrom(input.from),
        summary: `Investor update from ${shortFrom(input.from)}`,
        entities: [shortFrom(input.from)],
        contactCandidate: inferContactCandidateFromHeader(input.from, {
          senderType: "investor",
          isAutomated: false,
          isMarketing: false,
        }),
        requiresReply: true,
        urgency: "soon",
        senderType: "investor",
        suggestedAction: "draft_reply",
        reason: "Mentions investor, term sheet, cap table, diligence, or portfolio update.",
        riskLevel: "high",
        isAutomated: false,
        isMarketing: false,
        replyIntent: "review",
        confidence: "medium",
      };
    }

    if (
      /unsubscribe|newsletter|digest|announcement|marketing/i.test(text)
    ) {
      return {
        category: "newsletter",
        summary: "Newsletter or marketing email",
        contactCandidate: rejectContactCandidate("Newsletter or marketing email"),
        requiresReply: false,
        urgency: "low",
        senderType: "automated",
        suggestedAction: "ignore",
        reason: "Contains newsletter, digest, announcement, marketing, or unsubscribe signal.",
        riskLevel: "low",
        isAutomated: true,
        isMarketing: true,
        replyIntent: "ignore",
        confidence: "high",
      };
    }

    const automated = isLikelyAutomated(input.from);
    return {
      category: "general_medium",
      person: shortFrom(input.from),
      summary: this.bodySnippetSummary(input.from, input.body || input.subject),
      entities: [shortFrom(input.from)],
      contactCandidate: inferContactCandidateFromHeader(input.from, {
        senderType: "unknown",
        isAutomated: automated,
        isMarketing: false,
      }),
      requiresReply: false,
      urgency: "normal",
      senderType: "unknown",
      suggestedAction: "notify",
      reason: "No strong category-specific signal matched.",
      riskLevel: "medium",
      isAutomated: automated,
      isMarketing: false,
      replyIntent: "unknown",
      confidence: "low",
    };
  }
}

function normalizeCategory(raw?: string): EmailCategory {
  const valid: EmailCategory[] = [
    "otp",
    "payment_due",
    "account_alert",
    "meeting_request",
    "investor_update",
    "follow_up_needed",
    "newsletter",
    "general_high",
    "general_medium",
    "general_low",
  ];
  return valid.includes(raw as EmailCategory) ? (raw as EmailCategory) : "general_medium";
}

function normalizeConfidence(raw?: string): "high" | "medium" | "low" {
  if (raw === "high" || raw === "low") return raw;
  return "medium";
}

function normalizeUrgency(raw?: string): EmailUrgency | undefined {
  const valid: EmailUrgency[] = ["urgent", "soon", "normal", "low"];
  return valid.includes(raw as EmailUrgency) ? (raw as EmailUrgency) : undefined;
}

function normalizeSenderType(raw?: string): EmailSenderType | undefined {
  const valid: EmailSenderType[] = [
    "human",
    "automated",
    "customer",
    "investor",
    "vendor",
    "internal",
    "unknown",
  ];
  return valid.includes(raw as EmailSenderType) ? (raw as EmailSenderType) : undefined;
}

function normalizeSuggestedAction(raw?: string): EmailSuggestedAction | undefined {
  const valid: EmailSuggestedAction[] = [
    "ignore",
    "notify",
    "remind",
    "schedule",
    "draft_reply",
    "watch_thread",
    "review_manually",
  ];
  return valid.includes(raw as EmailSuggestedAction) ? (raw as EmailSuggestedAction) : undefined;
}

function normalizeRiskLevel(raw?: string): EmailRiskLevel | undefined {
  const valid: EmailRiskLevel[] = ["high", "medium", "low"];
  return valid.includes(raw as EmailRiskLevel) ? (raw as EmailRiskLevel) : undefined;
}

function normalizeReplyIntent(raw?: string): EmailReplyIntent | undefined {
  const valid: EmailReplyIntent[] = [
    "ask",
    "approve",
    "decline",
    "schedule",
    "pay",
    "review",
    "ignore",
    "delegate",
    "unknown",
  ];
  return valid.includes(raw as EmailReplyIntent) ? (raw as EmailReplyIntent) : undefined;
}

function normalizeBoolean(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

function normalizeEntities(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const entities = raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 8);
  return entities.length ? [...new Set(entities)] : undefined;
}

const ROLE_LOCAL_PARTS = new Set([
  "accounts",
  "admin",
  "alerts",
  "billing",
  "bot",
  "contact",
  "digest",
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
  "offers",
  "receipt",
  "receipts",
  "robot",
  "sales",
  "security",
  "support",
  "system",
  "team",
  "transaction",
  "transactions",
  "updates",
]);
const AUTOMATED_LOCAL_RE =
  /(^|[-_.+])(no-?reply|do-?not-?reply|noreply\w*|notif(?:y|ications?)?|robot|bot|mailer|daemon|bounces?|automated|alerts?|updates?|newsletters?|transactions?|receipts?|postmaster)($|[-_.+\d])/i;
const GENERIC_CONTACT_NAME_RE =
  /^(no[- ]?reply|do[- ]?not[- ]?reply|notifications?|alerts?|accounts?|support|info|admin|robot|bot|system|team|updates?|news(?:letter)?s?|transactions?|receipts?|billing|security)$/i;
const EMAIL_RE = /^[^\s<>"]+@[^\s<>"]+\.[^\s<>"]+$/;
const FREE_EMAIL_DOMAINS = new Set([
  "aol.com",
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "pm.me",
  "proton.me",
  "protonmail.com",
  "yahoo.com",
  "ymail.com",
  "zoho.com",
]);
const SECOND_LEVEL_TLDS = new Set(["ac", "co", "com", "edu", "gov", "net", "org"]);

function normalizeContactCandidate(
  raw: unknown,
  from: string,
  body: string,
  hints: {
    senderType?: EmailSenderType;
    isAutomated?: boolean;
    isMarketing?: boolean;
  },
): ExtractedContactCandidate {
  if (!raw || typeof raw !== "object") {
    return inferContactCandidateFromHeader(from, hints);
  }

  const candidate = raw as Record<string, unknown>;
  if (candidate.isRealContact !== true) {
    return rejectContactCandidate(stringField(candidate.reason) ?? "Model rejected sender as a real contact");
  }

  const header = parseFromHeader(from);
  const rawEmail = normalizeEmail(stringField(candidate.email));
  const email =
    rawEmail && appearsInSource(rawEmail, from, body)
      ? rawEmail
      : header.email;
  const name =
    cleanContactName(stringField(candidate.name)) ??
    cleanContactName(header.name);
  const company = cleanContactName(stringField(candidate.company)) ?? companyFromEmail(email);
  const confidence = normalizeConfidence(stringField(candidate.confidence));

  return validateContactCandidate(
    {
      isRealContact: true,
      contactType: "person",
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(company ? { company } : {}),
      reason: stringField(candidate.reason) ?? "Model identified a real contact",
      confidence,
    },
    from,
    hints,
  );
}

function inferContactCandidateFromHeader(
  from: string,
  hints: {
    senderType?: EmailSenderType;
    isAutomated?: boolean;
    isMarketing?: boolean;
  },
): ExtractedContactCandidate {
  const header = parseFromHeader(from);
  const name = cleanContactName(header.name);
  const email = header.email;
  return validateContactCandidate(
    {
      isRealContact: true,
      contactType: "person",
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(companyFromEmail(email) ? { company: companyFromEmail(email) } : {}),
      reason: "Header looks like a real sender",
      confidence: "medium",
    },
    from,
    hints,
  );
}

function validateContactCandidate(
  candidate: ExtractedContactCandidate,
  from: string,
  hints: {
    senderType?: EmailSenderType;
    isAutomated?: boolean;
    isMarketing?: boolean;
  },
): ExtractedContactCandidate {
  const email = normalizeEmail(candidate.email);
  const header = parseFromHeader(from);
  const local = email?.split("@")[0] ?? header.email?.split("@")[0] ?? "";
  const name = candidate.name ?? header.name;

  if (hints.isAutomated || hints.isMarketing || hints.senderType === "automated") {
    return rejectContactCandidate("Automated or marketing sender");
  }
  if (!email && !name) return rejectContactCandidate("No contact name or email");
  if (local && isRoleLocalPart(local)) return rejectContactCandidate("Role or automated mailbox");
  if (name && GENERIC_CONTACT_NAME_RE.test(name)) return rejectContactCandidate("Generic sender display name");
  if (isLikelyAutomated(from)) return rejectContactCandidate("Automated sender header");

  return {
    ...candidate,
    isRealContact: true,
    contactType: "person",
    ...(email ? { email } : {}),
    ...(candidate.company ? { company: candidate.company } : {}),
    confidence: candidate.confidence ?? "medium",
  };
}

function rejectContactCandidate(reason: string): ExtractedContactCandidate {
  return {
    isRealContact: false,
    reason,
    confidence: "high",
  };
}

function parseFromHeader(raw: string): { name?: string; email?: string } {
  const email = normalizeEmail(
    raw.match(/<([^>]+)>/)?.[1] ?? raw.match(/[^\s<>"]+@[^\s<>"]+/)?.[0],
  );
  let name = raw.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  if (name && name.includes("@")) name = undefined;
  return { name: name || undefined, email };
}

function cleanContactName(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.includes("@") || trimmed.length > 80) return undefined;
  return trimmed;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeEmail(value: string | undefined): string | undefined {
  const email = value?.trim().toLowerCase();
  return email && EMAIL_RE.test(email) ? email : undefined;
}

function appearsInSource(email: string, from: string, body: string): boolean {
  const target = email.toLowerCase();
  return from.toLowerCase().includes(target) || body.toLowerCase().includes(target);
}

function isRoleLocalPart(local: string): boolean {
  const normalized = local.replace(/[_.+].*$/, "").toLowerCase();
  return ROLE_LOCAL_PARTS.has(local.toLowerCase()) || ROLE_LOCAL_PARTS.has(normalized) || AUTOMATED_LOCAL_RE.test(local);
}

function companyFromEmail(email: string | undefined): string | undefined {
  const domain = email?.split("@")[1];
  if (!domain) return undefined;
  const registrable = registrableDomain(domain);
  if (FREE_EMAIL_DOMAINS.has(registrable)) return undefined;
  const name = registrable.split(".")[0] ?? "";
  if (!name) return undefined;
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
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

function isLikelyAutomated(from: string): boolean {
  return /\b(no-?reply|noreply|notification|notifications|support|billing|alerts?|transactions?|newsletter|updates?)\b/i.test(from);
}

function shortFrom(from: string): string {
  const name = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (name) return name[1].trim();
  const email = from.match(/<([^>]+)>/);
  return (email ? email[1] : from).split("@")[0];
}
