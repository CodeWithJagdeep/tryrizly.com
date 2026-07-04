import { Inject, Injectable } from "@nestjs/common";
import {
  EMPTY_LIVE,
  type HeyRizContextRequest,
  type HeyRizRuntimeContext,
  type LiveContext,
  type StructuredContext,
} from "./context.types";
import { ConnectorService } from "../connectors/connector.service";
import { GoogleService } from "../google/google.service";
import { primaryUpdatesInboxQuery } from "../google/gmail-search";
import { VectorMemoryService } from "../memory/vector-memory.service";
import { UserPreferencesRepository } from "../preferences/user-preferences.repository";
import { zonedTimeToUtc } from "../lib/timezone";
import { logger } from "@heyriz/shared/logger";

const DATA_SOURCE_PROVIDERS = new Set(["postgres", "mongodb", "razorpay", "stripe"]);
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

  async build(input: HeyRizContextRequest): Promise<HeyRizRuntimeContext> {
    const timezone = await this.preferences.getTimezone(input.userId);
    const query = [input.message, input.contactName, input.topic]
      .filter(Boolean)
      .join(" ");

    // Live calendar/inbox is only worth fetching for the interactive chat path;
    // background event ingestion doesn't need it and shouldn't pay the latency.
    const [semantic, live] = await Promise.all([
      query
        ? this.vectorMemory.search({ userId: input.userId, query, limit: 3 })
        : Promise.resolve([]),
      input.source === "telegram"
        ? this.fetchLive(input.userId, timezone)
        : Promise.resolve(EMPTY_LIVE),
    ]);

    const connected = await this.connectors.list(input.userId);
    const connectedDataSources = connected
      .filter((c) => c.status === "connected" && DATA_SOURCE_PROVIDERS.has(c.provider))
      .map((c) => c.provider);

    return {
      userId: input.userId,
      source: input.source,
      currentMessage: input.message,
      structured: await this.getStructuredContext(),
      semantic,
      live,
      honorific: await this.preferences.getHonorific(input.userId),
      principalName: await this.preferences.getDisplayName(input.userId),
      timezone,
      timezoneConfirmed: await this.preferences.hasExplicitTimezone(input.userId),
      language: await this.preferences.getLanguage(input.userId),
      connectedDataSources,
    };
  }

  /**
   * Today's calendar + current unread inbox, fetched live so the agent has
   * ground truth in-context every turn. Both calls run in parallel with a hard
   * timeout and degrade to empty — a slow/failed Google call must never block
   * or break a chat reply (the agent can still call the tools on demand).
   */
  private async fetchLive(userId: string, timezone: string): Promise<LiveContext> {
    const now = new Date();
    const timeMin = zonedTimeToUtc(now, timezone, 0, 0);
    const timeMax = new Date(zonedTimeToUtc(now, timezone, 23, 59).getTime() + 59_999);

    const [cal, inbox] = await Promise.allSettled([
      withTimeout(
        this.google.listEvents(userId, { timeMin, timeMax, maxResults: 12 }),
        LIVE_TIMEOUT_MS,
      ),
      withTimeout(
        this.google.listThreads(userId, {
          q: primaryUpdatesInboxQuery("is:unread newer_than:3d"),
          maxResults: 8,
        }),
        LIVE_TIMEOUT_MS,
      ),
    ]);

    const live: LiveContext = { connected: false, schedule: [], unread: [] };

    if (cal.status === "fulfilled" && cal.value.connected) {
      live.connected = true;
      for (const e of cal.value.events) {
        live.schedule.push({ title: e.title, start: e.start, end: e.end, allDay: e.allDay });
      }
    } else if (cal.status === "rejected") {
      logger.warn("context: live calendar fetch failed", { error: String(cal.reason) });
    }

    if (inbox.status === "fulfilled" && inbox.value.connected) {
      live.connected = true;
      for (const m of inbox.value.messages) {
        live.unread.push({ from: m.from, subject: m.subject });
      }
    } else if (inbox.status === "rejected") {
      logger.warn("context: live inbox fetch failed", { error: String(inbox.reason) });
    }

    return live;
  }

  private async getStructuredContext(): Promise<StructuredContext> {
    return {
      activeDeals: [],
      preferences: [],
      pendingStates: [],
    };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}
