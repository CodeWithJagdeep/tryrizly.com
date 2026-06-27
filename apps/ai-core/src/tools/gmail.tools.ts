import type { GoogleService } from "../google/google.service";
import type { GmailMessage } from "../google/google.types";
import type { LlmRouterService } from "../llm/llm-router.service";
import type { PriorityClassification } from "../llm/llm.types";
import type { HeyRizPriority } from "../context/context.types";
import type { HeyRizTool } from "./tool.types";
import { env } from "@heyriz/shared/env";
import { primaryUpdatesInboxQuery } from "../google/gmail-search";
import type { DraftCacheService } from "./draft-cache.service";

const TRIAGE_LIMIT = 8;
// Wider metadata pool to rank within — cheap Gmail metadata fetches, so old
// starred/important mail is in contention without raising the LLM budget.
const CANDIDATE_LIMIT = 16;

/** Starred beats Gmail-important beats neither — used to rank the candidate pool. */
function importanceScore(labelIds?: string[]): number {
  if (!labelIds) return 0;
  return (labelIds.includes("STARRED") ? 2 : 0) + (labelIds.includes("IMPORTANT") ? 1 : 0);
}

type TriagePayload = {
  messageId?: string;
  subject?: string;
  from?: string;
  snippet?: string;
  message?: string;
  maxResults?: number;
};

export function createGmailTriageTool(
  google: GoogleService,
  llm: LlmRouterService,
): HeyRizTool<TriagePayload> {
  return {
    name: "gmail_triage",
    category: "gmail",
    description:
      "Triage the inbox: fetch unread mail (or score a specific subject/sender) and classify HIGH/MEDIUM/LOW with notify/digest/silent decisions.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      // Single, already-known item (e.g. from a Gmail push webhook).
      if (payload.subject || payload.from || payload.messageId) {
        let cls = await llm.classifyPriority({
          subject: payload.subject ?? payload.message,
          from: payload.from,
          snippet: payload.snippet,
          userId,
        });
        if (payload.messageId && (cls.priority === "HIGH" || cls.priority === "MEDIUM")) {
          cls = await refineWithLiveBody(google, llm, userId, payload.messageId, cls, {
            subject: payload.subject ?? payload.message,
            from: payload.from,
          });
        }
        return {
          tool: "gmail_triage",
          status: "ok",
          priority: cls.priority,
          message: singleVerdict(cls.priority, cls.reason, context.honorific),
          data: { decision: decisionFor(cls.priority), reason: cls.reason },
        };
      }

      // Otherwise sweep the live inbox. Importance beats recency: pull a wider
      // candidate pool (recent OR starred OR Gmail-important), then rank it so
      // starred/important mail always lands inside the classification budget —
      // even when there's a flood of recent unread burying an older follow-up.
      const limit = payload.maxResults ?? TRIAGE_LIMIT;
      const res = await google.listThreads(userId, {
        q: primaryUpdatesInboxQuery(
          `is:unread (newer_than:${env.EMAIL_TRIAGE_WINDOW_DAYS}d OR is:starred OR is:important)`,
        ),
        maxResults: Math.max(limit, CANDIDATE_LIMIT),
      });
      if (!res.connected) return notConnected("gmail_triage", context.honorific);

      const ranked = [...res.messages].sort(
        (a, b) => importanceScore(b.labelIds) - importanceScore(a.labelIds),
      );

      const items: Array<{
        id: string;
        threadId: string;
        from: string;
        subject: string;
        priority: HeyRizPriority;
        reason: string;
        decision: string;
      }> = [];

      for (const m of ranked.slice(0, limit)) {
        let cls = await llm.classifyPriority({
          subject: m.subject,
          from: m.from,
          snippet: m.snippet,
          userId,
        });
        // Worth the extra fetch: read the real body live (never stored) so the
        // verdict/reason isn't based on a truncated snippet.
        if (cls.priority === "HIGH" || cls.priority === "MEDIUM") {
          cls = await refineWithLiveBody(google, llm, userId, m.id, cls, {
            subject: m.subject,
            from: m.from,
          });
        }
        items.push({
          id: m.id,
          threadId: m.threadId,
          from: m.from,
          subject: m.subject,
          priority: cls.priority,
          reason: cls.reason,
          decision: decisionFor(cls.priority),
        });
      }

      items.sort((a, b) => rank(b.priority) - rank(a.priority));
      const high = items.filter((i) => i.priority === "HIGH");
      const medium = items.filter((i) => i.priority === "MEDIUM");
      const low = items.filter((i) => i.priority === "LOW");

      return {
        tool: "gmail_triage",
        status: "ok",
        priority: high.length ? "HIGH" : medium.length ? "MEDIUM" : "LOW",
        message: inboxSummary(high, medium.length, low.length, context.honorific),
        data: { items, counts: { high: high.length, medium: medium.length, low: low.length } },
      };
    },
  };
}

