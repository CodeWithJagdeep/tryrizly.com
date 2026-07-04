import { enqueueReminder } from "@heyriz/shared/queue/queues";
import type { ReminderRequest } from "@heyriz/shared/queue/types";
import { localDateTimeToUtc, parseNaiveDateTime } from "../lib/timezone";
import type { HeyRizTool } from "./tool.types";

export const scheduleReminderTool: HeyRizTool<ReminderRequest> = {
  name: "schedule_reminder",
  category: "queue",
  description:
    "Schedule a proactive Telegram notification through BullMQ. For a one-time " +
    "reminder, set runAt to the principal's LOCAL wall-clock time as a naive " +
    '"YYYY-MM-DDTHH:mm" string (no timezone/offset) — the server converts it to ' +
    "the principal's saved timezone for you; do not compute a UTC offset yourself. " +
    'For a recurring reminder ("every day at 8pm"), set repeat: { cron } instead ' +
    "of runAt — a standard 5-field cron evaluated in the principal's saved timezone " +
    "(tz is filled in server-side; only set it to override with a different zone). " +
    "Use a stable dedupeKey for recurring reminders so re-saying the same request " +
    "updates the schedule instead of duplicating it.",
  approvalRequired: false,
  sensitiveDataPolicy: "none",
  async execute({ userId, payload, context }) {
    const normalized: ReminderRequest = {
      ...payload,
      userId,
      source: payload.source ?? "ai-core",
    };

    // A one-time reminder given as a naive local datetime ("2026-07-04T08:00")
    // is the principal's wall-clock time — convert it to a UTC instant in their
    // saved zone rather than trusting the model's offset arithmetic. A runAt that
    // already carries an offset / "Z" is left as the absolute instant it states.
    if (normalized.runAt) {
      const naive = parseNaiveDateTime(normalized.runAt);
      const hasOffset = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized.runAt.trim());
      if (naive && !hasOffset) {
        normalized.runAt = localDateTimeToUtc(
          naive.year,
          naive.month,
          naive.day,
          naive.hour,
          naive.minute,
          context.timezone,
        ).toISOString();
      }
    }

    // Recurring cron runs in the principal's saved timezone unless the model
    // explicitly set a different one — never fall through to the container's UTC.
    if (normalized.repeat && !normalized.repeat.tz) {
      normalized.repeat = { ...normalized.repeat, tz: context.timezone };
    }

    const reminder = await enqueueReminder(normalized);

    return {
      tool: "schedule_reminder",
      status: "ok",
      message: "Reminder scheduled.",
      data: reminder,
    };
  },
};
