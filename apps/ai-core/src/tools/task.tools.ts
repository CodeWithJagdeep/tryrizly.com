import type { TaskRepository } from "../tasks/task.repository";
import type { HeyRizEventSource } from "../context/context.types";
import type { HeyRizTool } from "./tool.types";

type CreateTaskPayload = {
  summary?: string;
  source?: HeyRizEventSource;
};

type ListTasksPayload = {
  /** How many tasks to show. Defaults to 10; capped at 25. */
  limit?: number;
};

const LIST_DEFAULT = 10;
const LIST_MAX = 25;

const URGENT_TASK_PATTERN =
  /\b(urgent|asap|overdue|deadline|today|blocker|blocking)\b/i;

export function createTaskTool(
  tasks: TaskRepository,
): HeyRizTool<CreateTaskPayload> {
  return {
    name: "create_task",
    category: "task",
    description:
      "Record an open internal task for deferred follow-up. No external message or calendar write is sent.",
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      const summary = payload.summary?.trim();
      if (!summary) {
        return {
          tool: "create_task",
          status: "not_implemented",
          message: `What task should I track, ${context.honorific}?`,
        };
      }

      const task = await tasks.create({
        userId,
        summary,
        source: payload.source ?? context.source,
      });

      return {
        tool: "create_task",
        status: "ok",
        message: `Tracked, ${context.honorific}: ${task.summary}`,
        data: { task },
      };
    },
  };
}

export function listTasksTool(
  tasks: TaskRepository,
): HeyRizTool<ListTasksPayload> {
  return {
    name: "list_tasks",
    category: "task",
    description:
      "List the user's open tasks, most important first. Shows the top 10 by default and offers the rest on request; pass a higher limit when the user asks for more.",
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      const open = await tasks.listOpen(userId);
      if (open.length === 0) {
        return {
          tool: "list_tasks",
          status: "ok",
          message: `No open tasks, ${context.honorific}.`,
          data: { tasks: [], total: 0 },
        };
      }

      // Urgent-flagged tasks first, then newest — the top of the list should
      // be what the user most needs to act on, not what they logged first.
      const ranked = [...open].sort((a, b) => {
        const urgentDiff =
          Number(URGENT_TASK_PATTERN.test(b.summary)) -
          Number(URGENT_TASK_PATTERN.test(a.summary));
        if (urgentDiff !== 0) return urgentDiff;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });

      const limit = Math.min(
        Math.max(Math.trunc(payload.limit ?? LIST_DEFAULT), 1),
        LIST_MAX,
      );
      const shown = ranked.slice(0, limit);
      const remaining = ranked.length - shown.length;

      const lines = shown.map((task, i) => `${i + 1}. ${task.summary}`);
      const footer =
        remaining > 0
          ? `\n\nThere ${remaining === 1 ? "is 1 more task" : `are ${remaining} more tasks`} — want the full list, ${context.honorific}?`
          : "";

      return {
        tool: "list_tasks",
        status: "ok",
        message: `Your top ${shown.length} open task${shown.length === 1 ? "" : "s"}, ${context.honorific}:\n${lines.join("\n")}${footer}`,
        data: { tasks: shown, total: ranked.length, remaining },
      };
    },
  };
}
