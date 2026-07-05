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

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
