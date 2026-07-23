import { describe, expect, it, vi } from "vitest";
import { LlmRouterService } from "./llm-router.service";
import type { LlmProvider } from "./llm.types";

function routerWithResponse(response?: string) {
  const complete = vi.fn(async () => ({
    content:
      response ??
      '{"priority":"MEDIUM","category":"useful_update","requiresAction":false,"consequenceIfIgnored":"none","confidence":"medium","reason":"useful update"}',
  }));
  const grok: LlmProvider = {
    name: "grok",
    isConfigured: () => response !== undefined,
    complete,
  };
  const unavailable = (name: string): LlmProvider => ({
    name,
    isConfigured: () => false,
    complete: vi.fn(),
  });
  const usageLedger = { record: vi.fn(async () => undefined) };

  return {
    complete,
    router: new LlmRouterService(
      grok as never,
      unavailable("openai") as never,
      unavailable("anthropic") as never,
      usageLedger as never,
    ),
  };
}

describe("LlmRouterService classifyPriority", () => {
  it("short-circuits obvious bulk mail before calling the model", async () => {
    const { router, complete } = routerWithResponse(
      '{"priority":"HIGH","reason":"deadline today"}',
    );

    const result = await router.classifyPriority({
      from: "Neha <neha@updates.cleartax.example>",
      subject: "ITR filing deadline",
      body: "File today. Unsubscribe or manage preferences.",
    });

    expect(result).toMatchObject({
      priority: "LOW",
      source: "rules",
      category: "bulk_noise",
      requiresAction: false,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("short-circuits security threats as HIGH before calling the model", async () => {
    const { router, complete } = routerWithResponse(
      '{"priority":"LOW","reason":"automated"}',
    );

    const result = await router.classifyPriority({
      from: "Google <no-reply@accounts.google.com>",
      subject: "Security alert",
      snippet: "A new sign-in was detected.",
    });

    expect(result).toMatchObject({
      priority: "HIGH",
      source: "rules",
      category: "critical_action",
      requiresAction: true,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("caps unsupported model HIGH labels instead of trusting them blindly", async () => {
    const { router } = routerWithResponse(
      '{"priority":"HIGH","category":"useful_update","requiresAction":false,"consequenceIfIgnored":"none","confidence":"high","reason":"sounds important"}',
    );

    const result = await router.classifyPriority({
      from: "Priya <priya@example.com>",
      subject: "A quick update",
      snippet: "Sharing the notes from last week.",
    });

    expect(result).toMatchObject({
      priority: "MEDIUM",
      source: "llm",
      reason: "No concrete action with serious consequence if missed.",
    });
  });

  it("downgrades automated MEDIUM mail without a personal action", async () => {
    const { router } = routerWithResponse(
      '{"priority":"MEDIUM","category":"useful_update","requiresAction":false,"consequenceIfIgnored":"none","confidence":"medium","reason":"may be useful"}',
    );

    const result = await router.classifyPriority({
      from: "Vendor <system@vendor.example>",
      subject: "Monthly usage update",
      snippet: "Your usage was unchanged this month.",
    });

    expect(result).toMatchObject({
      priority: "LOW",
      source: "llm",
      category: "useful_update",
      requiresAction: false,
    });
  });

  it("uses conservative deterministic behavior when no provider is configured", async () => {
    const { router } = routerWithResponse();

    await expect(
      router.classifyPriority({
        from: "Asha <asha@example.com>",
        subject: "Tuesday interview",
        snippet: "Are you available to meet Tuesday at 2 PM?",
      }),
    ).resolves.toMatchObject({
      priority: "MEDIUM",
      source: "rules",
      category: "direct_action",
    });
  });
});
