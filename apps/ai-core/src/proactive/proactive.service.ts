import { Inject, Injectable } from "@nestjs/common";
import { CalComService, type CalComBooking } from "../connectors/calcom.service";
import { ConnectorService } from "../connectors/connector.service";
import { GoogleService } from "../google/google.service";
import type { CalendarEvent } from "../google/google.types";
import { VectorMemoryService } from "../memory/vector-memory.service";
import { UserPreferencesRepository } from "../preferences/user-preferences.repository";
import { TaskRepository } from "../tasks/task.repository";
import { ToolRegistryService } from "../tools/tool-registry.service";
import type { HeyRizRuntimeContext } from "../context/context.types";
import { enqueueReminder } from "@heyriz/shared/queue/queues";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { zonedTimeToUtc } from "../lib/timezone";
import { EventIngestService } from "../spine/event-ingest.service";
import { DecisionService } from "../spine/decision.service";
import {
  canonicalMeetingKey,
  meetingsLikelySame,
} from "../availability/availability.service";

const MIN = 60_000;
const MEMORY_TIMEOUT_MS = 800;
const URGENT_MEETING_WINDOW_MIN = 60;
const URGENT_TASK_PATTERN = /\b(urgent|asap|overdue|deadline|today|blocker|blocking)\b/i;
const FOLLOWUP_DELAY_MS = 4 * 60 * MIN;
// The brief is sent once per local day. A small margin covers scheduler delay
// without repeatedly resurfacing yesterday's already-reported inbox items.
const EMAIL_LOOKBACK_MS = 26 * 60 * MIN;
const EMAIL_BRIEF_CAP = 3;

const IMPORTANT_EMAIL_CATEGORIES = new Set([
  "account_alert",
  "payment_due",
  "meeting_request",
  "investor_update",
  "follow_up_needed",
  "general_high",
]);

const LEGACY_IMPORTANT_EMAIL_PATTERN =
  /\b(action required|urgent|security|suspicious|account|domain|certificate|invoice|payment|overdue|meeting|interview|investor|contract|legal|reply requested)\b/i;

type BriefItem = {
  text: string;
  score: number;
  urgent: boolean;
  kind: "meeting" | "task" | "email" | "metric";
  recommendation?: string;
  followupKey?: string;
};

type EmailMemory = Awaited<ReturnType<VectorMemoryService["listBySource"]>>[number];

/**
 * The proactive engine. Composes the morning brief and, per upcoming meeting,
 * schedules a T-30 heads-up, a T-5 "starting soon", and a post-start "you
 * haven't joined yet" nudge. Reminders are enqueued onto the notifications
 * queue (deduped by jobId) so the worker delivers them at the right moment.
 */
@Injectable()
export class ProactiveService {
  constructor(
    @Inject(ToolRegistryService)
    private readonly tools: ToolRegistryService,
    @Inject(GoogleService)
    private readonly google: GoogleService,
    @Inject(ConnectorService)
    private readonly connectors: ConnectorService,
    @Inject(CalComService)
    private readonly calcom: CalComService,
    @Inject(VectorMemoryService)
    private readonly vectorMemory: VectorMemoryService,
    @Inject(TaskRepository)
    private readonly tasks: TaskRepository,
    @Inject(UserPreferencesRepository)
    private readonly preferences: UserPreferencesRepository,
    @Inject(EventIngestService)
    private readonly eventIngest: EventIngestService,
    @Inject(DecisionService)
    private readonly decisions: DecisionService,
  ) {}

