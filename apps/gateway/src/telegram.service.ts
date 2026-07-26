import { Inject, Injectable } from "@nestjs/common";
import {
  APPROVAL_STORE,
  type ApprovalStore,
  type PendingApprovalRecord,
} from "./approval-store";
import { AuthRepository } from "./auth/auth.repository";
import {
  CONVERSATION_STORE,
  type ConversationStore,
  type ConversationTurn,
} from "./conversation-store";
import { GatewayService } from "./gateway.service";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { sendEmail } from "@heyriz/shared/email";
import {
  answerCallbackQuery,
  approvalKeyboard,
  sendTelegramMessage,
  sendTyping,
  transcribeTelegramVoice,
} from "@heyriz/shared/telegram";
import { appendActionAudit } from "@heyriz/shared/action-audit";

const START_TOKEN = /^\/start\s+(\S+)/;

async function sendWelcomeEmail(email: string, name: string | undefined): Promise<void> {
  const greeting = name ? `Hi ${name}` : "Hi there";
  await sendEmail({
    to: email,
    subject: "Welcome to Rizly — you're all set up",
    text: `${greeting},\n\nYour Rizly operator is live. From now on, drafts, approvals, and your daily brief will land right here in Telegram — nothing sends without your say-so.\n\nReply here anytime with a question about your inbox, calendar, or revenue.\n\n— The Rizly team`,
    html: `<p>${greeting},</p><p>Your Rizly operator is live. From now on, drafts, approvals, and your daily brief will land right here in Telegram — nothing sends without your say-so.</p><p>Reply here anytime with a question about your inbox, calendar, or revenue.</p><p>— The Rizly team</p>`,
  });
}

type TelegramChat = { id: number };
type TelegramMessage = {
  chat: TelegramChat;
  text?: string;
  voice?: { file_id: string };
};
type TelegramCallback = {
  id: string;
  data?: string;
  message?: { chat: TelegramChat };
};
export type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallback;
};

type ChatResponse = {
  reply: string;
  error?: string;
  upgradeRequired?: boolean;
  pendingApproval?: { tool: string; payload: Record<string, unknown>; preview: string };
};

function turn(role: ConversationTurn["role"], content: string): ConversationTurn {
  return { role, content, timestamp: new Date().toISOString() };
}

function userIdFromEmail(email: string) {
  return email.trim().toLowerCase();
}

// Shown to whoever tries to link an already-claimed chat — enough to
// recognize your own other account without leaking a stranger's address.
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "another account";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

