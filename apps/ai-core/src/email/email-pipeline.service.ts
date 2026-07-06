import { Injectable } from "@nestjs/common";
import { GoogleService } from "../google/google.service";
import type { CalendarEvent } from "../google/google.types";
import { EmailClassifierService } from "./email-classifier.service";
import { EmailPreferencesRepository } from "./email-preferences.repository";
import { UserPreferencesRepository } from "../preferences/user-preferences.repository";
import { VectorMemoryService } from "../memory/vector-memory.service";
import { enqueueReminder } from "@heyriz/shared/queue/queues";
import { enqueueSpineIngest } from "@heyriz/shared/queue/spine";
import { enqueueWatchReply } from "@heyriz/shared/queue/watch-replies";
import {
  addPendingEmailAction,
  appendProactiveMessage,
} from "@heyriz/shared/queue/pending-actions";
import { approvalKeyboard, sendTelegramMessage } from "@heyriz/shared/telegram";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
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

    if (env.TELEGRAM_CHAT_ID && defaultAction) {
      const chatId = String(env.TELEGRAM_CHAT_ID);
      const pending = await addPendingEmailAction(chatId, {
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
        pendingId = pending.id;
        message = `${baseMessage}\n\nReply "yes ${pending.id}" to go ahead, or "no ${pending.id}".`;
      }
    }

    await sendTelegramMessage({
      chatId: env.TELEGRAM_CHAT_ID,
      text: message,
      replyMarkup: pendingId ? approvalKeyboard(pendingId) : undefined,
    });

    if (env.TELEGRAM_CHAT_ID) {
      // Append messageId/threadId as agent-readable metadata so the agent can
      // call read_email_body with the correct Gmail ID when the user references
      // this email — without it the agent guesses using the subject and gets 400.
      const historyEntry = `${message}\n[messageId:${input.messageId} threadId:${input.threadId}]`;
      await appendProactiveMessage(String(env.TELEGRAM_CHAT_ID), historyEntry).catch((e) =>
        logger.warn("email pipeline: history append failed", {
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }

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
        chatId: env.TELEGRAM_CHAT_ID,
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
        input.messageId,
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
      await sendTelegramMessage({
        chatId: env.TELEGRAM_CHAT_ID,
        text: `${cap(honorific)}, reminder set for ${label}${facts.dueDate ? ` on ${fmt(facts.dueDate, timezone)}` : ""}.`,
      });
    }

    if (action === "schedule" && facts.meetingTime) {
      await this.scheduleMeetingReminders(
        input.userId,
        facts.meetingTime,
        facts.meetingTitle ?? "Meeting",
        honorific,
        timezone,
        input.messageId,
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
    messageId: string,
  ) {
    const meetingMs = Date.parse(meetingTimeIso);
    if (Number.isNaN(meetingMs)) return;

    const morning = zonedTimeToUtc(new Date(meetingMs), timezone, 8, 0);
    const t30 = new Date(meetingMs - 30 * MIN);

    const base = `email-meeting:${userId}:${messageId}`;

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

  /** Finds a calendar event that overlaps the proposed meeting window, if any. */
  private async findMeetingConflict(
    userId: string,
    facts: ExtractedEmailFacts,
  ): Promise<CalendarEvent | undefined> {
    if (!facts.meetingTime) return undefined;
    const startMs = Date.parse(facts.meetingTime);
    if (Number.isNaN(startMs)) return undefined;
    const endMs = facts.meetingEndTime ? Date.parse(facts.meetingEndTime) : startMs + 60 * MIN;

    const dayStart = new Date(startMs);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(startMs);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const res = await this.google.listEvents(userId, {
      timeMin: dayStart,
      timeMax: dayEnd,
      maxResults: 25,
    });
    if (!res.connected) return undefined;

    return res.events.find((e) => {
      if (e.allDay || !e.start || !e.end) return false;
      const eStart = Date.parse(e.start);
      const eEnd = Date.parse(e.end);
      return startMs < eEnd && endMs > eStart;
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
        const when = facts.dueDate ? ` due ${fmt(facts.dueDate, timezone)}` : "";
        const amt = facts.amount ? ` for ${facts.amount}` : "";
        return `${prefix} ${gist}${amt}${when}. Should I set a reminder?`;
      }

      case "meeting_request": {
        const when = facts.meetingTime ? ` at ${fmt(facts.meetingTime, timezone)}` : "";

        const conflict = await this.findMeetingConflict(input.userId, facts);
        if (conflict) {
          return `${prefix} ${gist}${when} — but you already have "${conflict.title}" at ${fmt(conflict.start ?? "", timezone)}. Want me to reschedule one of them, or decline this one?`;
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
          messageId: input.messageId,
          threadId: input.threadId,
          category: facts.category,
          person: facts.person ?? "",
          dueDate: facts.dueDate ?? "",
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
