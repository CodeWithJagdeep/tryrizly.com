import { Inject, Injectable } from "@nestjs/common";
import {
  EMPTY_LIVE,
  type HeyRizContextRequest,
  type HeyRizRuntimeContext,
  type LiveContext,
} from "./context.types";
import { ConnectorService } from "../connectors/connector.service";
import { GoogleService } from "../google/google.service";
import { primaryUpdatesInboxQuery } from "../google/gmail-search";
import { VectorMemoryService } from "../memory/vector-memory.service";
import { UserPreferencesRepository } from "../preferences/user-preferences.repository";
import { zonedTimeToUtc } from "../lib/timezone";
import { logger } from "@heyriz/shared/logger";
import type { AgentContextScope } from "../skills/agent-skill.types";

const LIVE_TIMEOUT_MS = 3000;

@Injectable()
export class ContextService {
  constructor(
    @Inject(VectorMemoryService)
    private readonly vectorMemory: VectorMemoryService,
    @Inject(UserPreferencesRepository)
    private readonly preferences: UserPreferencesRepository,
    @Inject(ConnectorService)
    private readonly connectors: ConnectorService,
    @Inject(GoogleService)
    private readonly google: GoogleService,
  ) {}

  async build(
    input: HeyRizContextRequest,
    options?: { scopes?: readonly AgentContextScope[] },
  ): Promise<HeyRizRuntimeContext> {
    const [timezone, honorific, principalName, timezoneConfirmed, language] =
      await Promise.all([
        this.preferences.getTimezone(input.userId),
        this.preferences.getHonorific(input.userId),
        this.preferences.getDisplayName(input.userId),
        this.preferences.hasExplicitTimezone(input.userId),
        this.preferences.getLanguage(input.userId),
      ]);
    const query = [input.message, input.contactName, input.topic]
      .filter(Boolean)
      .join(" ");
    const scoped = Boolean(options?.scopes);
    const wants = (scope: AgentContextScope) =>
      !scoped || options?.scopes?.includes(scope) === true;

    // The router selects expensive context before prompt assembly. Non-agent
    // callers omit scopes and retain the legacy full context behavior.
    const [semantic, live, connected] = await Promise.all([
      query && wants("memory")
        ? this.vectorMemory.search({ userId: input.userId, query, limit: 8 })
        : Promise.resolve([]),
      input.source === "telegram" &&
      (wants("live_calendar") || wants("live_inbox"))
        ? this.fetchLive(input.userId, timezone, {
            calendar: wants("live_calendar"),
            inbox: wants("live_inbox"),
          })
        : Promise.resolve(EMPTY_LIVE),
      wants("connectors")
        ? this.connectors.list(input.userId)
        : Promise.resolve([]),
    ]);

    const connectedDataSources = connected
      .filter((c) => c.status === "connected")
      .map((c) => c.provider);

    return {
      userId: input.userId,
      source: input.source,
      currentMessage: input.message,
      structured: {
        activeDeals: [],
        preferences: [
          `honorific:${honorific}`,
          `timezone:${timezone}`,
          ...(principalName ? [`displayName:${principalName}`] : []),
          ...(language ? [`language:${language}`] : []),
        ],
        pendingStates: [],
      },
      semantic,
      live,
      honorific,
      principalName,
      timezone,
      timezoneConfirmed,
      language,
      connectedDataSources,
    };
  }

  /**
   * Today's calendar + current unread inbox, fetched live so the agent has
   * ground truth in-context every turn. Both calls run in parallel with a hard
   * timeout and degrade to empty — a slow/failed Google call must never block
   * or break a chat reply (the agent can still call the tools on demand).
   */
  private async fetchLive(
    userId: string,
    timezone: string,
    selection: { calendar: boolean; inbox: boolean },
  ): Promise<LiveContext> {
    const now = new Date();
    const timeMin = zonedTimeToUtc(now, timezone, 0, 0);
    const timeMax = new Date(zonedTimeToUtc(now, timezone, 23, 59).getTime() + 59_999);

    const [cal, inbox] = await Promise.allSettled([
      selection.calendar
        ? withTimeout(
            this.google.listEvents(userId, { timeMin, timeMax, maxResults: 12 }),
            LIVE_TIMEOUT_MS,
          )
        : Promise.resolve(undefined),
      selection.inbox
        ? withTimeout(
            this.google.listThreads(userId, {
              q: primaryUpdatesInboxQuery("is:unread newer_than:3d"),
              maxResults: 8,
            }),
            LIVE_TIMEOUT_MS,
          )
        : Promise.resolve(undefined),
    ]);

    const live: LiveContext = {
      connected: false,
      calendarConnected: false,
      inboxConnected: false,
      calendarStatus: "not_connected",
      inboxStatus: "not_connected",
      checkedAt: new Date().toISOString(),
      schedule: [],
      unread: [],
    };

    if (cal.status === "fulfilled" && cal.value?.connected) {
      live.connected = true;
      live.calendarConnected = true;
      live.calendarStatus = "fresh";
      for (const e of cal.value.events) {
        live.schedule.push({ title: e.title, start: e.start, end: e.end, allDay: e.allDay });
      }
    } else if (selection.calendar && cal.status === "rejected") {
      live.calendarStatus = "unavailable";
      logger.warn("context: live calendar fetch failed", { error: String(cal.reason) });
    }

    if (inbox.status === "fulfilled" && inbox.value?.connected) {
      live.connected = true;
      live.inboxConnected = true;
      live.inboxStatus = "fresh";
      for (const m of inbox.value.messages) {
        live.unread.push({ from: m.from, subject: m.subject });
      }
    } else if (selection.inbox && inbox.status === "rejected") {
      live.inboxStatus = "unavailable";
      logger.warn("context: live inbox fetch failed", { error: String(inbox.reason) });
    }

    return live;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}
