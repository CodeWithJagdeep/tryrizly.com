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
  approvalActionBlocks,
  sendSlackPlaceholder,
  sendSlackSurfaceMessage,
  updateSlackSurfaceMessage,
  type SlackBlock,
} from "@heyriz/shared/slack-surface";
import { appendActionAudit } from "@heyriz/shared/action-audit";

// Slack has no /start deep link; the dashboard tells the principal to DM the
// bot "link <token>". "/start <token>" is accepted too for muscle memory.
const LINK_TOKEN = /^(?:link|\/start)\s+(\S+)/i;

async function sendWelcomeEmail(email: string, name: string | undefined): Promise<void> {
  const greeting = name ? `Hi ${name}` : "Hi there";
  await sendEmail({
    to: email,
    subject: "Welcome to Rizly — you're all set up",
    text: `${greeting},\n\nYour Rizly operator is live. From now on, drafts, approvals, and your daily brief will land right here in your Slack DM — nothing sends without your say-so.\n\nReply there anytime with a question about your inbox, calendar, or revenue.\n\n— The Rizly team`,
    html: `<p>${greeting},</p><p>Your Rizly operator is live. From now on, drafts, approvals, and your daily brief will land right here in your Slack DM — nothing sends without your say-so.</p><p>Reply there anytime with a question about your inbox, calendar, or revenue.</p><p>— The Rizly team</p>`,
  });
}

/** A DM to the surface bot, as normalized by SlackSocketService. */
export type SlackSurfaceMessage = {
  teamId: string;
  slackUserId: string;
  /** The bot↔user DM channel id. */
  channel: string;
  text: string;
};

/** An approve/reject Block Kit button press, as normalized by SlackSocketService. */
export type SlackSurfaceAction = {
  teamId: string;
  slackUserId: string;
  channel: string;
  /** `approve:<id>` / `reject:<id>` (legacy buttons may omit the id). */
  value: string;
};

/** Where replies go: the DM channel plus the workspace's bot token (undefined = home-workspace env token). */
type SendTarget = { channel: string; botToken?: string };

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

// Shown to whoever tries to link an already-claimed Slack identity — enough to
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
 * Closes the conversational loop over a Slack DM, mirroring TelegramService.
 * Inbound events route to the ai-core agent; when the agent proposes an
 * approval-gated action we hold the proposal (per user, with TTL, in Redis)
 * and a follow-up "yes" — or the Block Kit button — re-invokes chat with
 * approve:true so the gated tool actually runs.
 */
@Injectable()
export class SlackSurfaceService {
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

  async handleMessage(event: SlackSurfaceMessage): Promise<void> {
    const text = event.text.trim();
    if (!text) return;
    const slackKey = this.slackKey(event);
    const dst = await this.sendTarget(event.teamId, event.channel);

    const linkMatch = text.match(LINK_TOKEN);
    if (linkMatch) {
      await this.handleLink(event, slackKey, dst, linkMatch[1]);
      return;
    }

    if (!(await this.isOwner(slackKey))) {
      logger.warn("slack surface message from non-owner ignored", { slackKey });
      return;
    }

    const key = await this.userIdForSlackKey(slackKey);
    const pending = await this.approvals.list(key);

    if (pending.length > 0 && LIST.test(text)) {
      await this.send(dst, this.renderPending(pending));
      return;
    }

    const decision = parseDecision(text, pending);
    if (decision) {
      await this.applyDecision(dst, key, decision, pending);
      return;
    }

    // A fresh instruction. We deliberately do NOT clear the pending proposals —
    // each is addressable by id and waits for its own yes/no, so a new request
    // never silently drops an un-approved action.
    await this.runChat(dst, text, key);
  }

  async handleAction(action: SlackSurfaceAction): Promise<void> {
    const slackKey = this.slackKey(action);
    if (!(await this.isOwner(slackKey))) return;

    const dst = await this.sendTarget(action.teamId, action.channel);
    const key = await this.userIdForSlackKey(slackKey);
    const [verb, id] = action.value.split(":");

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
      await this.send(
        dst,
        `That request is no longer pending, ${env.PRINCIPAL_HONORIFIC} — say "list" to see what's waiting.`,
      );
      return;
    }

