import { BadRequestException, Body, Controller, Get, Headers, Inject, Post, Query } from "@nestjs/common";
import {
  APPROVAL_STORE,
  type ApprovalStore,
} from "./approval-store";
import { AuthRepository } from "./auth/auth.repository";
import { CONVERSATION_STORE, type ConversationStore, type ConversationTurn } from "./conversation-store";
import { GatewayService, upgradeRequiredResult } from "./gateway.service";
import { requireInternalSecret } from "./internal-auth";
import { appendActionAudit, listActionAudit } from "@heyriz/shared/action-audit";

type ChatResponse = { reply: string; error?: string; upgradeRequired?: boolean };

const PROPOSABLE_TOOLS = new Set([
  "send_email",
  "create_calendar_event",
  "reschedule_calendar_event",
  "create_calcom_booking",
  "discord_send",
]);

function turn(role: ConversationTurn["role"], content: string): ConversationTurn {
  return { role, content, timestamp: new Date().toISOString() };
}

/**
 * Surfaces the same pending-approval queue Telegram shows ("yes 2"/"no 1") to
 * the web dashboard, so a principal without Telegram linked can still review
 * and approve/reject proposed actions. Pending actions are keyed by Telegram
 * chatId in Redis (see pending-actions.ts) regardless of which channel created
 * them. They are keyed by userId so Telegram and web operate on the same
 * tenant-scoped queue even when the user has never linked Telegram.
 */
@Controller("api/approvals")
export class ApprovalsController {
  constructor(
    @Inject(APPROVAL_STORE)
    private readonly approvals: ApprovalStore,
    @Inject(CONVERSATION_STORE)
    private readonly conversations: ConversationStore,
    @Inject(AuthRepository)
    private readonly authRepo: AuthRepository,
    @Inject(GatewayService)
    private readonly gateway: GatewayService,
  ) {}

  @Post("propose")
  async propose(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: { userId?: string; tool?: string; payload?: Record<string, unknown>; preview?: string },
  ) {
    this.requireInternal(secret);
    if (!body.userId || !body.tool || !PROPOSABLE_TOOLS.has(body.tool)) {
      throw new BadRequestException("userId and a supported approval-gated tool are required");
    }
    const payload = { ...(body.payload ?? {}) };
    delete payload.approved;
    const record = await this.approvals.add(body.userId, {
      tool: body.tool,
      payload,
      preview: body.preview?.trim() || `Approve ${body.tool.replaceAll("_", " ")}`,
    });
    return { approval: { id: record.id, preview: record.preview } };
  }

  @Get("audit")
  async audit(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId) return { audit: [] };
    return { audit: await listActionAudit(userId) };
  }

  @Get()
  async list(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId) return { error: "userId is required" };

    const approvals = await this.approvals.list(userId);
    return { approvals };
  }

  @Post("decide")
  async decide(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body()
    body: { userId?: string; id?: string; decision?: "approve" | "reject" },
  ) {
    this.requireInternal(secret);
    if (!body.userId || !body.id || !body.decision) {
      return { error: "userId, id, and decision are required" };
    }

    const chatId = await this.authRepo.findTelegramChatIdByUserId(body.userId);
    const conversationKey = chatId ?? body.userId;

    const record = await this.approvals.get(body.userId, body.id);
    if (!record) return { error: "not_found" };

    if (body.decision === "reject") {
      await appendActionAudit({
        userId: body.userId,
        event: "rejected",
        tool: record.tool,
        payload: record.payload,
        approvalId: record.id,
      });
      await this.approvals.remove(body.userId, record.id);
      await this.conversations.append(conversationKey, turn("assistant", `Proposed: ${record.preview}`));
      await this.conversations.append(conversationKey, turn("user", "No, cancel that."));
      return { ok: true, reply: `Cancelled #${record.id} (${record.label}).` };
    }

    if (!(await this.gateway.hasProductAccess(body.userId))) {
      return upgradeRequiredResult();
    }

    await this.approvals.remove(body.userId, record.id);
    await appendActionAudit({
      userId: body.userId,
      event: "approved",
      tool: record.tool,
      payload: record.payload,
      approvalId: record.id,
    });
    const history = await this.conversations.get(conversationKey);
    const res = await this.gateway.sendChatToAiCore<ChatResponse>({
      userId: body.userId,
      message: "approved",
      approve: true,
      pendingApproval: { id: record.id, tool: record.tool, payload: record.payload },
      history,
    });

    await this.conversations.append(conversationKey, turn("user", "approved"));
    await this.conversations.append(conversationKey, turn("assistant", res.reply));
    return { ok: true, reply: res.reply };
  }

  private requireInternal(secret: string | undefined) {
    requireInternalSecret(secret);
  }
}
