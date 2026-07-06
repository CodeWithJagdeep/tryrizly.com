import { Inject, Injectable } from "@nestjs/common";
import { BudgetGateService } from "../billing/budget-gate.service";
import { CalComService, type CalComBooking } from "../connectors/calcom.service";
import { ConnectorService } from "../connectors/connector.service";
import { GoogleService } from "../google/google.service";
import type { CalendarEvent } from "../google/google.types";
import { LlmRouterService } from "../llm/llm-router.service";
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

const MIN = 60_000;
const MEMORY_TIMEOUT_MS = 800;

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
    @Inject(LlmRouterService)
    private readonly llm: LlmRouterService,
    @Inject(TaskRepository)
    private readonly tasks: TaskRepository,
    @Inject(UserPreferencesRepository)
    private readonly preferences: UserPreferencesRepository,
    @Inject(EventIngestService)
    private readonly eventIngest: EventIngestService,
    @Inject(DecisionService)
    private readonly decisions: DecisionService,
    @Inject(BudgetGateService)
    private readonly budgetGate: BudgetGateService,
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
    const eventLines = await Promise.all(
      events.map((event) => this.enrichEventLine(userId, event, timezone)),
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
    const calComLines = calComBookings.map((booking) => this.enrichCalComLine(booking, timezone));

    const openTasks = await this.tasks.listOpen(userId).catch((error: unknown) => {
      logger.warn("morning brief task fetch failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    });
    const pendingEmails = env.BACKGROUND_AI_ENABLED
      ? await this.vectorMemory
          .search({
            userId,
            query: "high priority email needs reply follow up",
            limit: 5,
            source: "gmail",
          })
          .catch((error: unknown) => {
            logger.warn("morning brief email memory fetch failed", {
              userId,
              error: error instanceof Error ? error.message : String(error),
            });
            return [];
          })
      : [];
    const metricsLine = await this.metricsLine(userId, honorific, timezone);

    const header = `Good morning, ${honorific}. ${meetingCountPhrase(calendar, events.length + calComBookings.length, Boolean(calComAuth))}`;

    const bullets = [
      ...(calendar?.connected ? eventLines : []),
      ...calComLines,
      ...openTasks.slice(0, 5).map((task) => `Task: ${task.summary}`),
      ...pendingEmails.slice(0, 3).map((hit) => truncate(hit.summary, 80)),
      ...(metricsLine ? [metricsLine] : []),
    ];

    const baseText =
      bullets.length === 0
        ? `${header}\n\nNothing flagged.`
        : `${header}\n\n${bullets.map((b) => `- ${b}`).join("\n")}`;

    const suggestions = await this.suggestNextActions(userId, baseText);
    const text = suggestions
      ? `${baseText}\n\nSuggested: ${suggestions}`
      : `${baseText}\n\nNothing needs action.`;

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
          text: `${honorific}, "${event.title}" has started and I don't see you in it yet - want me to open the link?${join}`,
        },
      ];

      for (const plan of plans) {
        if (plan.at <= Date.now()) continue;
        await enqueueReminder({
          userId,
          message: plan.text,
          runAt: new Date(plan.at).toISOString(),
          source: "calendar",
          dedupeKey: `meet:${event.id}:${plan.kind}`,
          metadata: { kind: `meeting_${plan.kind}`, meetingId: event.id },
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
          text: `${honorific}, "${booking.title}" has started and I don't see you in it yet - want me to open the link?${join}`,
        },
      ];

      for (const plan of plans) {
        if (plan.at <= Date.now()) continue;
        await enqueueReminder({
          userId,
          message: plan.text,
          runAt: new Date(plan.at).toISOString(),
          source: "calcom",
          dedupeKey: `calcom-meet:${meetingId}:${plan.kind}`,
          metadata: { kind: `meeting_${plan.kind}`, meetingId },
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

  private async enrichEventLine(
    userId: string,
    event: CalendarEvent,
    timezone: string,
  ): Promise<string> {
    if (event.allDay) return `all-day ${event.title}`;
    // Already-finished events are marked "(completed)" rather than listed as
    // if still open — relevant when the brief is re-run later in the day.
    const endMs = Date.parse(event.end ?? event.start ?? "");
    if (!Number.isNaN(endMs) && endMs < Date.now()) {
      return `${event.title} (completed)`;
    }
    return `${fmtTime(event.start, timezone)} ${event.title}`;
  }

  private enrichCalComLine(booking: CalComBooking, timezone: string): string {
    const endMs = Date.parse(booking.endTime ?? booking.startTime ?? "");
    if (!Number.isNaN(endMs) && endMs < Date.now()) {
      return `${booking.title} (completed) [Cal.com]`;
    }
    return `${fmtTime(booking.startTime, timezone)} ${booking.title} [Cal.com]`;
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

  private async suggestNextActions(userId: string, briefText: string): Promise<string | undefined> {
    if (!env.BACKGROUND_AI_ENABLED) return undefined;
    if (!this.llm.hasProvider()) return undefined;
    const budget = await this.budgetGate.check(userId);
    if (budget.state === "exceeded") return undefined;
    try {
      const raw = await this.llm.complete({
        task: "brief",
        userId,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Suggest 1-2 concrete next actions for a founder's morning brief, or reply NONE. Return one concise sentence, no markdown.",
          },
          { role: "user", content: briefText },
        ],
      });
      const text = raw?.trim();
      if (!text || /^none\.?$/i.test(text)) return undefined;
      return text;
    } catch (error) {
      logger.warn("morning brief suggestions skipped", {
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
    live: { connected: false, schedule: [], unread: [] },
    timezoneConfirmed: true,
    honorific,
    timezone,
    connectedDataSources: [],
  };
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise
      .then((value) => resolve(value))
      .catch((error: unknown) => reject(error))
      .finally(() => clearTimeout(timer));
  });
}
