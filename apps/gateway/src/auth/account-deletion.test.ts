import { beforeEach, describe, expect, it, vi } from "vitest";

const audit = vi.hoisted(() => ({ deleteActionAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@heyriz/shared/action-audit", () => audit);
const executions = vi.hoisted(() => ({ deleteActionExecutions: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@heyriz/shared/action-execution", () => executions);

import { AuthService } from "./auth.service";

describe("AuthService.deleteAccount", () => {
  const repo = {
    getUser: vi.fn(),
    findTelegramChatIdByUserId: vi.fn(),
    deleteAccountData: vi.fn(),
  };
  const gateway = { deleteUserData: vi.fn() };
  const approvals = { clear: vi.fn() };
  const conversations = { clear: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.getUser.mockResolvedValue({ email: "owner@example.com", name: "Owner" });
    repo.findTelegramChatIdByUserId.mockResolvedValue("12345");
    repo.deleteAccountData.mockResolvedValue(undefined);
    gateway.deleteUserData.mockResolvedValue({ ok: true });
    approvals.clear.mockResolvedValue(undefined);
    conversations.clear.mockResolvedValue(undefined);
  });

  function service() {
    return new AuthService(repo as never, gateway as never, approvals as never, conversations as never);
  }

  it("requires the authenticated email as explicit confirmation", async () => {
    await expect(service().deleteAccount("owner@example.com", "other@example.com")).rejects.toThrow(
      "account_deletion_confirmation_mismatch",
    );
    expect(gateway.deleteUserData).not.toHaveBeenCalled();
    expect(repo.deleteAccountData).not.toHaveBeenCalled();
  });

  it("deletes downstream and transient data before removing the login identity", async () => {
    const order: string[] = [];
    gateway.deleteUserData.mockImplementation(async () => order.push("downstream"));
    approvals.clear.mockImplementation(async () => order.push("approvals"));
    conversations.clear.mockImplementation(async () => order.push("conversations"));
    repo.deleteAccountData.mockImplementation(async () => order.push("identity"));

    await expect(service().deleteAccount("OWNER@example.com", "owner@example.com")).resolves.toEqual({ ok: true });

    expect(gateway.deleteUserData).toHaveBeenCalledWith({
      userId: "owner@example.com",
      email: "owner@example.com",
      name: "Owner",
    });
    expect(approvals.clear).toHaveBeenCalledWith("owner@example.com");
    expect(approvals.clear).toHaveBeenCalledWith("12345");
    expect(audit.deleteActionAudit).toHaveBeenCalledWith("owner@example.com");
    expect(executions.deleteActionExecutions).toHaveBeenCalledWith("owner@example.com");
    expect(order.at(-1)).toBe("identity");
  });

  it("keeps the identity when downstream deletion fails so the user can retry", async () => {
    gateway.deleteUserData.mockRejectedValue(new Error("billing_unavailable"));
    await expect(service().deleteAccount("owner@example.com", "owner@example.com")).rejects.toThrow(
      "billing_unavailable",
    );
    expect(repo.deleteAccountData).not.toHaveBeenCalled();
  });
});
