import { Inject, Injectable } from "@nestjs/common";
import {
  APPROVAL_STORE,
  type ApprovalStore,
  type PendingApprovalRecord,
} from "./approval-store";
import {
  CONVERSATION_STORE,
  type ConversationStore,
  type ConversationTurn,
} from "./conversation-store";
import { DiscordRepository } from "./discord.repository";
import { GatewayService } from "./gateway.service";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import {
  sendDiscordPlaceholder,
  sendDiscordSurfaceMessage,
  updateDiscordSurfaceMessage,
} from "@heyriz/shared/discord-surface";
import { appendActionAudit } from "@heyriz/shared/action-audit";

// Discord has no /start deep link outside slash commands; the dashboard tells
// the principal to DM the bot "link <token>". "/start <token>" accepted too.
const LINK_TOKEN = /^(?:link|\/start)\s+(\S+)/i;

/** A DM to the surface bot, as normalized by DiscordSocketService. */
export type DiscordSurfaceMessage = {
  discordUserId: string;
  /** The bot<->user DM channel id. */
  channel: string;
  text: string;
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

/** Reads the principal's reply against the actions currently pending — identical contract to slack-surface.service.ts's parseDecision. */
function parseDecision(text: string, pending: PendingApprovalRecord[]): Decision | null {
  if (pending.length === 0) return null;
  const idMatch = text.match(/\b(\d{1,4})\b/);
  const id = idMatch ? idMatch[1] : undefined;
  const all = /\b(all|both|everything)\b/i.test(text);
  if (WATCH.test(text)) return { kind: "watch", id };
  if (AFFIRM.test(text)) return { kind: "affirm", id, all };
  if (NEGATE.test(text)) return { kind: "negate", id, all };
  if (id && /^\d{1,4}$/.test(text.trim()) && pending.some((p) => p.id === id)) {
    return { kind: "affirm", id, all: false };
  }
  return null;
}

/**
 * Closes the conversational loop over a Discord DM, mirroring
 * SlackSurfaceService, plus `handleChannelMessage` for guild (non-DM)
 * messages, which is purely a deterministic automation-trigger check — no
 * chat, no AI channel resolution, exact channelId match only.
 *
 * Discord DM chat has no rich-button equivalent needed for MVP: approvals are
 * plain "yes <id>" / "no <id>" text, like Telegram.
 */
@Injectable()
export class DiscordSurfaceService {
  constructor(
    @Inject(GatewayService)
    private readonly gateway: GatewayService,
    @Inject(APPROVAL_STORE)
    private readonly approvals: ApprovalStore,
    @Inject(CONVERSATION_STORE)
    private readonly conversations: ConversationStore,
    @Inject(DiscordRepository)
    private readonly discordRepo: DiscordRepository,
  ) {}

  async handleMessage(event: DiscordSurfaceMessage): Promise<void> {
    const text = event.text.trim();
    if (!text) return;
    const discordKey = event.discordUserId;

    const linkMatch = text.match(LINK_TOKEN);
    if (linkMatch) {
      await this.handleLink(event, discordKey, linkMatch[1]);
      return;
    }

    if (!(await this.isOwner(discordKey))) {
      logger.warn("discord surface message from non-owner ignored", { discordKey });
      return;
    }

    const key = await this.userIdForDiscordKey(discordKey);
    const pending = await this.approvals.list(key);

    if (pending.length > 0 && LIST.test(text)) {
      await this.send(event.channel, this.renderPending(pending));
      return;
    }

    const decision = parseDecision(text, pending);
    if (decision) {
      await this.applyDecision(event.channel, key, decision, pending);
      return;
    }

    await this.runChat(event.channel, text, key);
  }

  /**
   * Guild (non-DM) message routed for automation-trigger matching only. No
   * chat, no reply — a plain forward to ai-core's discordChannelEvent, which
   * filters active flows by exact channelId equality (never AI resolution).
   */
  async handleChannelMessage(input: {
    guildId: string;
    channelId: string;
    messageId: string;
    content: string;
    authorId: string;
    messageUrl?: string;
  }): Promise<void> {
    if (!input.content.trim()) return;
    try {
      await this.gateway.sendToAiCore("connector.discord.channelMessage", input);
    } catch (error) {
      logger.warn("discord channel message forward to ai-core failed", {
        channelId: input.channelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleLink(
    event: DiscordSurfaceMessage,
    discordKey: string,
    token: string,
  ): Promise<void> {
    const record = await this.discordRepo.consumeDiscordLinkToken(token, discordKey);

    if (!record) {
      const existing = await this.discordRepo.findDiscordLinkByKey(discordKey);
      if (existing) {
        await this.send(
          event.channel,
          `You're already linked to ${maskEmail(existing.email ?? existing.userId)}.`,
        );
        return;
      }
      await this.send(
        event.channel,
        "That link token has expired — generate a new one from the dashboard.",
      );
      return;
    }

    const userId = userIdFromEmail(record.email);
    const linked = await this.discordRepo.linkDiscordUser(
      discordKey,
      record.email,
      userId,
      event.channel,
    );

    if (!linked.ok) {
      await this.send(
        event.channel,
        `This Discord account is already linked to ${maskEmail(linked.linkedEmail)}. One Discord identity can only serve one account — unlink it from that account's dashboard first, then try again.`,
      );
      return;
    }

    try {
      await this.gateway.sendToAiCore("connector.save", {
        userId,
        provider: "discord_surface",
        authType: "manual",
        label: "Discord DM",
        secret: {
          discordUserId: event.discordUserId,
          dmChannelId: event.channel,
        },
        metadata: { setup: "discord_link" },
      });
    } catch (error) {
      logger.warn("failed to save discord surface connector record", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await this.send(event.channel, `Linked, ${env.PRINCIPAL_HONORIFIC} — I'll take it from here.`);
  }

  private async runChat(channel: string, message: string, userId: string): Promise<void> {
    const conversationKey = this.conversationKey(channel);
    const placeholderId = await sendDiscordPlaceholder({ channel });

    try {
      const history = await this.conversations.get(conversationKey);
      const res: ChatResponse = await this.gateway.sendChatToAiCore<ChatResponse>({
        userId,
        message,
        history,
      });

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
                .join("; ")}). This one is #${rec.id} — say "yes ${rec.id}".`
            : `\n\nSay "yes" to go ahead, or "no" to cancel.`;
        await this.deliver(channel, placeholderId, `${res.reply}\n\n${res.pendingApproval.preview}${note}`);
        return;
      }
      await this.deliver(channel, placeholderId, res.reply);
    } catch (error) {
      await this.deliverFailure(channel, placeholderId, error);
    }
  }

  private async deliverFailure(
    channel: string,
    placeholderId: string | null,
    error: unknown,
  ): Promise<void> {
    logger.error("discord chat turn failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    await this.deliver(
      channel,
      placeholderId,
      `Sorry, ${env.PRINCIPAL_HONORIFIC} — that took too long or hit an error. Try again?`,
    );
  }

  private async deliver(channel: string, placeholderId: string | null, text: string): Promise<void> {
    if (placeholderId) {
      const updated = await updateDiscordSurfaceMessage({ channel, messageId: placeholderId, text });
      if (updated) return;
    }
    await sendDiscordSurfaceMessage({ channel, text });
  }

  private async runApproved(
    channel: string,
    userId: string,
    pending: PendingApprovalRecord,
  ): Promise<void> {
    if (!(await this.gateway.hasProductAccess(userId))) {
      await this.send(
        channel,
        "Your Rizly trial has ended. Choose a paid plan to continue: https://getrizly.com/dashboard/upgrade",
      );
      return;
    }
    const conversationKey = this.conversationKey(channel);
    await this.approvals.remove(userId, pending.id);
    await appendActionAudit({
      userId,
      event: "approved",
      tool: pending.tool,
      payload: pending.payload,
      approvalId: pending.id,
    }).catch(() => undefined);
    const placeholderId = await sendDiscordPlaceholder({ channel });

    try {
      const history = await this.conversations.get(conversationKey);
      const res: ChatResponse = await this.gateway.sendChatToAiCore<ChatResponse>({
        userId,
        message: "approved",
        approve: true,
        pendingApproval: { id: pending.id, executionId: pending.executionId, tool: pending.tool, payload: pending.payload },
        history,
      });

      const remaining = await this.approvals.list(userId);
      const note =
        remaining.length > 0
          ? `\n\n(${remaining.length} still waiting: ${remaining
              .map((p) => `#${p.id} ${p.label}`)
              .join("; ")}.)`
          : "";

      await this.conversations.append(conversationKey, turn("user", "approved"));
      await this.conversations.append(conversationKey, turn("assistant", res.reply));
      await this.deliver(channel, placeholderId, `${res.reply}${note}`);
    } catch (error) {
      await this.deliverFailure(channel, placeholderId, error);
    }
  }

  private async applyDecision(
    channel: string,
    key: string,
    decision: Decision,
    pending: PendingApprovalRecord[],
  ): Promise<void> {
    if (decision.kind === "watch") {
      const target = this.pickTarget(decision.id, pending, (p) => p.tool === "email_confirm");
      if (!target) return this.askWhich(channel, pending, "watch", decision.id);
      const payload = target.payload as Record<string, unknown>;
      await this.runApproved(channel, key, { ...target, payload: { ...payload, action: "watch" } });
      return;
    }

    if (decision.kind === "affirm") {
      if (decision.all) {
        for (const p of pending) await this.runApproved(channel, key, p);
        return;
      }
      const target = this.pickTarget(decision.id, pending);
      if (!target) return this.askWhich(channel, pending, "approve", decision.id);
      await this.runApproved(channel, key, target);
      return;
    }

    if (decision.all) {
      await this.approvals.clear(key);
      await this.send(channel, `Cleared all ${pending.length}, ${env.PRINCIPAL_HONORIFIC}.`);
      return;
    }
    const target = this.pickTarget(decision.id, pending);
    if (!target) return this.askWhich(channel, pending, "cancel", decision.id);
    await this.rejectOne(channel, key, target);
  }

  private pickTarget(
    id: string | undefined,
    pending: PendingApprovalRecord[],
    filter?: (p: PendingApprovalRecord) => boolean,
  ): PendingApprovalRecord | undefined {
    const pool = filter ? pending.filter(filter) : pending;
    if (id) return pool.find((p) => p.id === id);
    return pool.length === 1 ? pool[0] : undefined;
  }

  private async rejectOne(channel: string, key: string, record: PendingApprovalRecord): Promise<void> {
    await this.approvals.remove(key, record.id);
    await appendActionAudit({
      userId: key,
      event: "rejected",
      tool: record.tool,
      payload: record.payload,
      approvalId: record.id,
    }).catch(() => undefined);
    await this.recordRejection(channel, record);
    await this.send(channel, `Cancelled #${record.id} (${record.label}), ${env.PRINCIPAL_HONORIFIC}.`);
  }

  private async askWhich(
    channel: string,
    pending: PendingApprovalRecord[],
    verb: "approve" | "cancel" | "watch",
    requestedId?: string,
  ): Promise<void> {
    const say = verb === "cancel" ? "no" : "yes";
    const lead = requestedId
      ? `I don't see #${requestedId} waiting, ${env.PRINCIPAL_HONORIFIC}.`
      : `You've got ${pending.length} waiting, ${env.PRINCIPAL_HONORIFIC} — which to ${verb}?`;
    await this.send(
      channel,
      `${lead}\n${this.renderList(pending)}\nSay "${say} <number>"${
        verb === "watch" ? "" : ` or "${say} all"`
      }.`,
    );
  }

  private renderPending(pending: PendingApprovalRecord[]): string {
    return `Pending, ${env.PRINCIPAL_HONORIFIC}:\n${this.renderList(
      pending,
    )}\nSay "yes <number>" to run one, "yes all", or "no <number>".`;
  }

  private renderList(pending: PendingApprovalRecord[]): string {
    return pending.map((p) => `#${p.id} — ${p.label}`).join("\n");
  }

  private async recordRejection(channel: string, pending: PendingApprovalRecord): Promise<void> {
    const conversationKey = this.conversationKey(channel);
    await this.conversations.append(conversationKey, turn("assistant", `Proposed: ${pending.preview}`));
    await this.conversations.append(conversationKey, turn("user", "No, cancel that."));
  }

  /** Namespaced so a Discord channel id can never collide with a Slack/Telegram chat id. */
  private conversationKey(channel: string): string {
    return `discord:${channel}`;
  }

  private send(channel: string, text: string): Promise<boolean> {
    return sendDiscordSurfaceMessage({ channel, text });
  }

  private async isOwner(discordKey: string): Promise<boolean> {
    try {
      return Boolean(await this.discordRepo.findUserIdByDiscordKey(discordKey));
    } catch (error) {
      logger.warn("discord surface owner check failed; denying", {
        discordKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async userIdForDiscordKey(discordKey: string): Promise<string> {
    return (
      (await this.discordRepo.findUserIdByDiscordKey(discordKey).catch(() => null)) ??
      env.DEFAULT_USER_ID
    );
  }
}
