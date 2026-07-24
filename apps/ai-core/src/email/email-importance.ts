import type { HeyRizPriority } from "../context/context.types";

export type EmailImportanceInput = {
  from?: string;
  subject?: string;
  snippet?: string;
  body?: string;
};

export type EmailImportanceAssessment = {
  /**
   * A deterministic verdict is only emitted for high-precision cases. Ambiguous
   * human mail is deliberately left to the model instead of being keyword-only.
   */
  decisivePriority?: Extract<HeyRizPriority, "HIGH" | "LOW">;
  suggestedPriority: HeyRizPriority;
  reason: string;
  isLikelyAutomated: boolean;
  isBulk: boolean;
  hasCriticalSignal: boolean;
  hasDirectRequest: boolean;
  evidence: string[];
};

const AUTOMATED_SENDER_PATTERN =
  /(?:^|[._+\-])(no-?reply|do-?not-?reply|notifications?|newsletter|digest|updates?|marketing|promotions?|mailer|news|info|alerts?|system|robot|bot)(?:[._+\-]|@)/i;

const CRITICAL_RISK_PATTERN =
  /\b(?:security alert|suspicious (?:activity|sign[ -]?in|login)|unusual (?:activity|sign[ -]?in|login)|new (?:sign[ -]?in|login) (?:to|detected|from)|password (?:was )?changed|account (?:may be |was |is )?compromised|two[ -]?factor authentication (?:was )?disabled|2fa (?:was )?disabled|payment failed|failed payment|card (?:was )?declined|invoice (?:is )?(?:overdue|past due)|past[ -]?due invoice|amount due|payment due|autopay failed|chargeback|refund dispute|production (?:incident|outage)|service (?:is )?down|sev[ -]?1|data breach)\b/i;

const ACCOUNT_IMPACT_PATTERN =
  /\b(?:will be (?:paused|suspended|deleted|terminated|deactivated|archived|disabled)|account (?:has been |is |will be )?(?:suspend|terminat|deactivat|disabl)|project (?:will be |is going to be |has been )?(?:paused|suspended|deleted)|(?:domain|certificate|ssl).{0,24}(?:expir)|(?:expir(?:e|ing|ation)).{0,24}(?:domain|certificate|ssl|plan|subscription))\b/i;

const BULK_CAREER_PATTERN =
  /\b(?:jobs? matching your profile|job alert|job feed|new jobs? for you|still looking for a job|work at a startup|first \d+ applicants|career (?:digest|newsletter|coaching)|apply to \d+ jobs?|weekly job|recommended jobs?)\b/i;

const BULK_SUBJECT_PATTERN =
  /\b(?:daily|weekly|monthly)?\s*(?:digest|newsletter|roundup)|(?:top|recommended) stor(?:y|ies)|recommended for you|market(?:s)? (?:digest|update|today|newsletter)|terms of service(?: update)?|tos(?: update)?|privacy policy(?: update)?|community (?:digest|update)|(?:live|free|upcoming).{0,32}(?:session|webinar|workshop|masterclass)|(?:webinar|workshop|masterclass).{0,24}(?:invite|registration|today|tomorrow)|register (?:now|today)|reserve your spot|save your seat|special offer|limited[ -]?time offer|flash sale\b/i;

const BULK_BODY_PATTERN =
  /\b(?:unsubscribe|manage (?:your )?(?:email )?preferences|email preferences|view (?:this )?(?:email )?in (?:your )?browser|you (?:are|were) receiving this (?:email )?because|promotional email|sponsored content|advertisement)\b/i;

const SOCIAL_NOTIFICATION_PATTERN =
  /\b(?:you have (?:a )?new message|sent you a message|new notification|new answer (?:for|to)|people you may know|viewed your profile|started following you|upvoted your|new post from)\b/i;

const PASSIVE_TRANSACTION_PATTERN =
  /\b(?:otp|one[ -]?time (?:password|code)|verification code|security code|magic link|receipt|order confirmation|order shipped|delivery update|statement is ready|terms of service(?: update)?|tos(?: update)?|privacy policy(?: update)?|monthly statement|weekly summary|activity summary)\b/i;

