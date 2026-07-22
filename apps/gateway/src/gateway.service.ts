import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ClientProxy, ClientProxyFactory, Transport } from "@nestjs/microservices";
import { firstValueFrom, timeout, TimeoutError } from "rxjs";
import { env } from "@heyriz/shared/env";
import { BillingGatewayService } from "./billing/billing.service";

type ProxyPayload = Record<string, unknown>;

export type UpgradeRequiredResult = {
  error: "upgrade_required";
  upgradeRequired: true;
  reply: string;
};

type BillingStatus = {
  access?: { active?: boolean; state?: string };
};

const UPGRADE_REQUIRED_REPLY =
  "Your Rizly trial has ended. Choose a paid plan to continue using your AI operator: https://getrizly.com/dashboard/upgrade";

export function upgradeRequiredResult(): UpgradeRequiredResult {
  return {
    error: "upgrade_required",
    upgradeRequired: true,
    reply: UPGRADE_REQUIRED_REPLY,
  };
}

// A handler that throws before returning a proper RPC response (e.g. a
// synchronous error in a microservice message handler) can leave this call
// waiting forever with no reply ever coming back — bound it so a backend bug
// surfaces as a fast error instead of an indefinitely "stuck" request.
const AI_CORE_CALL_TIMEOUT_MS = 20_000;

@Injectable()
export class GatewayService implements OnModuleDestroy {
  constructor(private readonly billing: BillingGatewayService) {}
  private readonly aiCoreClient: ClientProxy = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: env.AI_CORE_TCP_HOST,
      port: env.AI_CORE_TCP_PORT,
    },
  });

  async healthCheck() {
    const [aiCore, billing] = await Promise.allSettled([
      this.sendToAiCore<{ ok: boolean }>("health.check", {}),
      this.billing.send<{ ok: boolean }>("billing.health"),
    ]);
    const dependencies = {
      aiCore: aiCore.status === "fulfilled" && aiCore.value.ok,
      billing: billing.status === "fulfilled" && billing.value.ok,
    };
    return {
      ok: dependencies.aiCore && dependencies.billing,
      service: "gateway",
      framework: "nestjs",
      transport: {
        aiCore: {
          transport: "tcp",
          host: env.AI_CORE_TCP_HOST,
          port: env.AI_CORE_TCP_PORT,
        },
        billing: {
          transport: "tcp",
          host: env.BILLING_TCP_HOST,
          port: env.BILLING_TCP_PORT,
        },
      },
      dependencies,
    };
  }

  async sendToAiCore<TResponse>(pattern: string, payload: ProxyPayload) {
    try {
      return await firstValueFrom(
        this.aiCoreClient.send<TResponse>(pattern, payload).pipe(timeout(AI_CORE_CALL_TIMEOUT_MS)),
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new Error(`ai_core_timeout:${pattern}`);
      }
      throw error;
    }
  }

  async hasProductAccess(userId: string): Promise<boolean> {
    const status = await this.billing.send<BillingStatus>("billing.status", { userId });
    return status.access?.active === true;
  }

  async sendChatToAiCore<TResponse>(
    payload: ProxyPayload & { userId: string },
  ): Promise<TResponse | UpgradeRequiredResult> {
    if (!(await this.hasProductAccess(payload.userId))) {
      return upgradeRequiredResult();
    }
    return this.sendToAiCore<TResponse>("chat.message", payload);
  }

  async deleteUserData(payload: { userId: string; email?: string; name?: string }) {
    // Stop billing first so an account can never disappear while a recurring
    // charge remains active. Both downstream operations are idempotent.
    await this.billing.send<{ ok: boolean }>("billing.user.deleteData", payload);
    return this.sendToAiCore<{ ok: boolean }>("user.deleteData", payload);
  }

  async onModuleDestroy() {
    await this.aiCoreClient.close();
  }
}
