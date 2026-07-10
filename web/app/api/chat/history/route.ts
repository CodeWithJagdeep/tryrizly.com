import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";
import { deriveTitle } from "@/app/dashboard/lib/chat-store";

type MemoryRow = {
  id: string;
  summary: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type ChatHistoryItem = {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
};

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const params = new URLSearchParams({ userId: session.userId, limit: "50" });
  const rows = await callGateway<MemoryRow[]>(`/api/chat/history?${params.toString()}`).catch(() => null);

  const items: ChatHistoryItem[] = (rows ?? []).map((row) => {
    const firstLine = row.summary.split("|")[0]?.replace(/^User:\s*/, "").trim() || row.summary;
    return {
      id: row.id,
      title: deriveTitle(firstLine),
      summary: row.summary,
      createdAt: row.createdAt,
    };
  });

  return Response.json({ items });
}