const MARKETING_SUBJECT_PATTERN =
  /\b(?:register now|registration (?:is open|link)|reserve your spot|save your seat|join us|don'?t miss|offer|sale|deal|discount|learn how to|grow your|boost your|unlock|free trial)\b/i;

const DIRECT_REQUEST_PATTERN =
  /\b(?:can you|could you|would you|please (?:send|share|review|confirm|approve|sign|reply|respond|call|schedule|check|provide|complete|submit)|need your (?:reply|response|approval|review|signature|input|feedback)|reply by|respond by|confirm by|are you available|what time works|let'?s (?:meet|talk|connect|schedule)|when can (?:we|you)|do you have time)\b/i;

const TIME_PRESSURE_PATTERN =
  /\b(?:urgent|asap|today|by eod|end of day|within \d+ (?:hours?|days?)|before (?:noon|tomorrow)|tomorrow)\b/i;

/**
 * High-precision policy layer around the probabilistic classifier.
 *
 * It intentionally does not attempt to understand every email. Its job is to
 * catch costly, repeatable mistakes: bulk mail promoted by urgency language,
 * generic automated notices defaulted to MEDIUM, and real security/account
 * threats suppressed merely because they came from a no-reply address.
 */
export function assessEmailImportance(
  input: EmailImportanceInput,
): EmailImportanceAssessment {
  const from = normalize(input.from);
  const subject = normalize(input.subject);
  const content = normalize(`${input.snippet ?? ""} ${input.body ?? ""}`);
  const all = `${from} ${subject} ${content}`.trim();
  const evidence: string[] = [];

  const hasCriticalSignal =
    CRITICAL_RISK_PATTERN.test(all) || ACCOUNT_IMPACT_PATTERN.test(all);
  if (hasCriticalSignal)
    evidence.push("concrete account, payment, or production risk");

  const isLikelyAutomated = AUTOMATED_SENDER_PATTERN.test(senderAddress(from));
  if (isLikelyAutomated) evidence.push("automated sender");

  const hasBulkSubject =
    BULK_SUBJECT_PATTERN.test(subject) || BULK_CAREER_PATTERN.test(all);
  const hasBulkFooter = BULK_BODY_PATTERN.test(content);
  const hasMarketingSubject = MARKETING_SUBJECT_PATTERN.test(subject);
  const hasSocialNotification = SOCIAL_NOTIFICATION_PATTERN.test(all);
  const isBulk =
    hasBulkSubject ||
    hasSocialNotification ||
    hasBulkFooter ||
    (isLikelyAutomated && hasMarketingSubject);
  if (isBulk)
    evidence.push("bulk, promotional, digest, or notification pattern");

  const hasPassiveTransaction = PASSIVE_TRANSACTION_PATTERN.test(all);
  if (hasPassiveTransaction) evidence.push("passive transactional update");

  const hasDirectRequest =
    !isBulk && !isLikelyAutomated && DIRECT_REQUEST_PATTERN.test(all);
  if (hasDirectRequest)
    evidence.push("direct request from a human-looking sender");

  // Consequence beats channel: a genuine security or account-impact alert
  // remains important even though it normally comes from an automated sender
  // and may contain a generic unsubscribe footer.
  if (hasCriticalSignal) {
    return {
      decisivePriority: "HIGH",
      suggestedPriority: "HIGH",
      reason: "Concrete security, payment, account, or production risk.",
      isLikelyAutomated,
      isBulk,
      hasCriticalSignal,
      hasDirectRequest,
      evidence,
    };
  }

  if (isBulk || hasPassiveTransaction) {
    return {
      decisivePriority: "LOW",
      suggestedPriority: "LOW",
      reason: isBulk
        ? "Bulk, promotional, digest, or automated notification."
        : "Passive transactional update with no action requested.",
      isLikelyAutomated,
      isBulk,
      hasCriticalSignal,
      hasDirectRequest,
      evidence,
    };
  }

  const directAndTimeSensitive =
    hasDirectRequest && TIME_PRESSURE_PATTERN.test(all);

  return {
    suggestedPriority: directAndTimeSensitive
      ? "HIGH"
      : hasDirectRequest
        ? "MEDIUM"
        : isLikelyAutomated
          ? "LOW"
          : "MEDIUM",
    reason: directAndTimeSensitive
      ? "Direct, time-sensitive request from a human-looking sender."
      : hasDirectRequest
        ? "Direct request without a serious immediate consequence."
        : isLikelyAutomated
          ? "Automated message with no concrete risk or requested action."
          : "No decisive importance signal; model review required.",
    isLikelyAutomated,
    isBulk,
    hasCriticalSignal,
    hasDirectRequest,
    evidence,
  };
}

function normalize(value?: string): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function senderAddress(from: string): string {
  return from.match(/<([^>]+)>/)?.[1] ?? from;
}