    if (verb === "approve") {
      await this.runApproved(dst, key, record);
    } else if (verb === "reject") {
      await this.rejectOne(dst, key, record);
    }
  }

  private async handleLink(
    event: SlackSurfaceMessage,
    slackKey: string,
    dst: SendTarget,
    token: string,
  ): Promise<void> {
    const record = await this.authRepo.consumeSlackLinkToken(token, slackKey);

    if (!record) {
      const existing = await this.authRepo.findSlackLinkByKey(slackKey);
      if (existing) {
        await this.send(
          dst,
          `You're already linked to ${maskEmail(existing.email ?? existing.userId)}.`,
        );
        return;
      }
      await this.send(
        dst,
        "That link token has expired — generate a new one from the dashboard.",
      );
      return;
    }

    const userId = userIdFromEmail(record.email);
    const userBeforeLink = await this.authRepo.getUser(record.email);
    const isFirstOnboarding = !userBeforeLink?.onboarding?.completedAt;
    const linked = await this.authRepo.linkSlackUser(
      slackKey,
      record.email,
      userId,
      event.channel,
    );

    if (!linked.ok) {
      await this.send(
        dst,
        `This Slack account is already linked to ${maskEmail(linked.linkedEmail)}. One Slack identity can only serve one account — unlink it from that account's dashboard first, then try again.`,
      );
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
        provider: "slack_surface",
        authType: "manual",
        label: "Slack DM",
        secret: {
          teamId: event.teamId,
          slackUserId: event.slackUserId,
          dmChannelId: event.channel,
        },
        metadata: { setup: "slack_link" },
      });
    } catch (error) {
      logger.warn("failed to save slack surface connector record", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await this.send(
      dst,
      `Linked, ${env.PRINCIPAL_HONORIFIC} — I'll take it from here.`,
    );
  }

  private async runChat(dst: SendTarget, message: string, userId: string): Promise<void> {
    const conversationKey = this.conversationKey(dst.channel);
    const placeholderTs = await sendSlackPlaceholder({
      channel: dst.channel,
      botToken: dst.botToken,
    });

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
                .join("; ")}). This one is #${rec.id} — say "yes ${rec.id}" or use the buttons.`
            : "";
        const full = `${res.reply}\n\n${res.pendingApproval.preview}${note}`;
        await this.deliver(dst, placeholderTs, full, approvalActionBlocks(full, rec.id));
        return;
      }
      await this.deliver(dst, placeholderTs, res.reply);
    } catch (error) {
      await this.deliverFailure(dst, placeholderTs, error);
    }
  }

  /** Replaces a stuck "Thinking…" placeholder (or sends fresh) with a plain failure notice — never leave the principal staring at a placeholder that will never resolve. */
  private async deliverFailure(
    dst: SendTarget,
    placeholderTs: string | null,
    error: unknown,
  ): Promise<void> {
    logger.error("slack chat turn failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    await this.deliver(
      dst,
      placeholderTs,
      `Sorry, ${env.PRINCIPAL_HONORIFIC} — that took too long or hit an error. Try again?`,
    );
  }

  /** Replaces the "Thinking…" placeholder with the real reply, or sends fresh if there was no placeholder. */
  private async deliver(
    dst: SendTarget,
    placeholderTs: string | null,
    text: string,
    blocks?: SlackBlock[],
  ): Promise<void> {
    if (placeholderTs) {
      const updated = await updateSlackSurfaceMessage({
        channel: dst.channel,
        ts: placeholderTs,
        botToken: dst.botToken,
        text,
        blocks,
      });
      if (updated) return;
    }
    await sendSlackSurfaceMessage({ channel: dst.channel, botToken: dst.botToken, text, blocks });
  }

  private async runApproved(
    dst: SendTarget,
    userId: string,
    pending: PendingApprovalRecord,
  ): Promise<void> {
    if (!(await this.gateway.hasProductAccess(userId))) {
      await this.send(
        dst,
        "Your Rizly trial has ended. Choose a paid plan to continue: https://getrizly.com/dashboard/upgrade",
      );
      return;
    }
    const conversationKey = this.conversationKey(dst.channel);
    await this.approvals.remove(userId, pending.id);
    await appendActionAudit({
      userId,
      event: "approved",
      tool: pending.tool,
      payload: pending.payload,
      approvalId: pending.id,
    }).catch(() => undefined);
    const placeholderTs = await sendSlackPlaceholder({
      channel: dst.channel,
      botToken: dst.botToken,
    });

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
      await this.deliver(dst, placeholderTs, `${res.reply}${note}`);
    } catch (error) {
      await this.deliverFailure(dst, placeholderTs, error);
    }
  }

  /** Apply a yes/no/watch decision against the pending queue. */
  private async applyDecision(
    dst: SendTarget,
    key: string,
    decision: Decision,
    pending: PendingApprovalRecord[],
  ): Promise<void> {
    if (decision.kind === "watch") {
      const target = this.pickTarget(decision.id, pending, (p) => p.tool === "email_confirm");
      if (!target) return this.askWhich(dst, pending, "watch", decision.id);
      const payload = target.payload as Record<string, unknown>;
      await this.runApproved(dst, key, {
        ...target,
        payload: { ...payload, action: "watch" },
      });
      return;
    }

    if (decision.kind === "affirm") {
      if (decision.all) {
        // Oldest first; runApproved removes each as it goes.
        for (const p of pending) await this.runApproved(dst, key, p);
        return;
      }
      const target = this.pickTarget(decision.id, pending);
      if (!target) return this.askWhich(dst, pending, "approve", decision.id);
      await this.runApproved(dst, key, target);
      return;
    }

    // negate
    if (decision.all) {
      await this.approvals.clear(key);
      await this.send(dst, `Cleared all ${pending.length}, ${env.PRINCIPAL_HONORIFIC}.`);
      return;
    }
    const target = this.pickTarget(decision.id, pending);
    if (!target) return this.askWhich(dst, pending, "cancel", decision.id);
    await this.rejectOne(dst, key, target);
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
    dst: SendTarget,
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
    await this.recordRejection(dst.channel, record);
    await this.send(
      dst,
      `Cancelled #${record.id} (${record.label}), ${env.PRINCIPAL_HONORIFIC}.`,
    );
  }

  private async askWhich(
    dst: SendTarget,
    pending: PendingApprovalRecord[],
    verb: "approve" | "cancel" | "watch",
    requestedId?: string,
  ): Promise<void> {
    const say = verb === "cancel" ? "no" : "yes";
    const lead = requestedId
      ? `I don't see #${requestedId} waiting, ${env.PRINCIPAL_HONORIFIC}.`
      : `You've got ${pending.length} waiting, ${env.PRINCIPAL_HONORIFIC} — which to ${verb}?`;
    await this.send(
      dst,
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

  private slackKey(source: { teamId: string; slackUserId: string }): string {
    return `${source.teamId}:${source.slackUserId}`;
  }

  /** Namespaced so a Slack channel id can never collide with a Telegram chat id. */
  private conversationKey(channel: string): string {
    return `slack:${channel}`;
  }

  private send(dst: SendTarget, text: string): Promise<boolean> {
    return sendSlackSurfaceMessage({ channel: dst.channel, botToken: dst.botToken, text });
  }

  /**
   * Resolve where replies go: OAuth-installed workspaces have their bot token
   * in Mongo; the home workspace (manual install) falls through to the env
   * token inside sendSlackSurfaceMessage.
   */
  private async sendTarget(teamId: string, channel: string): Promise<SendTarget> {
    const botToken =
      (await this.authRepo.findSlackBotTokenByTeam(teamId).catch(() => null)) ?? undefined;
    return { channel, botToken };
  }

  private async isOwner(slackKey: string): Promise<boolean> {
    // Fail closed. A DB error must not promote an arbitrary Slack user to
    // owner, and "nobody linked yet" is not a licence to act for everyone —
    // the only way in is an explicit "link <token>" (handled before this gate).
    try {
      return Boolean(await this.authRepo.findUserIdBySlackKey(slackKey));
    } catch (error) {
      logger.warn("slack surface owner check failed; denying", {
        slackKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async userIdForSlackKey(slackKey: string): Promise<string> {
    return (
      (await this.authRepo.findUserIdBySlackKey(slackKey).catch(() => null)) ??
      env.DEFAULT_USER_ID
    );
  }
}
