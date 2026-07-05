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

/** Groups a chronologically-sorted (newest first) list into same-day buckets, preserving order. */
export function groupByDay<T extends { createdAt: string }>(items: T[]): Array<{ label: string; items: T[] }> {
  const groups: Array<{ label: string; items: T[] }> = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
