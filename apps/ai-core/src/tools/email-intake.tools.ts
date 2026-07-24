import type { GoogleService } from "../google/google.service";
import { EmailClassifierService } from "../email/email-classifier.service";
import { EmailPipelineService } from "../email/email-pipeline.service";
import { EmailPreferencesRepository } from "../email/email-preferences.repository";
import type { EmailCategory, ExtractedEmailFacts } from "../email/email.types";
import type { HeyRizTool } from "./tool.types";

type ReadEmailBodyPayload = {
  messageId?: string;
};

export function createReadEmailBodyTool(
  google: GoogleService,
  classifier: EmailClassifierService,
): HeyRizTool<ReadEmailBodyPayload> {
  return {
    name: "read_email_body",
    category: "gmail",
    description:
      "Read the full body of an email by messageId, classify its type (payment, meeting, investor, etc.) and extract key facts. Use this when the user asks about a specific email or when triage surfaces something worth investigating.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      if (!payload.messageId) {
        return {
          tool: "read_email_body",
          status: "not_implemented",
          message: `I need the messageId to read the email, ${context.honorific}.`,
        };
      }

      const res = await google.getMessage(userId, payload.messageId, "full");
      if (!res.connected) {
        return {
          tool: "read_email_body",
          status: "needs_connection",
          message: `Google not connected. NEXT STEP: call the connect_google tool immediately to send ${context.honorific} a direct sign-in link.`,
        };
      }

      const { message: msg } = res;
      const facts = await classifier.classify({
        from: msg.from,
        subject: msg.subject,
        body: msg.body,
        timezone: context.timezone,
      });

      if (facts.category === "otp") {
        return {
          tool: "read_email_body",
          status: "ok",
          message: `That's a one-time code, ${context.honorific} — I've skipped it as per policy.`,
          data: { category: "otp", ignored: true },
        };
      }

      return {
        tool: "read_email_body",
        status: "ok",
        message: buildSummary(
          facts,
          msg.from,
          context.honorific,
          context.timezone,
        ),
        data: {
          messageId: msg.id,
          threadId: msg.threadId,
          from: msg.from,
          subject: msg.subject,
          category: facts.category,
          facts,
          bodyPreview: msg.body.slice(0, 500),
        },
      };
    },
  };
}

type SetEmailPreferencePayload = {
  category?: EmailCategory;
  autoAct?: boolean;
  defaultAction?: "remind" | "schedule" | "draft" | "silent";
};

export function createSetEmailPreferenceTool(
  prefs: EmailPreferencesRepository,
): HeyRizTool<SetEmailPreferencePayload> {
  return {
    name: "set_email_preference",
    category: "memory",
    description:
      "Record a learned email behavior preference. Call this when the principal says things like 'always remind me about payment emails' or 'auto-schedule meeting requests'.",
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      if (!payload.category) {
        return {
          tool: "set_email_preference",
          status: "not_implemented",
          message: `I need to know which type of email (payment_due, meeting_request, etc.), ${context.honorific}.`,
        };
      }

      await prefs.set({
        userId,
        category: payload.category,
        autoAct: payload.autoAct ?? true,
        defaultAction: payload.defaultAction,
        updatedAt: new Date().toISOString(),
      });

      const label = payload.category.replace(/_/g, " ");
      const action = payload.defaultAction
        ? ` and ${payload.defaultAction} automatically`
        : "";
      return {
        tool: "set_email_preference",
        status: "ok",
        message: `Noted, ${context.honorific} — I'll handle ${label} emails${action} from now on without asking.`,
        data: { category: payload.category, autoAct: payload.autoAct ?? true },
      };
    },
  };
}

type EmailConfirmPayload = {
  accountId?: string;
  messageId?: string;
  threadId?: string;
  category?: EmailCategory;
  facts?: ExtractedEmailFacts;
  action?: "remind" | "schedule" | "draft" | "watch";
  learnPreference?: boolean;
  approved?: boolean;
};

/**
 * Executed when the principal approves an email pipeline proposal ("yes, remind me",
 * "yes, schedule it"). This is what the approval store stores as `tool: "email_confirm"`.
 */
export function createEmailConfirmTool(
  pipeline: EmailPipelineService,
): HeyRizTool<EmailConfirmPayload> {
  return {
    name: "email_confirm",
    category: "gmail",
    description:
      "Confirm and execute an email pipeline action the principal just approved: set a reminder, schedule meeting reminders, start a draft, or watch a thread for reply. Called automatically when the principal says 'yes' after an email notification.",
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      if (
        !payload.messageId ||
        !payload.threadId ||
        !payload.category ||
        !payload.facts ||
        !payload.action
      ) {
        return {
          tool: "email_confirm",
          status: "not_implemented",
          message: `Missing details to confirm this action, ${context.honorific}.`,
        };
      }

      const result = await pipeline.confirmAction({
        userId,
        accountId: payload.accountId,
        messageId: payload.messageId,
        threadId: payload.threadId,
        category: payload.category,
        facts: payload.facts,
        action: payload.action,
        learnPreference: payload.learnPreference,
      });

      const labels: Record<string, string> = {
        reminder_scheduled: "reminder set",
        reply_watch_set: "watching for reply",
        meeting_reminders_scheduled: "meeting reminders scheduled",
        preference_learned:
          "preference saved — I'll auto-handle this next time",
      };

      const summary = result.done.map((d) => labels[d] ?? d).join(", ");
      return {
        tool: "email_confirm",
        status: "ok",
        message: summary
          ? `Done, ${context.honorific} — ${summary}.`
          : `Handled, ${context.honorific}.`,
        data: result,
      };
    },
  };
}

function buildSummary(
  facts: {
    category: string;
    person?: string;
    serviceName?: string;
    amount?: string;
    dueDate?: string;
    meetingTime?: string;
    meetingEndTime?: string;
    meetingTitle?: string;
    action?: string;
    summary: string;
  },
  from: string,
  honorific: string,
  timezone: string,
): string {
  const who = facts.person ?? shortFrom(from);
  switch (facts.category) {
    case "payment_due":
      return `${cap(honorific)}, this is a payment email from ${who}${facts.amount ? ` for ${facts.amount}` : ""}${facts.dueDate ? `, due ${fmt(facts.dueDate, timezone)}` : ""}.`;
    case "meeting_request": {
      const when = facts.meetingTime
        ? ` at ${fmt(facts.meetingTime, timezone)}${facts.meetingEndTime ? ` - ${fmt(facts.meetingEndTime, timezone, true)}` : ""}`
        : "";
      return `${cap(honorific)}, ${who} is requesting ${facts.meetingTitle ? `"${facts.meetingTitle}"` : "a meeting"}${when}.`;
    }
    case "investor_update":
      return `${cap(honorific)}, investor email from ${who}${facts.action ? `: ${facts.action}` : ""}.`;
    case "follow_up_needed":
      return `${cap(honorific)}, ${who} is waiting for a reply.`;
    default:
      return `${cap(honorific)}, email from ${who}: ${facts.summary}`;
  }
}

function fmt(iso: string, timezone: string, timeOnly = false): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: timezone,
      ...(timeOnly ? {} : { month: "short" as const, day: "numeric" as const }),
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function shortFrom(from: string): string {
  const name = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (name) return name[1].trim();
  const email = from.match(/<([^>]+)>/);
  return (email ? email[1] : from).split("@")[0];
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
