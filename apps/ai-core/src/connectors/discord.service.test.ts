import { afterEach, describe, expect, it, vi } from "vitest";
import { requireDiscordWebhookUrl } from "./discord.service";

describe("requireDiscordWebhookUrl", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("accepts official HTTPS webhook URLs", () => {
    expect(requireDiscordWebhookUrl("https://discord.com/api/webhooks/123456/token_value"))
      .toBe("https://discord.com/api/webhooks/123456/token_value");
  });

  it.each([
    "http://discord.com/api/webhooks/123/token",
    "https://example.com/api/webhooks/123/token",
    "https://discord.com/api/users/@me",
    "not-a-url",
  ])("rejects unsafe webhook URL %s", (value) => {
    expect(() => requireDiscordWebhookUrl(value)).toThrow("discord_invalid_webhook");
  });

  it("reads a configured bot channel and returns source links", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("/messages")) {
          return Response.json([
            {
              id: "123456789012345679",
              content: "Launch announcement is live",
              timestamp: "2026-07-18T10:00:00.000Z",
              author: { global_name: "Asha", username: "asha" },
            },
          ]);
        }
        return Response.json({ name: "announcements", guild_id: "123456789012345670" });
      }),
    );

    const messages = await new (await import("./discord.service")).DiscordService().getChannelMessages({
      botToken: "bot-token",
      channelId: "123456789012345678",
    });
    expect(messages[0]).toMatchObject({
      author: "Asha",
      channelName: "announcements",
      url: "https://discord.com/channels/123456789012345670/123456789012345678/123456789012345679",
    });
  });
});
