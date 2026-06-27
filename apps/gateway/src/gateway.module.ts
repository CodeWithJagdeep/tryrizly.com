import { Module } from "@nestjs/common";
import {
  APPROVAL_STORE,
  RedisApprovalStore,
} from "./approval-store";
import { ApprovalsController } from "./approvals.controller";
import { AuthController } from "./auth/auth.controller";
import { AuthRepository } from "./auth/auth.repository";
import { AuthService } from "./auth/auth.service";
import {
  CONVERSATION_STORE,
  RedisConversationStore,
} from "./conversation-store";
import { BillingController } from "./billing/billing.controller";
import { BillingGatewayService } from "./billing/billing.service";
import { GatewayController } from "./gateway.controller";
import { GatewayService } from "./gateway.service";
import { TelegramPollerService } from "./telegram-poller.service";
import { TelegramService } from "./telegram.service";

@Module({
  controllers: [GatewayController, AuthController, BillingController, ApprovalsController],
  providers: [
    AuthRepository,
    AuthService,
    BillingGatewayService,
    GatewayService,
    TelegramService,
    TelegramPollerService,
    { provide: APPROVAL_STORE, useClass: RedisApprovalStore },
    { provide: CONVERSATION_STORE, useClass: RedisConversationStore },
  ],
})
export class GatewayModule {}
