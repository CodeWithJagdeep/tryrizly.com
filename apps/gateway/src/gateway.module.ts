import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import {
  APPROVAL_STORE,
  RedisApprovalStore,
} from "./approval-store";
import { ApprovalsController } from "./approvals.controller";
import { AuthController } from "./auth/auth.controller";
import { AuthRepository } from "./auth/auth.repository";
import { AuthService } from "./auth/auth.service";
import { EmailThrottlerGuard } from "./auth/email-throttler.guard";
import {
  CONVERSATION_STORE,
  RedisConversationStore,
} from "./conversation-store";
import { BillingController } from "./billing/billing.controller";
import { BillingGatewayService } from "./billing/billing.service";
import { AutomationRepository } from "./automations/automation.repository";
import { AutomationsController } from "./automations/automations.controller";
import { AutomationsService } from "./automations/automations.service";
import { GatewayController } from "./gateway.controller";
import { GatewayService } from "./gateway.service";
import { RedisThrottlerStorage } from "./throttler-redis.storage";
import { SlackSocketService } from "./slack-socket.service";
import { SlackSurfaceController } from "./slack-surface.controller";
import { SlackSurfaceService } from "./slack-surface.service";
import { TelegramPollerService } from "./telegram-poller.service";
import { TelegramService } from "./telegram.service";

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 20 }],
      storage: new RedisThrottlerStorage(),
    }),
  ],
  controllers: [
    GatewayController,
    AuthController,
    BillingController,
    ApprovalsController,
    SlackSurfaceController,
    AutomationsController,
  ],
  providers: [
    AuthRepository,
    AuthService,
    BillingGatewayService,
    AutomationRepository,
    AutomationsService,
    EmailThrottlerGuard,
    GatewayService,
    RedisThrottlerStorage,
    TelegramService,
    TelegramPollerService,
    SlackSurfaceService,
    SlackSocketService,
    { provide: APPROVAL_STORE, useClass: RedisApprovalStore },
    { provide: CONVERSATION_STORE, useClass: RedisConversationStore },
  ],
})
export class GatewayModule {}
