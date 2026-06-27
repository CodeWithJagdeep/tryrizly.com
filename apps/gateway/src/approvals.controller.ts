import { Body, Controller, Get, Headers, Inject, Post, Query } from "@nestjs/common";
import {
  APPROVAL_STORE,
  type ApprovalStore,
  type PendingApprovalRecord,
} from "./approval-store";
import { AuthRepository } from "./auth/auth.repository";
import { CONVERSATION_STORE, type ConversationStore, type ConversationTurn } from "./conversation-store";
import { GatewayService } from "./gateway.service";
import { requireInternalSecret } from "./internal-auth";

type ChatResponse = { reply: string };

function turn(role: ConversationTurn["role"], content: string): ConversationTurn {
  return { role, content, timestamp: new Date().toISOString() };
}

/**
 * Surfaces the same pending-approval queue Telegram shows ("yes 2"/"no 1") to
 * the web dashboard, so a principal without Telegram linked can still review
 * and approve/reject proposed actions. Pending actions are keyed by Telegram
 * chatId in Redis (see pending-actions.ts) regardless of which channel created
 * them, so this resolves userId -> chatId first; a user who's never linked
 * Telegram simply has no chat and an empty list.
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

  @Get()
  async list(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    this.requireInternal(secret);
    if (!userId) return { error: "userId is required" };

    const chatId = await this.authRepo.findTelegramChatIdByUserId(userId);
    if (!chatId) return { approvals: [] as PendingApprovalRecord[] };

    const approvals = await this.approvals.list(chatId);
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
    if (!chatId) return { error: "no_linked_chat" };

    const record = await this.approvals.get(chatId, body.id);
    if (!record) return { error: "not_found" };

    if (body.decision === "reject") {
      await this.approvals.remove(chatId, record.id);
      await this.conversations.append(chatId, turn("assistant", `Proposed: ${record.preview}`));
      await this.conversations.append(chatId, turn("user", "No, cancel that."));
      return { ok: true, reply: `Cancelled #${record.id} (${record.label}).` };
    }

    await this.approvals.remove(chatId, record.id);
    const history = await this.conversations.get(chatId);
    const res = await this.gateway.sendToAiCore<ChatResponse>("chat.message", {
      userId: body.userId,
      message: "approved",
      approve: true,
      pendingApproval: { tool: record.tool, payload: record.payload },
      history,
    });

    await this.conversations.append(chatId, turn("user", "approved"));
    await this.conversations.append(chatId, turn("assistant", res.reply));
    return { ok: true, reply: res.reply };
  }

  private requireInternal(secret: string | undefined) {
    requireInternalSecret(secret);
  }
}
