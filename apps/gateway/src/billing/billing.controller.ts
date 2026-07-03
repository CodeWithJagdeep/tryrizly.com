import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { BillingGatewayService } from "./billing.service";
import { requireInternalSecret } from "../internal-auth";

type RawRequest = {
  rawBody?: Buffer;
};

type BillingPayload = Record<string, unknown>;

@Controller("api/billing")
export class BillingController {
  constructor(private readonly billingService: BillingGatewayService) {}

  @Get("plans")
  plans(@Headers("x-heyriz-internal-secret") secret: string | undefined) {
    this.requireInternal(secret);
    return this.billingService.send("billing.plans");
  }

  @Get("status")
  status(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string,
    @Query("email") email?: string,
    @Query("name") name?: string,
  ) {
    this.requireInternal(secret);
    return this.billingService.send("billing.status", { userId, email, name });
  }

  @Post("trial/start")
  startTrial(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: BillingPayload,
  ) {
    this.requireInternal(secret);
    return this.billingService.send("billing.trial.start", body);
  }

  @Post("checkout/subscription")
  createSubscriptionCheckout(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: BillingPayload,
  ) {
    this.requireInternal(secret);
    return this.billingService.send("billing.checkout.subscription", body);
  }

  @Post("checkout/purchase")
  createPurchaseCheckout(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: BillingPayload,
  ) {
    this.requireInternal(secret);
    return this.billingService.send("billing.checkout.purchase", body);
  }

  @Post("subscription/cancel")
  cancelSubscription(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Body() body: BillingPayload,
  ) {
    this.requireInternal(secret);
    return this.billingService.send("billing.subscription.cancel", body);
  }

  @Post("sweep")
  runSweep(@Headers("x-heyriz-internal-secret") secret: string | undefined) {
    this.requireInternal(secret);
    return this.billingService.send("billing.sweep");
  }

  @Post("webhooks/razorpay")
  @HttpCode(200)
  razorpayWebhook(
    @Headers("x-razorpay-signature") signature: string | undefined,
    @Headers("x-razorpay-event-id") eventId: string | undefined,
    @Req() request: RawRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.billingService.send("billing.webhook.razorpay", {
      provider: "razorpay",
      eventId,
      signature,
      rawBody: request.rawBody?.toString("utf8") ?? JSON.stringify(body),
      payload: body,
    });
  }

  private requireInternal(secret: string | undefined) {
    requireInternalSecret(secret);
  }
}
