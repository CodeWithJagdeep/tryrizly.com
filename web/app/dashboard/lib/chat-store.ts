export type PendingApproval = {
  tool: string;
  payload: unknown;
  preview: string;
  resolved?: "approved" | "rejected";
};

export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  pendingApproval?: PendingApproval;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: StoredMessage[];
  favorite: boolean;
  updatedAt: string;
};

const SESSIONS_KEY = "heyriz.chat.sessions";
const CONTEXT_KEY = "heyriz.chat.context-paused";
const SESSIONS_EVENT = "heyriz:chat-sessions-changed";
const OPEN_SEARCH_EVENT = "heyriz:open-chat-search";

function readSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  window.dispatchEvent(new Event(SESSIONS_EVENT));
}

export function getSessions(): ChatSession[] {
  return readSessions().sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export function getSession(id: string): ChatSession | undefined {
  return readSessions().find((session) => session.id === id);
}

export function saveSession(session: ChatSession) {
  const sessions = readSessions().filter((existing) => existing.id !== session.id);
  writeSessions([session, ...sessions]);
}

export function deleteSession(id: string) {
  writeSessions(readSessions().filter((session) => session.id !== id));
}

export function toggleFavorite(id: string) {
  writeSessions(
    readSessions().map((session) =>
      session.id === id ? { ...session, favorite: !session.favorite } : session,
    ),
  );
}

export function deriveTitle(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New chat";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
}

export function subscribeToSessions(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SESSIONS_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SESSIONS_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function isContextPaused(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CONTEXT_KEY) === "1";
}

export function setContextPaused(paused: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONTEXT_KEY, paused ? "1" : "0");
  window.dispatchEvent(new Event(SESSIONS_EVENT));
}

export function openChatSearch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

export function subscribeToOpenSearch(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(OPEN_SEARCH_EVENT, callback);
  return () => window.removeEventListener(OPEN_SEARCH_EVENT, callback);
}