type DraftPayload = {
  messageId?: string;
  to?: string;
  subject?: string;
  instructions?: string;
};

export function createDraftEmailReplyTool(
  google: GoogleService,
  llm: LlmRouterService,
  draftCache: DraftCacheService,
): HeyRizTool<DraftPayload> {
  return {
    name: "draft_email_reply",
    category: "gmail",
    description:
      "Draft a reply (optionally to a specific messageId) and save it as a Gmail draft. Returns a ready-to-send payload. Sending still needs approval.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      let original: GmailMessage | undefined;
      if (payload.messageId) {
        const m = await google.getMessage(userId, payload.messageId, "full");
        if (!m.connected) return notConnected("draft_email_reply", context.honorific);
        original = m.message;
      }

      const to = payload.to ?? original?.from ?? "";
      const subject = original ? ensureRe(original.subject) : payload.subject ?? "";
      const body = await draftBody(llm, userId, original, payload.instructions, context.principalName);

      const sendPayload = {
        to,
        subject,
        body,
        cc: original?.cc,
        threadId: original?.threadId,
        inReplyTo: original?.messageIdHeader,
      };

      // Best-effort: persist as a real Gmail draft so it shows in the user's drafts.
      let draftId: string | undefined;
      const draft = await google.createDraft(userId, sendPayload);
      if (draft.connected) {
        draftId = draft.draftId;
      }

      // Recovery net for send_email: if the model forgets to carry threadId/
      // inReplyTo forward, we can still recover them from here by recipient.
      if (to) draftCache.set(userId, sendPayload);

      return {
        tool: "draft_email_reply",
        status: "ok",
        message: `Draft ready, ${context.honorific}${to ? ` for ${shortFrom(to)}` : ""}:\n\n${body}`,
        data: { draft: { ...sendPayload, draftId }, sendPayload },
      };
    },
  };
}

type SendPayload = {
  to?: string;
  subject?: string;
  body?: string;
  threadId?: string;
  inReplyTo?: string;
  approved?: boolean;
};

export function createSendEmailTool(
  google: GoogleService,
  draftCache: DraftCacheService,
): HeyRizTool<SendPayload> {
  return {
    name: "send_email",
    category: "gmail",
    description:
      "Send an email reply on the principal's behalf. Requires explicit approval. Needs to, subject, body.",
    approvalRequired: true,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      if (payload.approved !== true) {
        return {
          tool: "send_email",
          status: "pending_approval",
          message: `Sending needs your explicit approval, ${context.honorific}.`,
        };
      }
      if (!payload.to || !payload.body) {
        return {
          tool: "send_email",
          status: "not_implemented",
          message: `I need a recipient and a body before I can send, ${context.honorific}.`,
        };
      }

      // Server-side recovery net: don't trust the model to have carried these
      // forward from the draft step — a dropped threadId/inReplyTo silently
      // sends a brand-new, unthreaded email instead of a reply.
      let threadId = payload.threadId;
      let inReplyTo = payload.inReplyTo;
      if (!threadId || !inReplyTo) {
        const cached = draftCache.matchFor(userId, payload.to);
        threadId = threadId ?? cached?.threadId;
        inReplyTo = inReplyTo ?? cached?.inReplyTo;
      }

      const res = await google.sendMessage(userId, {
        to: payload.to,
        subject: payload.subject ?? "",
        body: payload.body,
        threadId,
        inReplyTo,
      });
      if (!res.connected) return notConnected("send_email", context.honorific);

      return {
        tool: "send_email",
        status: "ok",
        message: `Sent, ${context.honorific} — your reply is on its way to ${shortFrom(payload.to)}.`,
        data: { messageId: res.messageId, threadId: res.threadId },
      };
    },
  };
}

