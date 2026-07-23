import { Injectable } from "@nestjs/common";
import { GoogleService } from "../google/google.service";
import {
  AvailabilityService,
  canonicalMeetingKey,
  type AvailabilityCheckResult,
} from "../availability/availability.service";
import { EmailClassifierService } from "./email-classifier.service";
import { EmailPreferencesRepository } from "./email-preferences.repository";
import { UserPreferencesRepository } from "../preferences/user-preferences.repository";
import { VectorMemoryService } from "../memory/vector-memory.service";
import { enqueueNotification, enqueueReminder } from "@heyriz/shared/queue/queues";
import { enqueueSpineIngest } from "@heyriz/shared/queue/spine";
import { enqueueWatchReply } from "@heyriz/shared/queue/watch-replies";
import {
  addPendingEmailAction,
} from "@heyriz/shared/queue/pending-actions";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { appendActionAudit } from "@heyriz/shared/action-audit";
import { zonedTimeToUtc } from "../lib/timezone";
import type { EmailCategory, EmailPipelineResult, ExtractedEmailFacts } from "./email.types";

const MIN = 60_000;

// Email categories worth mining for decisions/agreements (substantive human
// mail). Includes general_medium — "normal reply from a known contact" is
// exactly where casual confirmations ("sounds good", "approved", "let's do
// Tuesday") and negotiation closes live. Precision is held downstream by the
// conservative extractor, which returns nothing when there's no real decision.
const DECISION_CATEGORIES = new Set<EmailCategory>([
  "meeting_request",
  "investor_update",
  "follow_up_needed",
  "general_high",
  "general_medium",
]);

type ProcessEmailInput = {
  userId: string;
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
};

@Injectable()
export class EmailPipelineService {
  constructor(
    private readonly google: GoogleService,
    private readonly availability: AvailabilityService,
    private readonly classifier: EmailClassifierService,
    private readonly emailPrefs: EmailPreferencesRepository,
    private readonly userPrefs: UserPreferencesRepository,
    private readonly memory: VectorMemoryService,
  ) {}

