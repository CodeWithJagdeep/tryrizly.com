import { enqueueReminder } from "@heyriz/shared/queue/queues";
import type { ReminderRequest } from "@heyriz/shared/queue/types";
import type { HeyRizTool } from "./tool.types";

export const scheduleReminderTool: HeyRizTool<ReminderRequest> = {
  name: "schedule_reminder",
  category: "queue",
  description:
    "Schedule a proactive Telegram notification through BullMQ. For a one-time " +
    "reminder, set runAt (absolute ISO datetime). For a recurring reminder " +
    '("every day at 8pm", "every weekday at 9am"), set repeat: { cron, tz } ' +
    "instead of runAt — cron is a standard 5-field cron expression evaluated in " +
    "tz (use the principal's saved timezone). Use a stable dedupeKey for recurring " +
    "reminders so re-saying the same request updates the schedule instead of " +
    "duplicating it.",
  approvalRequired: false,
  sensitiveDataPolicy: "none",
  async execute({ payload }) {
    const reminder = await enqueueReminder({
      ...payload,
      source: payload.source ?? "ai-core",
    });

    return {
      tool: "schedule_reminder",
      status: "ok",
      message: "Reminder scheduled.",
      data: reminder,
    };
  },
};
