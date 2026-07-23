import type { GoogleService } from "../google/google.service";
import type { GmailMessage } from "../google/google.types";
import type { LlmRouterService } from "../llm/llm-router.service";
import type { PriorityClassification } from "../llm/llm.types";
import type { HeyRizPriority } from "../context/context.types";
import type { HeyRizTool } from "./tool.types";
import { env } from "@heyriz/shared/env";
import { primaryUpdatesInboxQuery } from "../google/gmail-search";
import type { DraftCacheService } from "./draft-cache.service";
import { enqueueOutboundEmail } from "@heyriz/shared/queue/outbound-email";

const TRIAGE_LIMIT = 8;
const MAX_TRIAGE_LIMIT = 50;
// Wider metadata pool to rank within — cheap Gmail metadata fetches, so old
// starred/important mail is in contention without raising the LLM budget.
const CANDIDATE_LIMIT = 16;
const CLASSIFY_CONCURRENCY = 4;

/** Starred beats Gmail-important beats neither — used to rank the candidate pool. */
function importanceScore(labelIds?: string[]): number {
  if (!labelIds) return 0;
  return (
    (labelIds.includes("STARRED") ? 2 : 0) +
    (labelIds.includes("IMPORTANT") ? 1 : 0)
  );
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
      "Triage unread mail by consequence and required action. The result separates important, digest, and lessImportant mail; never describe lessImportant entries as important.",
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
        if (
          payload.messageId &&
          (cls.priority === "HIGH" || cls.priority === "MEDIUM")
        ) {
          cls = await refineWithLiveBody(
            google,
            llm,
            userId,
            payload.messageId,
            cls,
            {
              subject: payload.subject ?? payload.message,
              from: payload.from,
            },
          );
        }
        return {
          tool: "gmail_triage",
          status: "ok",
          priority: cls.priority,
          message: singleVerdict(cls.priority, cls.reason, context.honorific),
          data: { decision: decisionFor(cls.priority), reason: cls.reason },
        };
      }

      // Otherwise sweep the live inbox. Pull a wider candidate pool (recent OR
      // starred OR Gmail-important); provider labels are retrieval hints only,
      // while our own classification determines the final order.
      const limit = normalizeTriageLimit(payload.maxResults);
      const res = await google.listThreads(userId, {
        q: primaryUpdatesInboxQuery(
          `is:unread (newer_than:${env.EMAIL_TRIAGE_WINDOW_DAYS}d OR is:starred OR is:important)`,
        ),
        maxResults: Math.max(limit, CANDIDATE_LIMIT),
      });
      if (!res.connected)
        return notConnected("gmail_triage", context.honorific);

      const ranked = [...res.messages].sort(
        (a, b) => importanceScore(b.labelIds) - importanceScore(a.labelIds),
      );

      type TriageItem = {
        id: string;
        threadId: string;
        from: string;
        subject: string;
        priority: HeyRizPriority;
        reason: string;
        decision: string;
        category?: PriorityClassification["category"];
        requiresAction?: boolean;
        confidence?: PriorityClassification["confidence"];
      };

      // Gmail's IMPORTANT label is only a retrieval hint, not our verdict. Score
      // the whole small candidate pool with bounded concurrency, then apply the
      // result limit. Otherwise eight Gmail-labelled newsletters can consume
      // the budget and hide a genuinely critical ninth message.
      const items = await mapWithConcurrency(
        ranked,
        CLASSIFY_CONCURRENCY,
        async (m): Promise<TriageItem> => {
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
          return {
            id: m.id,
            threadId: m.threadId,
            from: m.from,
            subject: m.subject,
            priority: cls.priority,
            reason: cls.reason,
            decision: decisionFor(cls.priority),
            category: cls.category,
            requiresAction: cls.requiresAction,
            confidence: cls.confidence,
          };
        },
      );

      items.sort((a, b) => rank(b.priority) - rank(a.priority));
      const reviewedCounts = {
        high: items.filter((i) => i.priority === "HIGH").length,
        medium: items.filter((i) => i.priority === "MEDIUM").length,
        low: items.filter((i) => i.priority === "LOW").length,
      };
      const selected = items.slice(0, limit);
      const high = selected.filter((i) => i.priority === "HIGH");
      const medium = selected.filter((i) => i.priority === "MEDIUM");
      const low = selected.filter((i) => i.priority === "LOW");

      return {
        tool: "gmail_triage",
        status: "ok",
        priority: high.length ? "HIGH" : medium.length ? "MEDIUM" : "LOW",
        message: inboxSummary(
          high,
          medium,
          reviewedCounts,
          context.honorific,
        ),
        data: {
          // `items` remains the backward-compatible notable-mail collection
          // consumed by auto-memory. Low-value mail is intentionally separate,
          // so downstream agents cannot accidentally present every unread item
          // as an "important emails" list.
          items: [...high, ...medium],
          important: high,
          forDigest: medium,
          lessImportant: low,
          counts: { high: high.length, medium: medium.length, low: low.length },
          reviewedCount: items.length,
          reviewedCounts,
        },
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
      "Draft a reply (optionally to a specific messageId). Returns a ready-to-send payload. Sending still needs approval.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      let original: GmailMessage | undefined;
      if (payload.messageId) {
        const m = await google.getMessage(userId, payload.messageId, "full");
        if (!m.connected)
          return notConnected("draft_email_reply", context.honorific);
        original = m.message;
      }

      const to = payload.to ?? original?.from ?? "";
      const subject = original
        ? ensureRe(original.subject)
        : (payload.subject ?? "");
      const body = await draftBody(
        llm,
        userId,
        original,
        payload.instructions,
        context.principalName,
      );

      const sendPayload = {
        to,
        subject,
        body,
        cc: original?.cc,
        threadId: original?.threadId,
        inReplyTo: original?.messageIdHeader,
      };

      // Best-effort: persist as a real Gmail draft when the connected account
      // has a compose/modify-capable grant. The verified scope set only needs
      // gmail.readonly + gmail.send, so this must never block the send payload.
      let draftId: string | undefined;
      try {
        const draft = await google.createDraft(userId, sendPayload);
        if (draft.connected) {
          draftId = draft.draftId;
        }
      } catch {
        draftId = undefined;
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
  sendAt?: string;
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

      // Placeholder guard: models leave template tokens like "[Your Name]" in
      // the body and still send. Fill the sign-off we know; refuse on the rest
      // rather than putting a literal placeholder in front of a real recipient.
      const guarded = fillAndGuardPlaceholders(
        payload.body,
        context.principalName,
      );
      if (guarded.leftoverPlaceholder) {
        return {
          tool: "send_email",
          status: "not_implemented",
          message: `The draft still has an unfilled placeholder ${guarded.leftoverPlaceholder}, ${context.honorific} — tell me what goes there and I'll send it.`,
        };
      }
      const body = guarded.body;

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

      if (payload.sendAt) {
        const sendAt = new Date(payload.sendAt);
        if (Number.isNaN(sendAt.getTime()) || sendAt.getTime() <= Date.now()) {
          return {
            tool: "send_email",
            status: "not_implemented",
            message: `Choose a valid future send time, ${context.honorific}.`,
          };
        }
        await enqueueOutboundEmail(
          {
            userId,
            to: payload.to,
            subject: payload.subject ?? "",
            body,
            threadId,
            inReplyTo,
          },
          sendAt,
        );
        return {
          tool: "send_email",
          status: "ok",
          message: `Email scheduled for ${sendAt.toISOString()}, ${context.honorific}.`,
          data: { scheduled: true, sendAt: sendAt.toISOString() },
        };
      }

      const res = await google.sendMessage(userId, {
        to: payload.to,
        subject: payload.subject ?? "",
        body,
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

/** Fills a known sign-off name into "[Your Name]"-style tokens and flags any leftover placeholder. */
export function fillAndGuardPlaceholders(
  body: string,
  principalName?: string,
): { body: string; leftoverPlaceholder?: string } {
  let filled = body;
  if (principalName) {
    filled = filled.replace(/\[\s*(?:your|my)?\s*name\s*\]/gi, principalName);
  }
  const leftover = filled.match(/\[[A-Za-z][^\]\n]{1,40}\]/);
  return leftover
    ? { body: filled, leftoverPlaceholder: leftover[0] }
    : { body: filled };
}

export async function draftBody(
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
    (instructions
      ? `Hi,\n\n${instructions}\n\n${signOff}`
      : `Hi,\n\nThanks for the note.\n\n${signOff}`)
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
  return priority === "HIGH"
    ? "notify"
    : priority === "MEDIUM"
      ? "digest"
      : "silent";
}

function rank(priority: HeyRizPriority): number {
  return priority === "HIGH" ? 3 : priority === "MEDIUM" ? 2 : 1;
}

function normalizeTriageLimit(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return TRIAGE_LIMIT;
  return Math.min(MAX_TRIAGE_LIMIT, Math.max(1, Math.trunc(value)));
}

async function mapWithConcurrency<TInput, TOutput>(
  input: TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (input.length === 0) return [];
  const output = new Array<TOutput>(input.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < input.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await mapper(input[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), input.length) },
      () => worker(),
    ),
  );
  return output;
}

function singleVerdict(
  priority: HeyRizPriority,
  reason: string,
  honorific: string,
): string {
  if (priority === "HIGH")
    return `Important, ${honorific} — ${reason}. I'd surface this now.`;
  if (priority === "MEDIUM")
    return `Noted, ${honorific} — ${reason}. Folding it into your digest.`;
  return `Low priority, ${honorific} — ${reason}. Logged, no action needed.`;
}

function inboxSummary(
  high: Array<{ from: string; subject: string }>,
  medium: Array<{ from: string; subject: string }>,
  reviewed: { high: number; medium: number; low: number },
  honorific: string,
): string {
  if (high.length === 0) {
    if (medium.length === 0) {
      return `No important mail, ${honorific} — all ${reviewed.low} reviewed messages were filtered as low-priority noise.`;
    }
    const digestList = medium
      .map((item) => `${shortFrom(item.from)} (${item.subject})`)
      .join("; ");
    return `No high-priority mail, ${honorific}. ${reviewed.medium} possibly useful for your digest: ${digestList}. ${reviewed.low} filtered as low-priority noise.`;
  }
  const list = high
    .map((h) => `${shortFrom(h.from)} (${h.subject})`)
    .join("; ");
  const shown =
    reviewed.high > high.length ? `Showing the top ${high.length}. ` : "";
  return `${reviewed.high} need you now, ${honorific}: ${list}. ${shown}${reviewed.medium} possibly useful for your digest; ${reviewed.low} filtered as low-priority noise.`;
}

export function ensureRe(subject: string): string {
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
