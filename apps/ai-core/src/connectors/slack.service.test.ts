import { afterEach, describe, expect, it, vi } from "vitest";
import { SlackService } from "./slack.service";

describe("SlackService", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("enriches channel history with author names, resolved mentions, and permalinks", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const method = url.pathname.split("/").pop();
      if (method === "conversations.history") {
        return Response.json({
          ok: true,
          messages: [{ ts: "1720000000.000100", user: "U1", text: "Waiting on <@U2> for approval" }],
        });
      }
      if (method === "users.info") {
        const userId = url.searchParams.get("user");
        return Response.json({
          ok: true,
          user: { profile: { display_name: userId === "U1" ? "Asha" : "Naman" } },
        });
      }
      if (method === "chat.getPermalink") {
        return Response.json({ ok: true, permalink: "https://workspace.slack.com/archives/C1/p1720000000000100" });
      }
      return Response.json({ ok: false, error: "unexpected_method" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const messages = await new SlackService().getChannelHistory({ botToken: "xoxb-test" }, "C1", 10);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      userName: "Asha",
      text: "Waiting on @Naman for approval",
      permalink: "https://workspace.slack.com/archives/C1/p1720000000000100",
    });
  });

  it("lists only channels the bot has joined", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          channels: [
            { id: "C1", name: "sales", is_member: true },
            { id: "C2", name: "private", is_private: true },
            { id: "C3", name: "unjoined", is_member: false },
          ],
        }),
      ),
    );
    await expect(new SlackService().listChannels({ botToken: "xoxb-test" })).resolves.toEqual([
      { id: "C1", name: "sales" },
      { id: "C2", name: "private" },
    ]);
  });
});
