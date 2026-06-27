import "reflect-metadata";
import {
  VectorMemoryService,
  blendRecency,
  keywordOverlap,
} from "../memory/vector-memory.service";
import type { EmbeddingsService } from "../memory/embeddings.service";

// Fake embeddings: tiny hand-made vectors so we can assert cosine behaviour.
function fakeEmbeddings(map: Record<string, number[]>): EmbeddingsService {
  return {
    isAvailable: () => true,
    embed: async (text: string) => map[text.trim()] ?? null,
  } as unknown as EmbeddingsService;
}

async function main() {
  const checks: Array<[string, boolean]> = [];

  // 1) Recency blend: same similarity, newer memory scores higher.
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 60 * 86_400_000).toISOString();
  checks.push(["recency: newer ranks higher", blendRecency(0.5, now) > blendRecency(0.5, old)]);

  // 2) Keyword overlap thresholding.
  checks.push(["keyword: full match", keywordOverlap("investor meeting Tuesday", "investor") === 1]);
  checks.push(["keyword: no match", keywordOverlap("lunch order", "investor") === 0]);

  // 3) Keyword-fallback recall (no embeddings key) only returns relevant items.
  const kw = new VectorMemoryService(
    { isAvailable: () => false, embed: async () => null } as unknown as EmbeddingsService,
  );
  await kw.remember({ userId: "u1", source: "gmail", summary: "Investor Naman wants the deck" });
  await kw.remember({ userId: "u1", source: "telegram", summary: "Lunch order from Subway" });
  await kw.remember({ userId: "u1", source: "gmail", summary: "Investor follow-up next week" });
  const kwHits = await kw.search({ userId: "u1", query: "investor", limit: 5 });
  checks.push(["keyword recall: only relevant", kwHits.length === 2 && kwHits.every((h) => /investor/i.test(h.summary))]);

  // 4) Embeddings recall: cosine ranks + drops the unrelated one below threshold.
  const emb = new VectorMemoryService(
    fakeEmbeddings({
      "Quarterly revenue is up 20%": [1, 0],
      "Team offsite venue ideas": [0, 1],
      "revenue growth": [1, 0],
    }),
  );
  await emb.remember({ userId: "u2", source: "database", summary: "Quarterly revenue is up 20%" });
  await emb.remember({ userId: "u2", source: "telegram", summary: "Team offsite venue ideas" });
  const embHits = await emb.search({ userId: "u2", query: "revenue growth", limit: 5 });
  checks.push(["embeddings recall: only the related vector", embHits.length === 1 && embHits[0].summary.includes("revenue")]);

  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
    if (!pass) ok = false;
  }
  console.log(ok ? "MEMORY_CHECK_OK" : "MEMORY_CHECK_FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("MEMORY_CHECK_FAIL", e);
  process.exit(1);
});
