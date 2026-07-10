import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";
import { deriveTitle, type ChatSession, type StoredMessage } from "@/app/dashboard/lib/chat-store";

type MemoryRow = {
  id: string;
  summary: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

// Turns more than this far apart are treated as separate conversations.
const SESSION_GAP_MS = 30 * 60 * 1000;

function parseTurn(row: MemoryRow): StoredMessage[] {
  const [userPart, assistantPart] = row.summary.split(" | Assistant: ");
  const userContent = (userPart ?? "").replace(/^User:\s*/, "").trim();
  const assistantContent = (assistantPart ?? "").trim();
  const messages: StoredMessage[] = [];
  if (userContent) messages.push({ role: "user", content: userContent, timestamp: row.createdAt });
  if (assistantContent) messages.push({ role: "assistant", content: assistantContent, timestamp: row.createdAt });
  return messages;
}

function groupIntoSessions(rows: MemoryRow[]): ChatSession[] {
  const chronological = [...rows].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );

  const sessions: ChatSession[] = [];
  let current: ChatSession | null = null;
  let lastTs = 0;

  for (const row of chronological) {
    const ts = Date.parse(row.createdAt);
    if (!current || ts - lastTs > SESSION_GAP_MS) {
      current = { id: row.id, title: "New chat", messages: [], favorite: false, updatedAt: row.createdAt };
      sessions.push(current);
    }
    current.messages.push(...parseTurn(row));
    current.updatedAt = row.createdAt;
    if (current.title === "New chat") {
      const firstUser = current.messages.find((m) => m.role === "user");
      if (firstUser) current.title = deriveTitle(firstUser.content);
    }
    lastTs = ts;
  }

  return sessions.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const params = new URLSearchParams({ userId: session.userId, limit: "200" });
  const rows = await callGateway<MemoryRow[]>(`/api/chat/history?${params.toString()}`).catch(() => null);

  const sessions = groupIntoSessions(rows ?? []).slice(0, 25);

  return Response.json({ sessions });
}