const AFFIRM = /^(y|yes|yep|yeah|ya|ok|okay|sure|do it|go ahead|send( it)?|confirm|approve|please do)\b/i;
const NEGATE = /^(n|no|nope|cancel|stop|don'?t|abort|discard|nah)\b/i;
const WATCH = /^(watch|just watch|keep an eye|monitor)\b/i;
const LIST = /^(list|pending|what'?s pending|show pending|queue)\b/i;

type Decision =
  | { kind: "affirm"; id?: string; all: boolean }
  | { kind: "negate"; id?: string; all: boolean }
  | { kind: "watch"; id?: string };

/**
 * Reads the principal's reply against the actions currently pending. Returns a
 * structured decision, or null when the text is a fresh instruction (not a
 * yes/no/watch directed at the queue). With nothing pending, everything is a
 * fresh instruction — a bare "yes" can't approve what doesn't exist.
 */
function parseDecision(text: string, pending: PendingApprovalRecord[]): Decision | null {
  if (pending.length === 0) return null;
  const idMatch = text.match(/\b(\d{1,4})\b/);
  const id = idMatch ? idMatch[1] : undefined;
  const all = /\b(all|both|everything)\b/i.test(text);
  if (WATCH.test(text)) return { kind: "watch", id };
  if (AFFIRM.test(text)) return { kind: "affirm", id, all };
  if (NEGATE.test(text)) return { kind: "negate", id, all };
  // A bare number ("2") when that id is pending = pick & approve it.
  if (id && /^\d{1,4}$/.test(text.trim()) && pending.some((p) => p.id === id)) {
    return { kind: "affirm", id, all: false };
  }
  return null;
}

/**
 * Closes the conversational loop over Telegram. Inbound updates route to the
 * ai-core agent; when the agent proposes an approval-gated action we hold the
 * proposal (per chat, with TTL, in Redis) and a follow-up "yes" — or the inline
 * button — re-invokes chat with approve:true so the gated tool actually runs.
 */
@Injectable()
export class TelegramService {
  constructor(
    @Inject(GatewayService)
    private readonly gateway: GatewayService,
    @Inject(APPROVAL_STORE)
    private readonly approvals: ApprovalStore,
    @Inject(CONVERSATION_STORE)
    private readonly conversations: ConversationStore,
    @Inject(AuthRepository)
    private readonly authRepo: AuthRepository,
  ) {}

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.callback_query) {
      await this.handleCallback(update.callback_query);
      return;
    }

    const message = update.message;
    const chatId = message?.chat?.id;
    if (!chatId) return;

    let text = message?.text?.trim();
    if (!text && message?.voice?.file_id) {
      text = await transcribeTelegramVoice(message.voice.file_id);
      if (!text) {
        await sendTelegramMessage({
          chatId,
          text: `Couldn't make out that voice note, ${env.PRINCIPAL_HONORIFIC} — try again or type it out?`,
        });
        return;
      }
    }
    if (!text) return;

    const startMatch = text.match(START_TOKEN);
    if (startMatch) {
      await this.handleStart(chatId, startMatch[1]);
      return;
    }

    if (!(await this.isOwner(chatId))) {
      logger.warn("telegram update from non-owner chat ignored", { chatId });
      return;
    }

    const key = await this.userIdForChat(chatId);

    // Fires alongside the chat reply below, never instead of it — Telegram
    // has no separate "channel" concept, so the owner's own DM is the only
    // message stream there is, and it doubles as both chat input and an
    // automation trigger source. Fire-and-forget: a trigger-dispatch hiccup
    // must never block or break the normal assistant reply.
    this.gateway
      .sendToAiCore("automation.telegram.event", {
        userId: key,
        chatId: String(chatId),
        messageId: String(update.update_id ?? `${chatId}:${Date.now()}`),
        text,
      })
      .catch((error) => {
        logger.warn("telegram automation trigger dispatch failed", {
          chatId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    const pending = await this.approvals.list(key);

    if (pending.length > 0 && LIST.test(text)) {
      await sendTelegramMessage({ chatId, text: this.renderPending(pending) });
      return;
    }

    const decision = parseDecision(text, pending);
    if (decision) {
      await this.applyDecision(chatId, key, decision, pending);
      return;
    }

    // A fresh instruction. We deliberately do NOT clear the pending proposals —
    // each is addressable by id and waits for its own yes/no, so a new request
    // never silently drops an un-approved action (the old single-slot bug).
    await this.runChat(chatId, text, key);
  }

  private async handleStart(chatId: number, token: string): Promise<void> {
    const record = await this.authRepo.consumeTelegramLinkToken(token, String(chatId));

    if (!record) {
      const existing = await this.authRepo.findTelegramLinkByChat(String(chatId));
      if (existing) {
        await sendTelegramMessage({
          chatId,
          text: `You're already linked to ${maskEmail(existing.email ?? existing.userId)}.`,
        });
        return;
      }
      await sendTelegramMessage({
        chatId,
        text: "That link has expired — generate a new one from the dashboard.",
      });
      return;
    }

    const userId = userIdFromEmail(record.email);
    const userBeforeLink = await this.authRepo.getUser(record.email);
    const isFirstOnboarding = !userBeforeLink?.onboarding?.completedAt;
    const linked = await this.authRepo.linkTelegramChat(String(chatId), record.email, userId);

    if (!linked.ok) {
      await sendTelegramMessage({
        chatId,
        text: `This Telegram is already linked to ${maskEmail(linked.linkedEmail)}. One chat can only serve one account — unlink it from that account's dashboard first, then try again.`,
      });
      return;
    }

    if (isFirstOnboarding) {
      sendWelcomeEmail(record.email, userBeforeLink?.name).catch((error) => {
        logger.warn("failed to send welcome email", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    try {
      await this.gateway.sendToAiCore("connector.save", {
        userId,
        provider: "telegram",
        authType: "manual",
        label: "Telegram",
        secret: { chatId: String(chatId) },
        metadata: { setup: "telegram_link" },
      });
    } catch (error) {
      logger.warn("failed to save telegram connector record", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await sendTelegramMessage({
      chatId,
      text: `Linked, ${env.PRINCIPAL_HONORIFIC} — I'll take it from here.`,
    });
  }

  private async handleCallback(cb: TelegramCallback): Promise<void> {
    await answerCallbackQuery(cb.id);
    const chatId = cb.message?.chat?.id;
    if (!chatId || !(await this.isOwner(chatId))) return;

    const key = await this.userIdForChat(chatId);
    const [verb, id] = (cb.data ?? "").split(":");

    // Resolve the action this button belongs to. Newer buttons embed the id;
    // an id-less (legacy/expired) button falls back only if exactly one is
    // pending, otherwise we ask the principal to disambiguate by number.
    let record: PendingApprovalRecord | undefined;
    if (id) {
      record = await this.approvals.get(key, id);
    } else {
      const all = await this.approvals.list(key);
      if (all.length === 1) record = all[0];
    }

    if (!record) {
      await sendTelegramMessage({
        chatId,
        text: `That request is no longer pending, ${env.PRINCIPAL_HONORIFIC} — say "list" to see what's waiting.`,
      });
      return;
    }

    if (verb === "approve") {
      await this.runApproved(chatId, record);
    } else if (verb === "reject") {
      await this.rejectOne(chatId, key, record);
    }
  }

  private async runChat(chatId: number, message: string, userId: string): Promise<void> {
    const conversationKey = String(chatId);
    const history = await this.conversations.get(conversationKey);

    await sendTyping(chatId);
    const typingInterval = setInterval(() => void sendTyping(chatId), 4000);

    let res: ChatResponse;
    try {
      res = await this.gateway.sendChatToAiCore<ChatResponse>({
        userId,
        message,
        history,
      });
    } finally {
      clearInterval(typingInterval);
    }

    await this.conversations.append(conversationKey, turn("user", message));
    await this.conversations.append(
      conversationKey,
      turn(
        "assistant",
        res.pendingApproval ? `${res.reply}\n\n${res.pendingApproval.preview}` : res.reply,
      ),
    );

    if (res.pendingApproval) {
      const rec = await this.approvals.add(userId, res.pendingApproval);
      const others = (await this.approvals.list(userId)).filter((p) => p.id !== rec.id);
      const note =
        others.length > 0
          ? `\n\nYou've also got ${others.length} waiting (${others
              .map((p) => `#${p.id} ${p.label}`)
              .join("; ")}). This one is #${rec.id} — say "yes ${rec.id}" or use the buttons.`
          : "";
      await sendTelegramMessage({
        chatId,
        text: `${res.reply}\n\n${res.pendingApproval.preview}${note}`,
        replyMarkup: approvalKeyboard(rec.id),
      });
      return;
    }
    await sendTelegramMessage({ chatId, text: res.reply });
  }

  private async runApproved(chatId: number, pending: PendingApprovalRecord): Promise<void> {
    const userId = await this.userIdForChat(chatId);
    if (!(await this.gateway.hasProductAccess(userId))) {
      await sendTelegramMessage({
        chatId,
        text: "Your Rizly trial has ended. Choose a paid plan to continue: https://getrizly.com/dashboard/upgrade",
      });
      return;
    }
    const conversationKey = String(chatId);
    await this.approvals.remove(userId, pending.id);
    await appendActionAudit({
      userId,
      event: "approved",
      tool: pending.tool,
      payload: pending.payload,
      approvalId: pending.id,
    }).catch(() => undefined);
    const history = await this.conversations.get(conversationKey);

    await sendTyping(chatId);
    const typingInterval = setInterval(() => void sendTyping(chatId), 4000);

    let res: ChatResponse;
    try {
      res = await this.gateway.sendChatToAiCore<ChatResponse>({
        userId,
        message: "approved",
        approve: true,
        pendingApproval: { id: pending.id, tool: pending.tool, payload: pending.payload },
        history,
      });
    } finally {
      clearInterval(typingInterval);
    }

    const remaining = await this.approvals.list(userId);
    const note =
      remaining.length > 0
        ? `\n\n(${remaining.length} still waiting: ${remaining
            .map((p) => `#${p.id} ${p.label}`)
            .join("; ")}.)`
        : "";

    await this.conversations.append(conversationKey, turn("user", "approved"));
    await this.conversations.append(conversationKey, turn("assistant", res.reply));
    await sendTelegramMessage({ chatId, text: `${res.reply}${note}` });
  }

  /** Apply a yes/no/watch decision against the pending queue. */
  private async applyDecision(
    chatId: number,
    key: string,
    decision: Decision,
    pending: PendingApprovalRecord[],
  ): Promise<void> {
    if (decision.kind === "watch") {
      const target = this.pickTarget(decision.id, pending, (p) => p.tool === "email_confirm");
      if (!target) return this.askWhich(chatId, pending, "watch", decision.id);
      const payload = target.payload as Record<string, unknown>;
      await this.runApproved(chatId, { ...target, payload: { ...payload, action: "watch" } });
      return;
    }

    if (decision.kind === "affirm") {
      if (decision.all) {
        // Oldest first; runApproved removes each as it goes.
        for (const p of pending) await this.runApproved(chatId, p);
        return;
      }
      const target = this.pickTarget(decision.id, pending);
      if (!target) return this.askWhich(chatId, pending, "approve", decision.id);
      await this.runApproved(chatId, target);
      return;
    }

    // negate
    if (decision.all) {
      await this.approvals.clear(key);
      await sendTelegramMessage({
        chatId,
        text: `Cleared all ${pending.length}, ${env.PRINCIPAL_HONORIFIC}.`,
      });
      return;
    }
    const target = this.pickTarget(decision.id, pending);
    if (!target) return this.askWhich(chatId, pending, "cancel", decision.id);
    await this.rejectOne(chatId, key, target);
  }

  /** Resolve which pending action a decision refers to, or undefined if ambiguous. */
  private pickTarget(
    id: string | undefined,
    pending: PendingApprovalRecord[],
    filter?: (p: PendingApprovalRecord) => boolean,
  ): PendingApprovalRecord | undefined {
    const pool = filter ? pending.filter(filter) : pending;
    if (id) return pool.find((p) => p.id === id);
    return pool.length === 1 ? pool[0] : undefined;
  }

  private async rejectOne(
    chatId: number,
    key: string,
    record: PendingApprovalRecord,
  ): Promise<void> {
    await this.approvals.remove(key, record.id);
    await appendActionAudit({
      userId: key,
      event: "rejected",
      tool: record.tool,
      payload: record.payload,
      approvalId: record.id,
    }).catch(() => undefined);
    await this.recordRejection(String(chatId), record);
    await sendTelegramMessage({
      chatId,
      text: `Cancelled #${record.id} (${record.label}), ${env.PRINCIPAL_HONORIFIC}.`,
    });
  }

  private async askWhich(
    chatId: number,
    pending: PendingApprovalRecord[],
    verb: "approve" | "cancel" | "watch",
    requestedId?: string,
  ): Promise<void> {
    const say = verb === "cancel" ? "no" : "yes";
    const lead = requestedId
      ? `I don't see #${requestedId} waiting, ${env.PRINCIPAL_HONORIFIC}.`
      : `You've got ${pending.length} waiting, ${env.PRINCIPAL_HONORIFIC} — which to ${verb}?`;
    await sendTelegramMessage({
      chatId,
      text: `${lead}\n${this.renderList(pending)}\nSay "${say} <number>"${
        verb === "watch" ? "" : ` or "${say} all"`
      }.`,
    });
  }

  private renderPending(pending: PendingApprovalRecord[]): string {
    return `Pending, ${env.PRINCIPAL_HONORIFIC}:\n${this.renderList(
      pending,
    )}\nSay "yes <number>" to run one, "yes all", or "no <number>".`;
  }

  private renderList(pending: PendingApprovalRecord[]): string {
    return pending.map((p) => `#${p.id} — ${p.label}`).join("\n");
  }

  private async recordRejection(chatId: string, pending: PendingApprovalRecord): Promise<void> {
    await this.conversations.append(chatId, turn("assistant", `Proposed: ${pending.preview}`));
    await this.conversations.append(chatId, turn("user", "No, cancel that."));
  }

  private async isOwner(chatId: number): Promise<boolean> {
    if (env.TELEGRAM_CHAT_ID) {
      return String(chatId) === String(env.TELEGRAM_CHAT_ID);
    }

    // Fail closed. A DB error must not promote an arbitrary chat to owner, and
    // "nobody linked yet" is not a licence to act for everyone — the only way in
    // is an explicit /start link (handled before this gate) or TELEGRAM_CHAT_ID.
    try {
      return Boolean(await this.authRepo.findUserIdByTelegramChat(String(chatId)));
    } catch (error) {
      logger.warn("telegram owner check failed; denying", {
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async userIdForChat(chatId: number): Promise<string> {
    return (
      (await this.authRepo.findUserIdByTelegramChat(String(chatId)).catch(() => null)) ??
      env.DEFAULT_USER_ID
    );
  }
}