  async process(input: ProcessEmailInput): Promise<EmailPipelineResult> {
    // Fast path: OTP check from headers alone — never fetch body
    if (this.classifier.isOtp(input.subject, input.snippet)) {
      logger.info("email pipeline: otp ignored", { messageId: input.messageId });
      return {
        messageId: input.messageId,
        category: "otp",
        handled: "ignored",
        notificationSent: false,
        facts: { category: "otp", summary: "OTP ignored", confidence: "high" },
        actionsScheduled: [],
      };
    }

    // Fetch full body only when we might act on it
    const msgRes = await this.google.getMessage(input.userId, input.messageId, "full");
    const body = msgRes.connected ? msgRes.message.body : input.snippet;
    const timezone = await this.userPrefs.getTimezone(input.userId);

    const facts = await this.classifier.classify({
      from: input.from,
      subject: input.subject,
      body,
      timezone,
      userId: input.userId,
    });

    if (facts.category === "otp") {
      return {
        messageId: input.messageId,
        category: "otp",
        handled: "ignored",
        notificationSent: false,
        facts,
        actionsScheduled: [],
      };
    }

    // Spine (durable): timeline + entity-link every non-OTP email, and mine
    // decisions from substantive categories. Runs on its own BullMQ queue with
    // retries + a 30-day dead-letter trail, so a transient DB/LLM failure never
    // silently drops memory — and never blocks or duplicates the email flow.
    // The worker re-fetches the body live; it is never placed on the queue.
    await enqueueSpineIngest({
      userId: input.userId,
      messageId: input.messageId,
      threadId: input.threadId,
      from: input.from,
      subject: input.subject,
      extractDecisions: env.BACKGROUND_AI_ENABLED && DECISION_CATEGORIES.has(facts.category),
      senderName: facts.person,
      senderType: facts.senderType,
      isAutomated: facts.isAutomated,
      isMarketing: facts.isMarketing,
      contactCandidate: facts.contactCandidate,
      cc: msgRes.connected ? msgRes.message.cc : undefined,
    }).catch((e: unknown) =>
      logger.warn("spine: enqueue failed", {
        error: e instanceof Error ? e.message : String(e),
      }),
    );

    if (facts.category === "newsletter" || facts.category === "general_low") {
      await this.storeToMemory(input, facts);
      return {
        messageId: input.messageId,
        category: facts.category,
        handled: "ignored",
        notificationSent: false,
        facts,
        actionsScheduled: [],
      };
    }

    // Away / Vacation mode: hold substantive emails into a priority list instead
    // of pinging the principal. Notifications auto-resume once the window passes;
    // the held list is handed over as a digest on return (say "I'm back" or the
    // scheduler's return sweep). Away expires by date inside getAwayUntil().
    const awayUntil = await this.userPrefs.getAwayUntil(input.userId);
    if (awayUntil) {
      await this.userPrefs.holdAwayEmail(input.userId, {
        from: input.from,
        subject: input.subject,
        summary: facts.summary,
        category: facts.category,
        urgency: facts.urgency,
        amount: facts.amount,
        dueDate: facts.dueDate,
        messageId: input.messageId,
        at: new Date().toISOString(),
      });
      await this.storeToMemory(input, facts);
      logger.info("email pipeline: held while away", { messageId: input.messageId, category: facts.category });
      return {
        messageId: input.messageId,
        category: facts.category,
        handled: "held",
        notificationSent: false,
        facts,
        actionsScheduled: [],
      };
    }

    const pref = await this.emailPrefs.get(input.userId, facts.category);
    const honorific = await this.userPrefs.getHonorific(input.userId);
    const actionsScheduled: string[] = [];

    // Auto-act if we have a learned preference
    if (pref?.autoAct) {
      await this.autoAct(input, facts, honorific, actionsScheduled);
      await this.storeToMemory(input, facts);

      return {
        messageId: input.messageId,
        category: facts.category,
        handled: "auto",
        notificationSent: actionsScheduled.length > 0,
        facts,
        actionsScheduled,
      };
    }

    // Ask the user — add an addressable pending action (a short id) to the
    // chat's approval queue and wire "yes <id>" back to email_confirm. Multiple
    // actions can wait at once, so a proactive email prompt neither clobbers nor
    // is clobbered by another pending action; the principal answers it by id or
    // with the message's buttons.
    const baseMessage = await this.buildUserMessage(facts, input, honorific, timezone);
    const defaultAction = defaultActionFor(facts.category);
    let message = baseMessage;
    let pendingId: string | undefined;

    if (defaultAction) {
      const pending = await addPendingEmailAction(input.userId, {
        tool: "email_confirm",
        payload: {
          messageId: input.messageId,
          threadId: input.threadId,
          category: facts.category,
          facts,
          action: defaultAction,
        },
        preview: baseMessage,
      }).catch((e) => {
        logger.warn("email pipeline: pending-action store failed", {
          error: e instanceof Error ? e.message : String(e),
        });
        return undefined;
      });
      if (pending) {
        await appendActionAudit({
          userId: input.userId,
          event: "proposed",
          tool: "email_confirm",
          payload: pending.payload,
          approvalId: pending.id,
        }).catch(() => undefined);
        pendingId = pending.id;
        message = `${baseMessage}\n\nReply "yes ${pending.id}" to go ahead, or "no ${pending.id}".`;
      }
    }

    const historyEntry = `${message}\n[messageId:${input.messageId} threadId:${input.threadId}]`;
    await enqueueNotification({
      userId: input.userId,
      message,
      source: "gmail",
      approvalId: pendingId,
      historyMessage: historyEntry,
    });

    actionsScheduled.push("telegram_notification");

    await this.storeToMemory(input, facts);

    return {
      messageId: input.messageId,
      category: facts.category,
      handled: "ask",
      notificationSent: true,
      facts,
      actionsScheduled,
    };
  }

  // Called when user says "yes" to a specific email action prompt
  async confirmAction(input: {
    userId: string;
    messageId: string;
    threadId: string;
    category: EmailCategory;
    facts: ExtractedEmailFacts;
    action: "remind" | "schedule" | "draft" | "watch";
    learnPreference?: boolean;
  }): Promise<{ done: string[] }> {
    const honorific = await this.userPrefs.getHonorific(input.userId);
    const timezone = await this.userPrefs.getTimezone(input.userId);
    const done: string[] = [];

    if (input.action === "remind" && input.facts.dueDate) {
      const runAt = zonedTimeToUtc(new Date(input.facts.dueDate), timezone, 9, 0);
      const label = input.facts.serviceName ?? input.facts.person ?? "payment";
      await enqueueReminder({
        userId: input.userId,
        message: `${honorific.charAt(0).toUpperCase() + honorific.slice(1)}, ${label} is due today. Check your inbox.`,
        runAt: runAt.toISOString(),
        source: "gmail",
        dedupeKey: `email-reminder:${input.userId}:${input.messageId}`,
      });
      done.push("reminder_scheduled");
    }

    if (input.action === "watch") {
      await enqueueWatchReply({
        userId: input.userId,
        threadId: input.threadId,
        baselineMessageCount: 1,
        fallbackMessage: `${honorific.charAt(0).toUpperCase() + honorific.slice(1)}, no reply yet from ${input.facts.person ?? "them"}. Should I follow up?`,
        reason: input.facts.summary,
        nextDelayMs: 24 * 60 * MIN,
        delayMs: 24 * 60 * MIN,
        maxAttempts: 3,
      });
      done.push("reply_watch_set");
    }

    if (input.action === "schedule" && input.facts.meetingTime) {
      await this.scheduleMeetingReminders(
        input.userId,
        input.facts.meetingTime,
        input.facts.meetingTitle ?? "Meeting",
        honorific,
        timezone,
        input.facts.meetingEndTime,
      );
      done.push("meeting_reminders_scheduled");
    }

    if (input.learnPreference) {
      await this.emailPrefs.set({
        userId: input.userId,
        category: input.category,
        autoAct: true,
        defaultAction: input.action === "watch" ? "draft" : input.action,
        updatedAt: new Date().toISOString(),
      });
      done.push("preference_learned");
    }

    return { done };
  }

