import { describe, expect, it } from "vitest";
import { MemoryApprovalStore } from "./approval-store";

describe("MemoryApprovalStore tenant isolation", () => {
  it("keeps identical approval ids isolated by user", async () => {
    const store = new MemoryApprovalStore();
    const owner = await store.add("owner@example.com", {
      tool: "send_email",
      payload: { to: "one@example.com" },
      preview: "Send owner email",
    });
    const other = await store.add("other@example.com", {
      tool: "send_email",
      payload: { to: "two@example.com" },
      preview: "Send other email",
    });

    expect(owner.id).toBe("1");
    expect(other.id).toBe("1");
    expect((await store.get("owner@example.com", "1"))?.payload).toEqual({ to: "one@example.com" });
    expect((await store.get("other@example.com", "1"))?.payload).toEqual({ to: "two@example.com" });

    await store.remove("owner@example.com", "1");
    expect(await store.get("owner@example.com", "1")).toBeUndefined();
    expect(await store.get("other@example.com", "1")).toBeDefined();
  });
});
