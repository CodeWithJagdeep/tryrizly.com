import type { TaskRepository } from "../tasks/task.repository";
import type { HeyRizEventSource } from "../context/context.types";
import type { HeyRizTool } from "./tool.types";

type CreateTaskPayload = {
  summary?: string;
  source?: HeyRizEventSource;
};

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
