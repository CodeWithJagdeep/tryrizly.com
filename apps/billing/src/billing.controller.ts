import { Controller } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";
import { BillingService } from "./billing.service";
import type {
  BillingCancelInput,
  BillingCheckoutInput,
  BillingCustomerInput,
  BillingTrialInput,
  BillingWebhookInput,
} from "./types";

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @MessagePattern("billing.health")
  healthCheck() {
    return this.billingService.healthCheck();
  }

  @MessagePattern("billing.plans")
  plans() {
    return this.billingService.plans();
  }

  @MessagePattern("billing.status")
  status(payload: BillingCustomerInput) {
    return this.billingService.status(payload);
  }

  @MessagePattern("billing.trial.start")
  startTrial(payload: BillingTrialInput) {
    return this.billingService.startTrial(payload);
  }

  @MessagePattern("billing.checkout.subscription")
  createSubscriptionCheckout(payload: BillingCheckoutInput) {
    return this.billingService.createSubscriptionCheckout(payload);
  }

  @MessagePattern("billing.checkout.purchase")
  createPurchaseCheckout(payload: BillingCheckoutInput) {
    return this.billingService.createPurchaseCheckout(payload);
  }

  @MessagePattern("billing.subscription.cancel")
  cancelSubscription(payload: BillingCancelInput) {
    return this.billingService.cancelSubscription(payload);
  }

  @MessagePattern("billing.sweep")
  runBillingSweep() {
    return this.billingService.runBillingSweep();
  }

  @MessagePattern("billing.webhook.razorpay")
  handleRazorpayWebhook(payload: BillingWebhookInput) {
    return this.billingService.handleRazorpayWebhook(payload);
  }
}