async function draftBody(
  llm: LlmRouterService,
  userId: string,
  original: GmailMessage | undefined,
  instructions?: string,
  principalName?: string,
): Promise<string> {
  const signOff = principalName ? `Best,\n${principalName}` : "Best,";

  if (!llm.hasProvider()) {
    return instructions
      ? `Hi,\n\n${instructions}\n\n${signOff}`
      : `Hi,\n\nThanks for the note — I'll follow up shortly.\n\n${signOff}`;
  }

  const context = original
    ? `You are replying to ${original.from} about "${original.subject}".\nTheir message:\n${original.body.slice(0, 1500)}`
    : "You are composing a new outbound email.";

  const ask = instructions?.trim()
    ? `The sender's exact intent: "${instructions}"\n\nWrite ONLY this. Do not add extra pleasantries, do not invent context that wasn't given, do not use generic filler phrases like "great to see things moving". If the intent is to propose a meeting, write a meeting-proposal email with the exact details given. If it's a follow-up, write that. Match the intent precisely.`
    : "Write a brief, friendly reply that moves things forward.";

  const signOffInstruction = principalName
    ? `Sign off with "Best," or "Thanks," followed by the name "${principalName}" on its own line.`
    : `Sign off with just "Best," or "Thanks," — no name is known, so do not invent one or use a placeholder.`;

  const text = await llm
    .complete({
      task: "draft",
      userId,
      messages: [
        {
          role: "system",
          content: `You draft concise, professional emails for a founder. Return ONLY the email body — no subject line, no markdown. 3-6 lines maximum. Be specific and direct. Never pad with filler. ${signOffInstruction} Never write a placeholder like "[Your Name]" or "[Name]" under any circumstance.`,
        },
        {
          role: "user",
          content: `${context}\n\n${ask}`,
        },
      ],
      temperature: 0.3,
    })
    .catch(() => undefined);

  return (
    text?.trim() ||
    (instructions ? `Hi,\n\n${instructions}\n\n${signOff}` : `Hi,\n\nThanks for the note.\n\n${signOff}`)
  );
}

/** Re-classifies using the live message body (never persisted) once a snippet-based pass says HIGH/MEDIUM. */
async function refineWithLiveBody(
  google: GoogleService,
  llm: LlmRouterService,
  userId: string,
  messageId: string,
  fallback: PriorityClassification,
  meta: { subject?: string; from?: string },
): Promise<PriorityClassification> {
  const res = await google.getMessage(userId, messageId, "full");
  if (!res.connected) return fallback;

  return llm.classifyPriority({
    subject: meta.subject,
    from: meta.from,
    body: res.message.body,
    userId,
  });
}

function decisionFor(priority: HeyRizPriority): string {
  return priority === "HIGH" ? "notify" : priority === "MEDIUM" ? "digest" : "silent";
}

function rank(priority: HeyRizPriority): number {
  return priority === "HIGH" ? 3 : priority === "MEDIUM" ? 2 : 1;
}

function singleVerdict(priority: HeyRizPriority, reason: string, honorific: string): string {
  if (priority === "HIGH") return `Important, ${honorific} — ${reason}. I'd surface this now.`;
  if (priority === "MEDIUM") return `Noted, ${honorific} — ${reason}. Folding it into your digest.`;
  return `Low priority, ${honorific} — ${reason}. Logged, no action needed.`;
}

function inboxSummary(
  high: Array<{ from: string; subject: string }>,
  medium: number,
  low: number,
  honorific: string,
): string {
  if (high.length === 0) {
    return `Nothing urgent, ${honorific} — ${medium} for your digest and ${low} low-priority, all logged.`;
  }
  const list = high
    .map((h) => `${shortFrom(h.from)} (${h.subject})`)
    .join("; ");
  return `${high.length} need you now, ${honorific}: ${list}. ${medium} more batched, ${low} low-priority.`;
}

function ensureRe(subject: string): string {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

function shortFrom(from: string): string {
  const name = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (name) return name[1].trim();
  const email = from.match(/<([^>]+)>/);
  return (email ? email[1] : from).split("@")[0];
}

function notConnected(tool: string, honorific: string) {
  return {
    tool,
    status: "needs_connection" as const,
    message: `Google not connected. NEXT STEP: call the connect_google tool immediately to send ${honorific} a direct sign-in link. Do not tell them to use the dashboard.`,
    data: { connected: false },
  };
}
