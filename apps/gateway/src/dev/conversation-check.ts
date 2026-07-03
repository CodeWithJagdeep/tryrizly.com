import "reflect-metadata";
import { MemoryApprovalStore } from "../approval-store";
import { MemoryConversationStore } from "../conversation-store";
import { TelegramService } from "../telegram.service";
import type { AuthRepository } from "../auth/auth.repository";
import type { GatewayService } from "../gateway.service";
import { env } from "@heyriz/shared/env";

(env as { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string }).TELEGRAM_BOT_TOKEN =
  undefined;
(env as { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string }).TELEGRAM_CHAT_ID =
  undefined;

// isOwner() fails closed and requires a real telegram link, so the mock resolves
// a userId for the test chat (it represents a linked owner).
const fakeAuthRepo = {
  countTelegramLinks: async () => 1,
  findUserIdByTelegramChat: async () => "owner@example.com",
} as unknown as AuthRepository;

type Call = { pattern: string; payload: Record<string, unknown> };

function fakeGateway(responses: unknown[]): { svc: GatewayService; calls: Call[] } {
  const calls: Call[] = [];
  const svc = {
    sendToAiCore: async (pattern: string, payload: Record<string, unknown>) => {
      calls.push({ pattern, payload });
      return responses.shift();
    },
  } as unknown as GatewayService;
  return { svc, calls };
}

async function main() {
  const { svc, calls } = fakeGateway([
    { reply: "Which date did you mean, sir?" },
    { reply: "Got it - today it is." },
  ]);
  const telegram = new TelegramService(
    svc,
    new MemoryApprovalStore(),
    new MemoryConversationStore(),
    fakeAuthRepo,
  );

  await telegram.handleUpdate({
    message: { chat: { id: 99 }, text: "meeting at 3pm" },
  });
  await telegram.handleUpdate({
    message: { chat: { id: 99 }, text: "today" },
  });

  const secondPayload = calls[1]?.payload;
  const history = secondPayload?.history as
    | Array<{ role: string; content: string }>
    | undefined;
  const ok =
    calls.length === 2 &&
    Array.isArray(history) &&
    history.some((turn) => turn.role === "user" && turn.content === "meeting at 3pm") &&
    history.some(
      (turn) => turn.role === "assistant" && turn.content === "Which date did you mean, sir?",
    );

  console.log(ok ? "CONVERSATION_CHECK_OK" : "CONVERSATION_CHECK_FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error("CONVERSATION_CHECK_FAIL", error);
  process.exit(1);
});
