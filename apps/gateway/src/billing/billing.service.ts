import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ClientProxy, ClientProxyFactory, Transport } from "@nestjs/microservices";
import { firstValueFrom, timeout } from "rxjs";
import { env } from "@heyriz/shared/env";

type BillingPayload = Record<string, unknown>;

@Injectable()
export class BillingGatewayService implements OnModuleDestroy {
  private readonly billingClient: ClientProxy = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: env.BILLING_TCP_HOST,
      port: env.BILLING_TCP_PORT,
    },
  });

  send<TResponse>(pattern: string, payload: BillingPayload = {}) {
    return firstValueFrom(this.billingClient.send<TResponse>(pattern, payload).pipe(timeout(20_000)));
  }

  async onModuleDestroy() {
    await this.billingClient.close();
  }
}