  private async autoAct(
    input: ProcessEmailInput,
    facts: ExtractedEmailFacts,
    honorific: string,
    actionsScheduled: string[],
  ) {
    const pref = await this.emailPrefs.get(input.userId, facts.category);
    const action = pref?.defaultAction ?? "remind";
    const timezone = await this.userPrefs.getTimezone(input.userId);

    if (action === "remind" && facts.dueDate) {
      const runAt = zonedTimeToUtc(new Date(facts.dueDate), timezone, 9, 0);
      const label = facts.serviceName ?? facts.person ?? "item";
      await enqueueReminder({
        userId: input.userId,
        message: `${cap(honorific)}, reminder: ${label} is due today.`,
        runAt: runAt.toISOString(),
        source: "gmail",
        dedupeKey: `email-reminder:${input.userId}:${input.messageId}`,
      }).catch((e) =>
        logger.warn("auto-remind enqueue failed", { error: e instanceof Error ? e.message : String(e) }),
      );
      actionsScheduled.push("reminder_scheduled");
      await enqueueNotification({
        userId: input.userId,
        message: `${cap(honorific)}, reminder set for ${label}${facts.dueDate ? ` on ${fmt(facts.dueDate, timezone)}` : ""}.`,
        source: "gmail",
      });
    }

    if (action === "schedule" && facts.meetingTime) {
      await this.scheduleMeetingReminders(
        input.userId,
        facts.meetingTime,
        facts.meetingTitle ?? "Meeting",
        honorific,
        timezone,
        facts.meetingEndTime,
      );
      actionsScheduled.push("meeting_reminders_scheduled");
    }
  }

  private async scheduleMeetingReminders(
    userId: string,
    meetingTimeIso: string,
    title: string,
    honorific: string,
    timezone: string,
    meetingEndIso?: string,
  ) {
    const meetingMs = Date.parse(meetingTimeIso);
    if (Number.isNaN(meetingMs)) return;

    const morning = zonedTimeToUtc(new Date(meetingMs), timezone, 8, 0);
    const t30 = new Date(meetingMs - 30 * MIN);

    const inferredEnd = meetingEndIso && !Number.isNaN(Date.parse(meetingEndIso))
      ? meetingEndIso
      : new Date(meetingMs + 60 * MIN).toISOString();
    const meetingKey = canonicalMeetingKey({ title, start: meetingTimeIso, end: inferredEnd });
    const base = `meet:${userId}:${meetingKey}`;

    if (morning.getTime() > Date.now()) {
      await enqueueReminder({
        userId,
        message: `${cap(honorific)}, you have "${title}" today.`,
        runAt: morning.toISOString(),
        source: "calendar",
        dedupeKey: `${base}:morning`,
      }).catch(() => null);
    }

    if (t30.getTime() > Date.now()) {
      await enqueueReminder({
        userId,
        message: `${cap(honorific)}, "${title}" starts in 30 minutes.`,
        runAt: t30.toISOString(),
        source: "calendar",
        dedupeKey: `${base}:t30`,
      }).catch(() => null);
    }
  }

  /** Checks every connected calendar source for the proposed email meeting. */
  private async findMeetingConflict(
    userId: string,
    facts: ExtractedEmailFacts,
    timezone: string,
  ): Promise<AvailabilityCheckResult | undefined> {
    if (!facts.meetingTime) return undefined;
    const startMs = Date.parse(facts.meetingTime);
    if (Number.isNaN(startMs)) return undefined;
    const endMs = facts.meetingEndTime ? Date.parse(facts.meetingEndTime) : startMs + 60 * MIN;
    if (Number.isNaN(endMs)) return undefined;

    return this.availability.check({
      userId,
      start: facts.meetingTime,
      end: new Date(endMs).toISOString(),
      timezone,
    });
  }

