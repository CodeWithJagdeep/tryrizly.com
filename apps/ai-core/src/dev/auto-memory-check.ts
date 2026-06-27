import "reflect-metadata";
import { AutoMemoryService } from "../memory/auto-memory.service";
import { VectorMemoryService } from "../memory/vector-memory.service";
import type { EmbeddingsService } from "../memory/embeddings.service";
import type { LlmRouterService } from "../llm/llm-router.service";
import type { ToolExecutionResult } from "../tools/tool.types";

const noEmbeddings = {
  isAvailable: () => false,
  embed: async () => null,
} as unknown as EmbeddingsService;

// No LLM -> exercises the deterministic template path (offline-safe).
const noLlm = {
  hasProvider: () => false,
  complete: async () => undefined,
} as unknown as LlmRouterService;

const ok = (tool: string, extra: Partial<ToolExecutionResult> = {}): ToolExecutionResult => ({
  tool,
  status: "ok",
  message: `${tool} done`,
  ...extra,
});

async function main() {
  const checks: Array<[string, boolean]> = [];

  const memory = new VectorMemoryService(noEmbeddings);
  const auto = new AutoMemoryService(memory, noLlm);

  // 1) A real action (send_email) is remembered and then recallable.
  const r1 = await auto.captureTurn({ userId: "u", message: "reply to Naman", toolResults: [ok("send_email")] });
  const recalled = await memory.search({ userId: "u", query: "email", limit: 5 });
  checks.push(["sent email -> saved + recallable", r1.saved === true && recalled.some((h) => /email/i.test(h.summary))]);

  // 2) A read-only turn (calendar_briefing) is NOT remembered.
  const r2 = await auto.captureTurn({ userId: "u", message: "what's my day", toolResults: [ok("calendar_briefing")] });
  checks.push(["read-only -> not saved", r2.saved === false]);

  // 3) A user-stated fact is remembered (prefix stripped).
  const r3 = await auto.captureTurn({ userId: "u", message: "remember that I prefer morning standups", toolResults: [] });
  checks.push(["user fact -> saved", r3.saved === true && /morning standups/i.test(r3.summary ?? "")]);

  // 4) A HIGH proactive event is remembered; a MEDIUM one is not.
  const r4 = await auto.captureEvent({ userId: "u", source: "gmail", result: ok("gmail_triage", { priority: "HIGH" }), message: "Investor Naman wants the deck" });
  const r5 = await auto.captureEvent({ userId: "u", source: "gmail", result: ok("gmail_triage", { priority: "MEDIUM" }) });
  checks.push(["HIGH event saved, MEDIUM skipped", r4.saved === true && r5.saved === false]);

  let pass = true;
  for (const [name, result] of checks) {
    console.log(`${result ? "PASS" : "FAIL"}  ${name}`);
    if (!result) pass = false;
  }
  console.log(pass ? "AUTOMEMORY_CHECK_OK" : "AUTOMEMORY_CHECK_FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("AUTOMEMORY_CHECK_FAIL", e);
  process.exit(1);
});
