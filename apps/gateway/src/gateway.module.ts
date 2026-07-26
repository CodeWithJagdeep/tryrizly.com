import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { APPROVAL_STORE, RedisApprovalStore } from "./approval-store";
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
import { DiscordRepository } from "./discord.repository";
import { DiscordSocketService } from "./discord-socket.service";
import { DiscordSurfaceController } from "./discord-surface.controller";
import { DiscordSurfaceService } from "./discord-surface.service";
import { GatewayController } from "./gateway.controller";
import { GatewayService } from "./gateway.service";
import { GmailPushAuthService } from "./gmail-push-auth.service";
import { NotionWebhookAuthService } from "./notion-webhook-auth.service";
import { NotionWebhookRepository } from "./notion-webhook.repository";
import { ShopifyWebhookAuthService } from "./shopify-webhook-auth.service";
import { CalendlyWebhookAuthService } from "./calendly-webhook-auth.service";
import { TypeformWebhookAuthService } from "./typeform-webhook-auth.service";
import { LemonSqueezyWebhookAuthService } from "./lemonsqueezy-webhook-auth.service";
import { DropboxWebhookAuthService } from "./dropbox-webhook-auth.service";
import { FigmaWebhookAuthService } from "./figma-webhook-auth.service";
import { QuickBooksWebhookAuthService } from "./quickbooks-webhook-auth.service";
import { XeroWebhookAuthService } from "./xero-webhook-auth.service";
import { WiseWebhookAuthService } from "./wise-webhook-auth.service";
import { DeelWebhookAuthService } from "./deel-webhook-auth.service";
import { BoxWebhookAuthService } from "./box-webhook-auth.service";
import { StripeWebhookAuthService } from "./stripe-webhook-auth.service";
import { RazorpayWebhookAuthService } from "./razorpay-webhook-auth.service";
import { PayPalWebhookAuthService } from "./paypal-webhook-auth.service";
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
    DiscordSurfaceController,
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
    GmailPushAuthService,
    NotionWebhookAuthService,
    NotionWebhookRepository,
    ShopifyWebhookAuthService,
    CalendlyWebhookAuthService,
    TypeformWebhookAuthService,
    LemonSqueezyWebhookAuthService,
    DropboxWebhookAuthService,
    FigmaWebhookAuthService,
    QuickBooksWebhookAuthService,
    XeroWebhookAuthService,
    WiseWebhookAuthService,
    DeelWebhookAuthService,
    BoxWebhookAuthService,
    StripeWebhookAuthService,
    RazorpayWebhookAuthService,
    PayPalWebhookAuthService,
    RedisThrottlerStorage,
    TelegramService,
    TelegramPollerService,
    SlackSurfaceService,
    SlackSocketService,
    DiscordRepository,
    DiscordSurfaceService,
    DiscordSocketService,
    { provide: APPROVAL_STORE, useClass: RedisApprovalStore },
    { provide: CONVERSATION_STORE, useClass: RedisConversationStore },
  ],
})
export class GatewayModule {}