  async morningBrief(userId = env.DEFAULT_USER_ID) {
    const honorific = await this.preferences.getHonorific(userId);
    const timezone = await this.preferences.getTimezone(userId);
    const now = new Date();
    const calendar = await this.google
      .listEvents(userId, {
        timeMin: startOfDay(now, timezone),
        timeMax: endOfDay(now, timezone),
        maxResults: 25,
      })
      .catch((error: unknown) => {
        logger.warn("morning brief calendar fetch failed", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
      });

    const events = calendar?.connected ? calendar.events : [];
    const eventItems = await Promise.all(
      events.map((event) => this.scoreEventItem(userId, event, timezone)),
    );

    const calComAuth = await this.connectors.getCalComSecret(userId).catch(() => null);
    const todayStart = startOfDay(now, timezone).getTime();
    const todayEnd = endOfDay(now, timezone).getTime();
    const calComBookings = calComAuth
      ? await this.calcom
          .listBookings(calComAuth, { status: "upcoming", take: 50 })
          .then((bookings) =>
            bookings.filter((b) => {
              const startMs = Date.parse(b.startTime);
              return !Number.isNaN(startMs) && startMs >= todayStart && startMs <= todayEnd;
            }),
          )
          .catch((error: unknown) => {
            logger.warn("morning brief calcom fetch failed", {
              userId,
              error: error instanceof Error ? error.message : String(error),
            });
            return [] as CalComBooking[];
          })
      : [];
    const distinctCalComBookings = calComBookings.filter(
      (booking) => !isMirroredCalComBooking(booking, events),
    );
    const calComItems = distinctCalComBookings.map(
      (booking) => this.scoreCalComItem(booking, timezone),
    );

    const openTasks = await this.tasks.listOpen(userId).catch((error: unknown) => {
      logger.warn("morning brief task fetch failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    });
    const pendingEmails = env.BACKGROUND_AI_ENABLED
      ? await withTimeout(
          this.vectorMemory.listBySource(userId, "gmail", 200),
          MEMORY_TIMEOUT_MS,
        ).catch((error: unknown) => {
          logger.warn("morning brief email memory fetch failed", {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
          return undefined;
        })
      : undefined;
    const metricsLine = await this.metricsLine(userId, honorific, timezone);

    const header = `Good morning, ${honorific}.`;

    const taskItems: BriefItem[] = openTasks
      .map((task) => this.scoreTaskItem(task))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const emailItems = (pendingEmails ?? [])
      .map((hit) => this.scoreEmailItem(hit))
      .filter((item): item is BriefItem => Boolean(item))
      .sort((a, b) => b.score - a.score)
      .slice(0, EMAIL_BRIEF_CAP);
    const metricsItem: BriefItem[] = metricsLine
      ? [{ text: metricsLine, score: 20, urgent: false, kind: "metric" }]
      : [];

    const scheduleItems = [
      ...(calendar?.connected ? eventItems : []),
      ...calComItems,
    ]
      .sort((a, b) => b.score - a.score)
      .filter((item) => item.score > -1000);

    // Email memories do not prove that a message is still unread or unresolved.
    // Only explicit tasks receive a later follow-up; Gmail reminders are created
    // separately after user approval and can be checked against live provider state.
    await this.scheduleFollowups(
      userId,
      honorific,
      taskItems.filter((item) => item.urgent),
    );

    const scheduleSummary = meetingCountPhrase(
      calendar,
      events.length + distinctCalComBookings.length,
      Boolean(calComAuth),
    );
    const sections = [
      `Schedule\n${scheduleItems.length > 0 ? bulletList(scheduleItems) : scheduleSummary}`,
      `Priority inbox\n${
        pendingEmails === undefined
          ? "Priority email check unavailable."
          : emailItems.length > 0
            ? numberedList(emailItems)
            : "No email requires action."
      }`,
      ...(taskItems.length > 0 ? [`Tasks\n${bulletList(taskItems)}`] : []),
      ...(metricsItem.length > 0 ? [`Business\n${bulletList(metricsItem)}`] : []),
    ];

    const recommendation = [...scheduleItems, ...emailItems, ...taskItems]
      .filter((item) => item.recommendation)
      .sort((a, b) => b.score - a.score)[0]?.recommendation;
    if (recommendation) {
      sections.push(`Recommended next step\n${recommendation}`);
    }

    const text = `${header}\n\n${sections.join("\n\n")}`;

    await enqueueReminder({
      userId,
      message: text,
      runAt: new Date().toISOString(),
      source: "calendar",
      dedupeKey: `brief:${userId}:${dayKey(new Date())}`,
      metadata: { kind: "morning_brief" },
    });

    return { sent: true, text };
  }

  async syncMeetingReminders(
    userId = env.DEFAULT_USER_ID,
    source: "calendar" | "calcom" = "calendar",
  ) {
    if (source === "calcom") return this.syncCalComMeetingReminders(userId);

    const honorific = await this.preferences.getHonorific(userId);
    const timezone = await this.preferences.getTimezone(userId);
    const now = new Date();
    const res = await this.google.listEvents(userId, {
      timeMin: now,
      timeMax: endOfDay(now, timezone),
      maxResults: 25,
    });

    if (!res.connected) {
      return { connected: false, scheduled: [] as ScheduledReminder[] };
    }

    const scheduled: ScheduledReminder[] = [];

    for (const event of res.events) {
      if (event.allDay || !event.start) continue;
      const startMs = Date.parse(event.start);
      if (Number.isNaN(startMs)) continue;

      // Spine (best-effort): drop the meeting + its attendees onto the timeline.
      void this.eventIngest
        .recordEvent(userId, {
          type: "meeting",
          source: "calendar",
          sourceId: event.id,
          timestamp: new Date(startMs),
          content: event.title,
          metadata: { start: event.start, end: event.end },
          participants: [
            ...(event.organizer ? [{ email: event.organizer, role: "organizer" }] : []),
            ...event.attendees.map((a) => ({ email: a, role: "attendee" })),
          ],
        })
        .then((recorded) => {
          // Only mine decisions on the row's first-ever insert — the calendar
          // re-syncs every 5 minutes and a description's commitments don't
          // change, so re-running extraction on every poll would just create
          // duplicate-looking decision churn for no new information.
          if (recorded?.inserted && event.description?.trim()) {
            void this.decisions
              .extractFromMeeting(userId, {
                title: event.title,
                description: event.description,
                attendees: [
                  ...(event.organizer ? [event.organizer] : []),
                  ...event.attendees,
                ],
              })
              .catch((e: unknown) =>
                logger.warn("spine: meeting decision extraction failed", {
                  error: e instanceof Error ? e.message : String(e),
                }),
              );
          }
        })
        .catch((e: unknown) =>
          logger.warn("spine: meeting event ingest failed", {
            error: e instanceof Error ? e.message : String(e),
          }),
        );

      const join = event.hangoutLink ? ` Join: ${event.hangoutLink}` : "";
      const hint = await this.eventMemoryHint(userId, event, MEMORY_TIMEOUT_MS);
      const context = hint ? ` (${truncate(hint.summary, 140)})` : "";
      const canonicalId = canonicalMeetingKey({
        title: event.title,
        start: event.start,
        end: event.end,
      });
      const plans = [
        {
          kind: "t30",
          at: startMs - 30 * MIN,
          text: `Heads up, ${honorific} - "${event.title}" in 30 minutes${context}.${join}`,
        },
        {
          kind: "t5",
          at: startMs - 5 * MIN,
          text: `"${event.title}" starts in 5 minutes, ${honorific}${context}.${join}`,
        },
        {
          kind: "late",
          at: startMs + 2 * MIN,
          text: `${honorific}, "${event.title}" has started. Want me to open the link?${join}`,
        },
      ];

      for (const plan of plans) {
        if (plan.at <= Date.now()) continue;
        await enqueueReminder({
          userId,
          message: plan.text,
          runAt: new Date(plan.at).toISOString(),
          source: "calendar",
          dedupeKey: `meet:${userId}:${canonicalId}:${plan.kind}`,
          metadata: {
            kind: `meeting_${plan.kind}`,
            meetingId: canonicalId,
            sourceId: event.id,
            source: "google",
          },
        });
        scheduled.push({
          meetingId: event.id,
          title: event.title,
          kind: plan.kind,
          at: new Date(plan.at).toISOString(),
        });
      }
    }

    logger.info("meeting reminders synced", {
      userId,
      events: res.events.length,
      scheduled: scheduled.length,
    });
    return { connected: true, scheduled };
  }

  private async syncCalComMeetingReminders(userId: string) {
    const honorific = await this.preferences.getHonorific(userId);
    const auth = await this.connectors.getCalComSecret(userId);
    if (!auth) {
      return { connected: false, scheduled: [] as ScheduledReminder[] };
    }

    const bookings = await this.calcom
      .listBookings(auth, { status: "upcoming", take: 50 })
      .catch((error: unknown) => {
        logger.warn("cal.com meeting reminder sync: listBookings failed", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        return [] as CalComBooking[];
      });
    const scheduled: ScheduledReminder[] = [];

    for (const booking of bookings) {
      if (booking.status?.toLowerCase() === "cancelled" || !booking.startTime) continue;
      const startMs = Date.parse(booking.startTime);
      if (Number.isNaN(startMs)) continue;

      void this.eventIngest
        .recordEvent(userId, {
          type: "meeting",
          source: "calcom",
          sourceId: booking.uid || String(booking.id),
          timestamp: new Date(startMs),
          content: booking.title,
          metadata: { start: booking.startTime, end: booking.endTime },
          participants: booking.attendees.map((a) => ({
            email: a.email,
            role: "attendee",
          })),
        })
        .catch((e: unknown) =>
          logger.warn("spine: cal.com meeting event ingest failed", {
            error: e instanceof Error ? e.message : String(e),
          }),
        );

      const join = booking.meetingUrl ? ` Join: ${booking.meetingUrl}` : "";
      const hint = await this.calComMemoryHint(userId, booking, MEMORY_TIMEOUT_MS);
      const context = hint ? ` (${truncate(hint.summary, 140)})` : "";
      const meetingId = booking.uid || String(booking.id);
      const canonicalId = canonicalMeetingKey({
        title: booking.title,
        start: booking.startTime,
        end: booking.endTime,
      });
      const plans = [
        {
          kind: "t30",
          at: startMs - 30 * MIN,
          text: `Heads up, ${honorific} - "${booking.title}" in 30 minutes${context}.${join}`,
        },
        {
          kind: "t5",
          at: startMs - 5 * MIN,
          text: `"${booking.title}" starts in 5 minutes, ${honorific}${context}.${join}`,
        },
        {
          kind: "late",
          at: startMs + 2 * MIN,
          text: `${honorific}, "${booking.title}" has started. Want me to open the link?${join}`,
        },
      ];

      for (const plan of plans) {
        if (plan.at <= Date.now()) continue;
        await enqueueReminder({
          userId,
          message: plan.text,
          runAt: new Date(plan.at).toISOString(),
          source: "calcom",
          dedupeKey: `meet:${userId}:${canonicalId}:${plan.kind}`,
          metadata: {
            kind: `meeting_${plan.kind}`,
            meetingId: canonicalId,
            sourceId: meetingId,
            source: "calcom",
          },
        });
        scheduled.push({
          meetingId,
          title: booking.title,
          kind: plan.kind,
          at: new Date(plan.at).toISOString(),
        });
      }
    }

    logger.info("cal.com meeting reminders synced", {
      userId,
      bookings: bookings.length,
      scheduled: scheduled.length,
    });
    return { connected: true, scheduled };
  }

  private async scoreEventItem(
    userId: string,
    event: CalendarEvent,
    timezone: string,
  ): Promise<BriefItem> {
    if (event.allDay) {
      return { text: `All day: ${event.title}`, score: 0, urgent: false, kind: "meeting" };
    }
    // Already-finished events are marked "(completed)" rather than listed as
    // if still open — relevant when the brief is re-run later in the day.
    const endMs = Date.parse(event.end ?? event.start ?? "");
    if (!Number.isNaN(endMs) && endMs < Date.now()) {
      return {
        text: `${event.title} (completed)`,
        score: -1000,
        urgent: false,
        kind: "meeting",
      };
    }
    const startMs = Date.parse(event.start ?? "");
    const minutesUntil = Number.isNaN(startMs) ? Infinity : (startMs - Date.now()) / MIN;
    return {
      text: `${fmtTime(event.start, timezone)} ${event.title}`,
      score: 1000 - minutesUntil,
      urgent: minutesUntil >= 0 && minutesUntil <= URGENT_MEETING_WINDOW_MIN,
      kind: "meeting",
      recommendation:
        minutesUntil >= 0 && minutesUntil <= URGENT_MEETING_WINDOW_MIN
          ? `Prepare for ${cleanLine(event.title)} before ${fmtTime(event.start, timezone)}.`
          : undefined,
    };
  }

  private scoreCalComItem(booking: CalComBooking, timezone: string): BriefItem {
    const endMs = Date.parse(booking.endTime ?? booking.startTime ?? "");
    if (!Number.isNaN(endMs) && endMs < Date.now()) {
      return {
        text: `${booking.title} (completed) [Cal.com]`,
        score: -1000,
        urgent: false,
        kind: "meeting",
      };
    }
    const startMs = Date.parse(booking.startTime ?? "");
    const minutesUntil = Number.isNaN(startMs) ? Infinity : (startMs - Date.now()) / MIN;
    return {
      text: `${fmtTime(booking.startTime, timezone)} ${booking.title} [Cal.com]`,
      score: 1000 - minutesUntil,
      urgent: minutesUntil >= 0 && minutesUntil <= URGENT_MEETING_WINDOW_MIN,
      kind: "meeting",
      recommendation:
        minutesUntil >= 0 && minutesUntil <= URGENT_MEETING_WINDOW_MIN
          ? `Prepare for ${cleanLine(booking.title)} before ${fmtTime(booking.startTime, timezone)}.`
          : undefined,
    };
  }

  private scoreTaskItem(task: { id: string; summary: string; createdAt: Date | string }): BriefItem {
    const urgent = URGENT_TASK_PATTERN.test(task.summary);
    const ageDays = (Date.now() - new Date(task.createdAt).getTime()) / (24 * 60 * MIN);
    return {
      text: `Task: ${task.summary}`,
      score: urgent ? 500 : Math.min(ageDays, 10) * 10,
      urgent,
      kind: "task",
      recommendation: urgent ? `Complete the urgent task: ${cleanSentence(task.summary, 100)}` : undefined,
      followupKey: `task:${task.id}`,
    };
  }

  private scoreEmailItem(hit: EmailMemory): BriefItem | undefined {
    const createdAtMs = Date.parse(hit.createdAt);
    if (Number.isNaN(createdAtMs) || Date.now() - createdAtMs > EMAIL_LOOKBACK_MS) {
      return undefined;
    }

    const metadata = hit.metadata ?? {};
    const category = stringMetadata(metadata, "category");
    const priority = stringMetadata(metadata, "priority").toUpperCase();
    const riskLevel = stringMetadata(metadata, "riskLevel").toLowerCase();
    const urgency = stringMetadata(metadata, "urgency").toLowerCase();
    const requiresReply = booleanMetadata(metadata, "requiresReply");
    const isMarketing = booleanMetadata(metadata, "isMarketing");
    const isAutomated = booleanMetadata(metadata, "isAutomated");

    if (
      isMarketing ||
      category === "newsletter" ||
      category === "general_low" ||
      category === "otp"
    ) {
      return undefined;
    }

    const knownImportant = IMPORTANT_EMAIL_CATEGORIES.has(category);
    const replyRequired = category === "general_medium" && requiresReply && !isAutomated;
    const legacyImportant =
      !category && priority === "HIGH" && LEGACY_IMPORTANT_EMAIL_PATTERN.test(hit.summary);
    if (!knownImportant && !replyRequired && !legacyImportant) return undefined;

    const subject = emailSubject(hit);
    const sender = emailSender(hit);
    const action = emailAction(metadata, category, sender);
    const urgent =
      urgency === "urgent" ||
      riskLevel === "high" ||
      category === "account_alert" ||
      /\b(action required|urgent|security|suspicious|overdue)\b/i.test(subject);
    const categoryScore: Record<string, number> = {
      account_alert: 900,
      payment_due: 760,
      investor_update: 720,
      follow_up_needed: 680,
      meeting_request: 640,
      general_high: 600,
      general_medium: 440,
    };
    const recencyHours = Math.max(0, (Date.now() - createdAtMs) / (60 * MIN));
    const score =
      (categoryScore[category] ?? 500) +
      (urgent ? 180 : 0) +
      (requiresReply ? 90 : 0) +
      Math.max(0, 48 - recencyHours);

    return {
      text: `${sender} - ${cleanSentence(subject || hit.summary, 110)}\nAction: ${action}`,
      score,
      urgent,
      kind: "email",
      recommendation: action,
    };
  }

  // Best-effort re-nudge: re-sends the same urgent item a few hours later so
  // it doesn't only get mentioned once at 8am and then disappear. This does
  // NOT re-check whether the task/email is still open by delivery time — a
  // true "still unresolved?" recheck would need its own job querying current
  // state, not just replaying the brief text.
  private async scheduleFollowups(userId: string, honorific: string, urgentItems: BriefItem[]) {
    const runAt = new Date(Date.now() + FOLLOWUP_DELAY_MS).toISOString();
    for (const item of urgentItems) {
      if (!item.followupKey) continue;
      await enqueueReminder({
        userId,
        message: `Following up, ${honorific} — this was flagged urgent this morning: ${item.text}`,
        runAt,
        source: "calendar",
        dedupeKey: `followup:${userId}:${item.followupKey}:${dayKey(new Date())}`,
        metadata: { kind: "brief_followup" },
      }).catch((error: unknown) => {
        logger.warn("morning brief followup schedule failed", {
          userId,
          followupKey: item.followupKey,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  private async eventMemoryHint(
    userId: string,
    event: CalendarEvent,
    timeoutMs?: number,
  ) {
    const query = [event.title, ...(event.attendees ?? [])].filter(Boolean).join(" ");
    if (!env.BACKGROUND_AI_ENABLED) return undefined;
    if (!query.trim()) return undefined;

    const search = this.vectorMemory
      .search({ userId, query, limit: 1 })
      .then((hits) => hits[0]);

    try {
      return timeoutMs ? await withTimeout(search, timeoutMs) : await search;
    } catch {
      return undefined;
    }
  }

  private async calComMemoryHint(
    userId: string,
    booking: CalComBooking,
    timeoutMs?: number,
  ) {
    const query = [
      booking.title,
      ...booking.attendees.map((a) => a.name || a.email),
    ].filter(Boolean).join(" ");
    if (!env.BACKGROUND_AI_ENABLED) return undefined;
    if (!query.trim()) return undefined;

    const search = this.vectorMemory
      .search({ userId, query, limit: 1 })
      .then((hits) => hits[0]);

    try {
      return timeoutMs ? await withTimeout(search, timeoutMs) : await search;
    } catch {
      return undefined;
    }
  }

  private async metricsLine(
    userId: string,
    honorific: string,
    timezone: string,
  ): Promise<string | undefined> {
    try {
      if (!env.BACKGROUND_AI_ENABLED) return undefined;
      const result = await this.tools.execute({
        name: "business_snapshot",
        userId,
        payload: {
          question:
            "Give one terse morning business metric or anomaly from connected data sources.",
        },
        context: minimalContext(userId, honorific, timezone),
      });
      if (result.status !== "ok" || /which one should I check/i.test(result.message)) {
        return undefined;
      }
      return `Metrics: ${result.message}`;
    } catch (error) {
      logger.warn("morning brief business snapshot skipped", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

}

type ScheduledReminder = {
  meetingId: string;
  title: string;
  kind: string;
  at: string;
};

function minimalContext(
  userId: string,
  honorific: string,
  timezone: string,
): HeyRizRuntimeContext {
  return {
    userId,
    source: "calendar",
    structured: { activeDeals: [], preferences: [], pendingStates: [] },
    semantic: [],
    live: {
      connected: false,
      calendarConnected: false,
      inboxConnected: false,
      calendarStatus: "not_connected",
      inboxStatus: "not_connected",
      checkedAt: new Date(0).toISOString(),
      schedule: [],
      unread: [],
    },
    timezoneConfirmed: true,
    honorific,
    timezone,
    connectedDataSources: [],
  };
}

function isMirroredCalComBooking(
  booking: CalComBooking,
  events: CalendarEvent[],
): boolean {
  if (!booking.startTime || !booking.endTime) return false;
  return events.some((event) => {
    if (event.allDay || !event.start || !event.end) return false;
    return meetingsLikelySame(
      {
        title: booking.title,
        start: booking.startTime,
        end: booking.endTime,
        attendees: booking.attendees.map((attendee) => attendee.email),
      },
      {
        title: event.title,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
      },
    );
  });
}

function meetingCountPhrase(
  calendar: Awaited<ReturnType<GoogleService["listEvents"]>> | undefined,
  count: number,
  calComConnected: boolean,
): string {
  if (!calendar?.connected && !calComConnected) {
    return calendar ? "Calendar not connected." : "Calendar unavailable right now.";
  }
  if (count === 0) return "No meetings today.";
  return `${count} meeting${count === 1 ? "" : "s"} today.`;
}

function startOfDay(d: Date, timezone: string): Date {
  return zonedTimeToUtc(d, timezone, 0, 0);
}

function endOfDay(d: Date, timezone: string): Date {
  return new Date(zonedTimeToUtc(d, timezone, 23, 59).getTime() + 59_999);
}

function fmtTime(iso: string | undefined, timezone: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}...`;
}

function bulletList(items: BriefItem[]): string {
  return items.map((item) => `- ${item.text.replace(/\n/g, "\n  ")}`).join("\n");
}

function numberedList(items: BriefItem[]): string {
  return items.map((item, index) => `${index + 1}. ${item.text.replace(/\n/g, "\n   ")}`).join("\n");
}

function stringMetadata(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

function booleanMetadata(metadata: Record<string, unknown>, key: string): boolean {
  return metadata[key] === true || metadata[key] === "true";
}

function emailSubject(hit: EmailMemory): string {
  const direct = stringMetadata(hit.metadata ?? {}, "subject");
  if (direct) return cleanLine(direct);
  const legacy = hit.summary.match(/^Email from .+? \((.+?)\):/i)?.[1];
  return cleanLine(legacy ?? "Important email");
}

function emailSender(hit: EmailMemory): string {
  const metadata = hit.metadata ?? {};
  const preferred =
    stringMetadata(metadata, "person") ||
    stringMetadata(metadata, "serviceName") ||
    stringMetadata(metadata, "from");
  const legacy = hit.summary.match(/^Email from (.+?)(?: \(|:)/i)?.[1];
  return friendlySender(preferred || legacy || "Sender");
}

function friendlySender(value: string): string {
  const display = value.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  if (display) return cleanLine(display);

  const email = value.match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+)/i);
  if (email?.[1]) {
    const domain = email[1].split(".")[0] ?? "Sender";
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  return cleanLine(value.replace(/^"|"$/g, "")) || "Sender";
}

function emailAction(
  metadata: Record<string, unknown>,
  category: string,
  sender: string,
): string {
  const extracted = stringMetadata(metadata, "action");
  if (extracted) return ensureSentence(extracted);

  switch (category) {
    case "account_alert":
      return `Review the ${sender} account notice today.`;
    case "payment_due":
      return `Review the payment details and due date.`;
    case "meeting_request":
      return `Review the proposed time and reply with availability.`;
    case "investor_update":
      return `Review the update and prepare a reply.`;
    case "follow_up_needed":
      return `Reply to ${sender}.`;
    case "general_high":
    case "general_medium":
      return booleanMetadata(metadata, "requiresReply")
        ? `Reply to ${sender}.`
        : `Review this email today.`;
    default:
      return `Review this email today.`;
  }
}

function cleanLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function cleanSentence(value: string, max: number): string {
  const cleaned = cleanLine(value).replace(/^[\s!⚠️•*-]+/u, "");
  if (cleaned.length <= max) return ensureSentence(cleaned);
  const clipped = cleaned.slice(0, max + 1);
  const boundary = clipped.lastIndexOf(" ");
  return ensureSentence(clipped.slice(0, boundary >= Math.floor(max * 0.65) ? boundary : max));
}

function ensureSentence(value: string): string {
  const cleaned = cleanLine(value).replace(/[.;,:\s]+$/, "");
  if (!cleaned) return "Review this email today.";
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}.`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise
      .then((value) => resolve(value))
      .catch((error: unknown) => reject(error))
      .finally(() => clearTimeout(timer));
  });
}
