import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "@/app/api/onboarding/_lib/require-user";
import { deriveTitle, type ChatSession, type StoredMessage } from "@/app/dashboard/lib/chat-store";

type ChatMessageRow = {
  id: string;
  sessionId: string | null;
  role: "user" | "assistant";
  content: string;
  source: string;
  createdAt: string;
};

// Rows without a sessionId predate the client-assigned-id fix (or came from a
// channel like Telegram that has no notion of a dashboard session). Group
// those by a time gap as a best-effort fallback; everything else groups by
// its actual sessionId, which is exact and never ambiguous.
const SESSION_GAP_MS = 30 * 60 * 1000;
const SIDEBAR_LIMIT = 10;

function toMessage(row: ChatMessageRow): StoredMessage {
  return { role: row.role, content: row.content, timestamp: row.createdAt };
}

function groupByGap(rows: ChatMessageRow[]): ChatSession[] {
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
    current.messages.push(toMessage(row));
    current.updatedAt = row.createdAt;
    if (current.title === "New chat" && row.role === "user") {
      current.title = deriveTitle(row.content);
    }
    lastTs = ts;
  }

  return sessions;
}

function groupBySessionId(rows: ChatMessageRow[]): ChatSession[] {
  const bySession = new Map<string, ChatMessageRow[]>();
  for (const row of rows) {
    if (!row.sessionId) continue;
    const bucket = bySession.get(row.sessionId);
    if (bucket) bucket.push(row);
    else bySession.set(row.sessionId, [row]);
  }

  const sessions: ChatSession[] = [];
  for (const [sessionId, sessionRows] of bySession) {
    const chronological = [...sessionRows].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    );
    const firstUser = chronological.find((r) => r.role === "user");
    const last = chronological[chronological.length - 1];
    sessions.push({
      id: sessionId,
      title: firstUser ? deriveTitle(firstUser.content) : "New chat",
      messages: chronological.map(toMessage),
      favorite: false,
      updatedAt: last?.createdAt ?? new Date().toISOString(),
    });
  }
  return sessions;
}

function groupIntoSessions(rows: ChatMessageRow[]): ChatSession[] {
  const withSessionId = rows.filter((r) => r.sessionId);
  const withoutSessionId = rows.filter((r) => !r.sessionId);

  const sessions = [
    ...groupBySessionId(withSessionId),
    ...groupByGap(withoutSessionId),
  ];

  return sessions.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function GET() {
  const session = await requireSession();
  if (!session) return Response.json({ message: "Unauthenticated" }, { status: 401 });

  const params = new URLSearchParams({ userId: session.userId, limit: "500" });
  const rows = await callGateway<ChatMessageRow[]>(`/api/chat/history?${params.toString()}`).catch(() => null);

  const sessions = groupIntoSessions(rows ?? []).slice(0, SIDEBAR_LIMIT);

  return Response.json({ sessions });
}
