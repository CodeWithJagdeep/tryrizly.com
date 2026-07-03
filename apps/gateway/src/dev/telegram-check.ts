import "reflect-metadata";
import { MemoryApprovalStore } from "../approval-store";
import { MemoryConversationStore } from "../conversation-store";
import { TelegramService } from "../telegram.service";
import type { GatewayService } from "../gateway.service";
import type { AuthRepository } from "../auth/auth.repository";

// The approval scenarios below all run as a linked owner. isOwner() now requires
// a real telegram link (it fails closed), so the mock resolves a userId for any
// chat — except the explicit "unlinked" chat id used by the deny scenario.
const UNLINKED_CHAT_ID = "9999";
const fakeAuthRepo = {
  countTelegramLinks: async () => 1,
  findUserIdByTelegramChat: async (chatId: string) =>
    chatId === UNLINKED_CHAT_ID ? null : "owner@example.com",
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

const proposal = {
  reply: "Draft ready, sir. Shall I send it?",
  pendingApproval: {
    tool: "send_email",
    payload: { to: "naman@x.com", subject: "Re: Proposal", body: "Sounds good." },
    preview: "To: naman@x.com",
  },
};

const proposalA = proposal;
const proposalB = {
  reply: "Want me to put it on your calendar, sir?",
  pendingApproval: {
    tool: "create_calendar_event",
    payload: { summary: "Sync", start: "2026-06-24T18:00:00Z", end: "2026-06-24T19:00:00Z" },
    preview: "Sync",
  },
};

async function main() {
  const checks: Array<[string, boolean]> = [];

  // Scenario 1: text "yes" approves the held proposal.
  {
    const { svc, calls } = fakeGateway([proposal, { reply: "Sent, sir." }]);
    const tg = new TelegramService(svc, new MemoryApprovalStore(), new MemoryConversationStore(), fakeAuthRepo);
    await tg.handleUpdate({ message: { chat: { id: 42 }, text: "reply to Naman accepting" } });
    await tg.handleUpdate({ message: { chat: { id: 42 }, text: "yes" } });
    const approved = calls[1]?.payload;
    checks.push(["text-yes -> approve+execute", calls.length === 2 && approved?.approve === true && (approved?.pendingApproval as { tool?: string })?.tool === "send_email"]);
  }

  // Scenario 2: inline button "approve" callback executes the held proposal.
  {
    const { svc, calls } = fakeGateway([proposal, { reply: "Sent, sir." }]);
    const tg = new TelegramService(svc, new MemoryApprovalStore(), new MemoryConversationStore(), fakeAuthRepo);
    await tg.handleUpdate({ message: { chat: { id: 7 }, text: "reply to Naman" } });
    await tg.handleUpdate({ callback_query: { id: "cb1", data: "approve", message: { chat: { id: 7 } } } });
    checks.push(["button-approve -> execute", calls.length === 2 && calls[1]?.payload?.approve === true]);
  }

  // Scenario 3: "no" cancels and never calls ai-core a second time.
  {
    const { svc, calls } = fakeGateway([proposal]);
    const tg = new TelegramService(svc, new MemoryApprovalStore(), new MemoryConversationStore(), fakeAuthRepo);
    await tg.handleUpdate({ message: { chat: { id: 9 }, text: "reply to Naman" } });
    await tg.handleUpdate({ message: { chat: { id: 9 }, text: "no" } });
    checks.push(["no -> cancelled, no execute", calls.length === 1]);
  }

  // Scenario 4: a second, separate message carries the first turn as history.
  {
    const { svc, calls } = fakeGateway([
      { reply: "Which date did you mean, sir?" },
      { reply: "Got it — today it is." },
    ]);
    const tg = new TelegramService(svc, new MemoryApprovalStore(), new MemoryConversationStore(), fakeAuthRepo);
    await tg.handleUpdate({ message: { chat: { id: 99 }, text: "meeting at 3pm" } });
    await tg.handleUpdate({ message: { chat: { id: 99 }, text: "today" } });
    const secondHistory = calls[1]?.payload?.history as Array<{ role: string; content: string }> | undefined;
    checks.push([
      "second message -> history includes first turn",
      Array.isArray(secondHistory) &&
        secondHistory.some((t) => t.role === "user" && t.content === "meeting at 3pm") &&
        secondHistory.some((t) => t.role === "assistant" && t.content === "Which date did you mean, sir?"),
    ]);
  }

  // Scenario 5: a rejected proposal is still recorded so the next message has context.
  {
    const { svc, calls } = fakeGateway([proposal, { reply: "Noted." }]);
    const tg = new TelegramService(svc, new MemoryApprovalStore(), new MemoryConversationStore(), fakeAuthRepo);
    await tg.handleUpdate({ message: { chat: { id: 11 }, text: "reply to Naman" } });
    await tg.handleUpdate({ message: { chat: { id: 11 }, text: "no" } });
    await tg.handleUpdate({ message: { chat: { id: 11 }, text: "actually let's do 5pm" } });
    const nextHistory = calls[1]?.payload?.history as Array<{ role: string; content: string }> | undefined;
    checks.push([
      "rejected proposal -> visible in later history",
      calls.length === 2 && Array.isArray(nextHistory) && nextHistory.some((t) => t.content === "No, cancel that."),
    ]);
  }

  // Scenario 6: two pending proposals; "yes 2" approves the SECOND and the
  // first survives for its own approval (the multi-slot fix — old code lost it).
  {
    const { svc, calls } = fakeGateway([
      proposalA,
      proposalB,
      { reply: "On your calendar, sir." },
      { reply: "Sent, sir." },
    ]);
    const tg = new TelegramService(svc, new MemoryApprovalStore(), new MemoryConversationStore(), fakeAuthRepo);
    await tg.handleUpdate({ message: { chat: { id: 21 }, text: "reply to Naman" } });
    await tg.handleUpdate({ message: { chat: { id: 21 }, text: "schedule a sync tomorrow" } });
    await tg.handleUpdate({ message: { chat: { id: 21 }, text: "yes 2" } });
    await tg.handleUpdate({ message: { chat: { id: 21 }, text: "yes 1" } });
    const approvedSecond = (calls[2]?.payload?.pendingApproval as { tool?: string })?.tool;
    const approvedFirst = (calls[3]?.payload?.pendingApproval as { tool?: string })?.tool;
    checks.push([
      "two pending -> 'yes 2' runs the 2nd, 1st still approvable",
      calls.length === 4 &&
        approvedSecond === "create_calendar_event" &&
        approvedFirst === "send_email",
    ]);
  }

  // Scenario 7: with two pending, a bare "yes" is ambiguous — ask, don't guess.
  {
    const { svc, calls } = fakeGateway([proposalA, proposalB]);
    const tg = new TelegramService(svc, new MemoryApprovalStore(), new MemoryConversationStore(), fakeAuthRepo);
    await tg.handleUpdate({ message: { chat: { id: 22 }, text: "reply to Naman" } });
    await tg.handleUpdate({ message: { chat: { id: 22 }, text: "schedule a sync" } });
    await tg.handleUpdate({ message: { chat: { id: 22 }, text: "yes" } });
    checks.push(["two pending -> bare 'yes' asks, never executes", calls.length === 2]);
  }

  // Scenario 8: a chat with no telegram link is not an owner — its messages are
  // ignored and never reach ai-core (fail-closed; guards against the old
  // "nobody linked yet -> everyone is owner" and DB-error fail-open).
  {
    const { svc, calls } = fakeGateway([proposal]);
    const tg = new TelegramService(svc, new MemoryApprovalStore(), new MemoryConversationStore(), fakeAuthRepo);
    await tg.handleUpdate({ message: { chat: { id: Number(UNLINKED_CHAT_ID) }, text: "reply to Naman" } });
    checks.push(["unlinked chat -> ignored, never reaches ai-core", calls.length === 0]);
  }

  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
    if (!pass) ok = false;
  }
  console.log(ok ? "TELEGRAM_CHECK_OK" : "TELEGRAM_CHECK_FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("TELEGRAM_CHECK_FAIL", e);
  process.exit(1);
});
