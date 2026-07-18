import { describe, expect, it, vi } from "vitest";

vi.mock("@heyriz/shared/action-audit", () => ({
  appendActionAudit: vi.fn().mockResolvedValue("audit-id"),
}));
const execution = vi.hoisted(() => ({
  claimActionExecution: vi.fn(),
  completeActionExecution: vi.fn().mockResolvedValue(undefined),
  markActionExecutionUnknown: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@heyriz/shared/action-execution", () => execution);
import { ToolRegistryService } from "./tool-registry.service";
import type { HeyRizTool } from "./tool.types";
import type { HeyRizRuntimeContext } from "../context/context.types";

const context: HeyRizRuntimeContext = {
  userId: "owner@example.com",
  source: "telegram",
  structured: { activeDeals: [], preferences: [], pendingStates: [] },
  semantic: [],
  live: {
    connected: false,
    calendarConnected: false,
    inboxConnected: false,
    calendarStatus: "not_connected",
    inboxStatus: "not_connected",
    checkedAt: new Date(0).toISOString(),
    schedule: [],
    unread: [],
  },
  honorific: "boss",
  timezone: "UTC",
  timezoneConfirmed: true,
  connectedDataSources: [],
};

describe("ToolRegistryService approval boundary", () => {
  it("does not trust an approved flag embedded in a direct payload", async () => {
    const execute = vi.fn(async () => ({
      tool: "external_write",
      status: "ok" as const,
      message: "executed",
    }));
    const tool: HeyRizTool<Record<string, unknown>> = {
      name: "external_write",
      category: "business",
      description: "test external write",
      approvalRequired: true,
      sensitiveDataPolicy: "none",
      execute,
    };
    const registry = Object.create(ToolRegistryService.prototype) as ToolRegistryService;
    Object.defineProperty(registry, "tools", { value: [tool] });

    const blocked = await registry.execute({
      name: tool.name,
      userId: context.userId,
      payload: { approved: true },
      context,
    });
    expect(blocked.status).toBe("pending_approval");
    expect(execute).not.toHaveBeenCalled();

    const allowed = await registry.execute({
      name: tool.name,
      userId: context.userId,
      payload: { approved: true },
      context,
      approvalGranted: true,
    });
    expect(allowed.status).toBe("ok");
    expect(execute).toHaveBeenCalledOnce();
  });

  it("returns a cached approved result instead of executing a duplicate", async () => {
    const execute = vi.fn();
    const cached = { tool: "external_write", status: "ok" as const, message: "already sent" };
    execution.claimActionExecution.mockResolvedValueOnce({ state: "completed", result: cached });
    const tool: HeyRizTool<Record<string, unknown>> = {
      name: "external_write",
      category: "business",
      description: "test external write",
      approvalRequired: true,
      sensitiveDataPolicy: "none",
      execute,
    };
    const registry = Object.create(ToolRegistryService.prototype) as ToolRegistryService;
    Object.defineProperty(registry, "tools", { value: [tool] });

    await expect(
      registry.execute({
        name: tool.name,
        userId: context.userId,
        payload: { content: "hello", approved: true },
        context,
        approvalGranted: true,
        executionId: "approval-1",
      }),
    ).resolves.toEqual(cached);
    expect(execute).not.toHaveBeenCalled();
  });
});
