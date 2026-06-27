import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ClientProxy, ClientProxyFactory, Transport } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import { env } from "@heyriz/shared/env";

type ProxyPayload = Record<string, unknown>;

@Injectable()
export class GatewayService implements OnModuleDestroy {
  private readonly aiCoreClient: ClientProxy = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: env.AI_CORE_TCP_HOST,
      port: env.AI_CORE_TCP_PORT,
    },
  });

  healthCheck() {
    return {
      ok: true,
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
    };
  }

  sendToAiCore<TResponse>(pattern: string, payload: ProxyPayload) {
    return firstValueFrom(this.aiCoreClient.send<TResponse>(pattern, payload));
  }

  async onModuleDestroy() {
    await this.aiCoreClient.close();
  }
}
