import { Injectable } from "@nestjs/common";

export type DiscordSecret = { webhookUrl: string };

@Injectable()
export class DiscordService {
  /** Posts a message via an incoming webhook — the only write Discord permits without a full bot install. */
  async postMessage(secret: DiscordSecret, content: string): Promise<void> {
    const res = await fetch(secret.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 404) {
        throw new Error("discord_invalid_webhook");
      }
      throw new Error(`discord_api_${res.status}`);
    }
  }
}