  private async buildUserMessage(
    facts: ExtractedEmailFacts,
    input: ProcessEmailInput,
    honorific: string,
    timezone: string,
  ): Promise<string> {
    const prefix = `${cap(honorific)},`;

    const who = facts.person ?? shortFrom(input.from);
    const gist = `${who} — ${facts.summary.trim().replace(/\.$/, "")}`;

    switch (facts.category) {
      case "payment_due": {
        const amt = facts.amount ? ` for ${facts.amount}` : "";
        if (facts.dueDate) {
          return `${prefix} ${gist}${amt} due ${fmt(facts.dueDate, timezone)}. Should I set a reminder?`;
        }
        // No deadline found — say so explicitly rather than silently dropping it,
        // so the principal knows the bill has no date attached and can add one.
        return `${prefix} ${gist}${amt}. I couldn't find a due date in it — want me to open the email or set a reminder date?`;
      }

      case "meeting_request": {
        const when = facts.meetingTime ? ` at ${fmt(facts.meetingTime, timezone)}` : "";

        const availability = await this.findMeetingConflict(input.userId, facts, timezone);
        if (availability && !availability.complete) {
          return `${prefix} ${gist}${when}, but I couldn't verify every connected calendar. I have not treated the time as free; should I retry the availability check?`;
        }
        const conflict = availability?.conflicts[0];
        if (conflict) {
          const alternatives = availability?.alternatives.length
            ? ` Free alternatives: ${availability.alternatives
                .map((slot) => fmt(slot.start, timezone))
                .join(", ")}.`
            : "";
          return `${prefix} ${gist}${when} — but you already have "${conflict.title}" at ${fmt(conflict.start, timezone)}.${alternatives} Want me to propose one of these times, reschedule the existing meeting, or decline?`;
        }
        return `${prefix} ${gist}${when}. Should I check your calendar and confirm?`;
      }

      case "investor_update":
        return `${prefix} ${gist}. Want me to draft a reply, or just watch this thread until they follow up?`;

      case "follow_up_needed":
        return `${prefix} ${gist}. Want me to draft a follow-up now, or just watch the thread and ping you if ${who} replies?`;

      case "general_high":
        return `${prefix} ${gist}. Looks important — let me know if you'd like me to draft a reply.`;

      case "account_alert":
        return `${prefix} ${gist}. This looks time-sensitive, you may want to log in and check it.`;

      default:
        return `${prefix} ${gist}.`;
    }
  }

  private async storeToMemory(input: ProcessEmailInput, facts: ExtractedEmailFacts) {
    if (!env.BACKGROUND_AI_ENABLED) return;
    await this.memory
      .remember({
        userId: input.userId,
        source: "gmail",
        summary: `Email from ${input.from} (${input.subject}): ${facts.summary}`,
        metadata: {
          kind: "email-summary",
          dedupeKey: `gmail:${input.messageId}`,
          messageId: input.messageId,
          threadId: input.threadId,
          category: facts.category,
          from: input.from,
          subject: input.subject,
          person: facts.person ?? "",
          serviceName: facts.serviceName ?? "",
          dueDate: facts.dueDate ?? "",
          action: facts.action ?? "",
          requiresReply: facts.requiresReply ?? false,
          urgency: facts.urgency ?? "normal",
          riskLevel: facts.riskLevel ?? "low",
          senderType: facts.senderType ?? "unknown",
          suggestedAction: facts.suggestedAction ?? "notify",
          isAutomated: facts.isAutomated ?? false,
          isMarketing: facts.isMarketing ?? false,
          replyIntent: facts.replyIntent ?? "unknown",
          provenance: "gmail-classifier",
          confidence: facts.confidence,
        },
      })
      .catch((e) =>
        logger.warn("email memory store failed", {
          error: e instanceof Error ? e.message : String(e),
        }),
      );
  }
}

function defaultActionFor(
  category: EmailCategory,
): "remind" | "schedule" | "draft" | "watch" | undefined {
  if (category === "payment_due") return "remind";
  if (category === "meeting_request") return "schedule";
  if (category === "investor_update") return "draft";
  if (category === "follow_up_needed") return "draft";
  return undefined;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function shortFrom(from: string): string {
  const name = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (name) return name[1].trim();
  const email = from.match(/<([^>]+)>/);
  return (email ? email[1] : from).split("@")[0];
}

function fmt(iso: string, timezone: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
