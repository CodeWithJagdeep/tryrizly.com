export const TASK_LABELS: Record<string, string> = {
  agent: "Chat & tool calls",
  extract: "Email reading",
  decide: "Decision tracking",
  draft: "Drafting replies",
  memory: "Memory notes",
  brief: "Morning brief",
  query: "Business data lookups",
  classify: "Inbox triage",
};

export function taskLabel(task: string): string {
  return TASK_LABELS[task] ?? task;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
