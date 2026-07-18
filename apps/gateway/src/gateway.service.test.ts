import { describe, expect, it, vi } from "vitest";
import { GatewayService } from "./gateway.service";

describe("GatewayService paid access gate", () => {
  it("does not call AI Core after trial access ends", async () => {
    const billing = {
      send: vi.fn().mockResolvedValue({
        access: { active: false, state: "free" },
      }),
    };
    const gateway = new GatewayService(billing as never);
    const sendToAiCore = vi
      .spyOn(gateway, "sendToAiCore")
      .mockResolvedValue({ reply: "should not run" });

    const result = await gateway.sendChatToAiCore<{ reply: string }>({
      userId: "user@example.com",
      message: "Hello",
    });

    expect(result).toMatchObject({
      error: "upgrade_required",
      upgradeRequired: true,
    });
    expect(sendToAiCore).not.toHaveBeenCalled();
  });

  it("forwards chat while trial or paid access is active", async () => {
    const billing = {
      send: vi.fn().mockResolvedValue({
        access: { active: true, state: "trialing" },
      }),
    };
    const gateway = new GatewayService(billing as never);
    const sendToAiCore = vi
      .spyOn(gateway, "sendToAiCore")
      .mockResolvedValue({ reply: "active" });

    await expect(
      gateway.sendChatToAiCore<{ reply: string }>({
        userId: "user@example.com",
        message: "Hello",
      }),
    ).resolves.toEqual({ reply: "active" });
    expect(sendToAiCore).toHaveBeenCalledOnce();
  });
});
