import { Injectable } from "@nestjs/common";
import { LlmRouterService } from "../llm/llm-router.service";
import { extractJson } from "../llm/llm-router.service";
import { describeNow, localDateTimeToUtc, parseNaiveDateTime } from "../lib/timezone";
import { logger } from "@heyriz/shared/logger";
import type { EmailCategory, ExtractedEmailFacts } from "./email.types";

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
      return { category: "otp", summary: "OTP / verification code — ignored.", confidence: "high" };
    }

    if (!this.llm.hasProvider()) {
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
              "  newsletter   - digest, marketing, blog, announcement, cold outreach. Never use this for an email warning that an account/service/project will stop working — that is account_alert, even if the email also has an unsubscribe footer.",
              "  general_high - urgent message from a real person that doesn't fit above",
              "  general_medium - normal reply or update from a known contact",
              "  general_low  - misc low-importance email",
              "",
              "Extract these facts (omit fields you can't confidently extract):",
              "  person       - sender's name or company",
              "  serviceName  - service / product name (for payments)",
              "  amount       - money amount (for payments)",
              "  dueDate      - due date or deadline",
              "  meetingTime  - proposed meeting start time",
              "  meetingEndTime - proposed meeting end time, only if the email states a duration or end time",
              "  meetingTitle - meeting/interview title",
              "  action       - what the founder needs to do (short phrase)",
              "",
              `Current date/time for the founder: ${describeNow(now, timezone)}.`,
              `Resolve any date or time in the email against this reference — weekday names ("Thursday"), relative terms ("tomorrow", "next week"), and dates without a year all mean the soonest matching date on or after today unless the email clearly states otherwise. A bare time like "2:00 PM" with no timezone stated means the founder's own local time, not UTC and not the sender's possible timezone.`,
              `Output dueDate/meetingTime/meetingEndTime as a LOCAL datetime with NO timezone suffix and NO offset — just "YYYY-MM-DDTHH:mm:ss", e.g. "2026-06-25T14:00:00". Do not attempt to convert to UTC or append any offset yourself — that conversion happens elsewhere. Omit a field entirely if the email does not actually specify it; never guess or default to a placeholder time.`,
              "",
              'Reply ONLY with compact JSON: {"category":"...","person":"...","serviceName":"...","amount":"...","dueDate":"...","meetingTime":"...","meetingEndTime":"...","meetingTitle":"...","action":"...","summary":"<=20 words","confidence":"high|medium|low"}',
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

      return {
        category,
        person: parsed?.person?.trim() || undefined,
        serviceName: parsed?.serviceName?.trim() || undefined,
        amount: parsed?.amount?.trim() || undefined,
        dueDate: this.toUtcIso(parsed?.dueDate, timezone),
        meetingTime: this.toUtcIso(parsed?.meetingTime, timezone),
        meetingEndTime: this.toUtcIso(parsed?.meetingEndTime, timezone),
        meetingTitle: parsed?.meetingTitle?.trim() || undefined,
        action: parsed?.action?.trim() || undefined,
        summary: parsed?.summary?.trim() || `Email from ${input.from}`,
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
        confidence: "medium",
      };
    }

    if (
      /interview|meeting|calendar invite|schedule a call|let'?s connect|availability/i.test(text)
    ) {
      return {
        category: "meeting_request",
        person: shortFrom(input.from),
        summary: `Meeting request from ${shortFrom(input.from)}`,
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
        confidence: "medium",
      };
    }

    if (
      /unsubscribe|newsletter|digest|announcement|marketing/i.test(text)
    ) {
      return {
        category: "newsletter",
        summary: "Newsletter or marketing email",
        confidence: "high",
      };
    }

    return {
      category: "general_medium",
      person: shortFrom(input.from),
      summary: `Email from ${shortFrom(input.from)}: ${input.subject.slice(0, 60)}`,
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

function shortFrom(from: string): string {
  const name = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (name) return name[1].trim();
  const email = from.match(/<([^>]+)>/);
  return (email ? email[1] : from).split("@")[0];
}
