import { Inject, Injectable } from "@nestjs/common";
import { enqueueReminder } from "@heyriz/shared/queue/queues";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { ConnectorService } from "../connectors/connector.service";
import type { DataSourceProvider } from "../connectors/connector.types";
import { MongoIntrospectionService } from "../connectors/mongo-introspection.service";
import { PostgresIntrospectionService } from "../connectors/postgres-introspection.service";
import { RazorpayService } from "../connectors/razorpay.service";
import { TextToQueryService } from "../connectors/text-to-query.service";
import { UserPreferencesRepository } from "../preferences/user-preferences.repository";

const ANOMALY_HIGH_RATIO = 1.5;
const ANOMALY_LOW_RATIO = 0.5;
const ANOMALY_MIN_BASELINE = 3;

type CountWindow = { label: string; sinceDaysAgo: number; untilDaysAgo: number };
type SignupCounts = Record<string, number>;

/**
 * Business-intelligence digests: a weekly trend summary and a daily anomaly
 * scan over whatever Postgres/MongoDB/Razorpay sources the principal has
 * connected. Degrades silently per-source (no source connected = that line
 * just doesn't appear) rather than failing the whole digest.
 */
@Injectable()
export class DigestService {
  constructor(
    @Inject(ConnectorService)
    private readonly connectors: ConnectorService,
    @Inject(PostgresIntrospectionService)
    private readonly postgres: PostgresIntrospectionService,
    @Inject(MongoIntrospectionService)
    private readonly mongo: MongoIntrospectionService,
    @Inject(RazorpayService)
    private readonly razorpay: RazorpayService,
    @Inject(TextToQueryService)
    private readonly textToQuery: TextToQueryService,
    @Inject(UserPreferencesRepository)
    private readonly preferences: UserPreferencesRepository,
  ) {}

  async weeklyDigest(userId = env.DEFAULT_USER_ID) {
    if (!env.BACKGROUND_AI_ENABLED) {
      return { sent: false, reason: "background_ai_disabled" as const };
    }
    const honorific = await this.preferences.getHonorific(userId);
    const connected = await this.connectedSources(userId);

    const signups = await this.signupCounts(userId, connected, [
      { label: "thisWeek", sinceDaysAgo: 7, untilDaysAgo: 0 },
      { label: "lastWeek", sinceDaysAgo: 14, untilDaysAgo: 7 },
    ]).catch((error: unknown) => {
      logger.warn("weekly digest: signup counts failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    });

    const revenue = connected.has("razorpay")
      ? await this.razorpayWindowStats(userId, 0, 7).catch((error: unknown) => {
          logger.warn("weekly digest: razorpay stats failed", {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
          return undefined;
        })
      : undefined;

    const lines: string[] = [];
    if (signups) {
      lines.push(
        `Signups: ${signups.thisWeek} this week (${trendWord(signups.thisWeek, signups.lastWeek)} from ${signups.lastWeek} last week).`,
      );
    }
    if (revenue) {
      lines.push(
        `Revenue: ₹${formatInr(revenue.captured)} captured, ${revenue.failedCount} failed payment${revenue.failedCount === 1 ? "" : "s"}.`,
      );
    }

    if (lines.length === 0) {
      return { sent: false, reason: "no_data_sources" as const };
    }

    const text = `Morning, ${honorific}. Week in review:\n${lines.map((l) => `- ${l}`).join("\n")}`;
    await enqueueReminder({
      userId,
      message: text,
      runAt: new Date().toISOString(),
      source: "manual",
      dedupeKey: `digest:week:${userId}:${weekKey(new Date())}`,
      metadata: { kind: "weekly_digest" },
    });

    return { sent: true, text };
  }

  async dailyAnomalyCheck(userId = env.DEFAULT_USER_ID) {
    if (!env.BACKGROUND_AI_ENABLED) {
      return { sent: false, reason: "background_ai_disabled" as const };
    }
    const honorific = await this.preferences.getHonorific(userId);
    const connected = await this.connectedSources(userId);
    const alerts: string[] = [];

    const signups = await this.signupCounts(userId, connected, [
      { label: "today", sinceDaysAgo: 1, untilDaysAgo: 0 },
      { label: "priorWeek", sinceDaysAgo: 8, untilDaysAgo: 1 },
    ]).catch((error: unknown) => {
      logger.warn("daily anomaly: signup counts failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    });

    if (signups) {
      const avg = signups.priorWeek / 7;
      const flag = anomalyFlag(signups.today, avg);
      if (flag) {
        alerts.push(
          `Signups: ${signups.today} today vs ~${avg.toFixed(1)} average — ${flag} spike/drop.`,
        );
      }
    }

    if (connected.has("razorpay")) {
      const today = await this.razorpayWindowStats(userId, 0, 1).catch(() => undefined);
      const priorWeek = await this.razorpayWindowStats(userId, 1, 8).catch(() => undefined);
      if (today && priorWeek) {
        const avgFailed = priorWeek.failedCount / 7;
        const flag = anomalyFlag(today.failedCount, avgFailed);
        if (flag) {
          alerts.push(
            `Failed payments: ${today.failedCount} today vs ~${avgFailed.toFixed(1)} average — ${flag}.`,
          );
        }
      }
    }

    if (alerts.length === 0) {
      return { sent: false, reason: "no_anomaly" as const };
    }

    const text = `${honorific}, something's off pace:\n${alerts.map((l) => `- ${l}`).join("\n")}`;
    await enqueueReminder({
      userId,
      message: text,
      runAt: new Date().toISOString(),
      source: "manual",
      dedupeKey: `digest:anomaly:${userId}:${dayKey(new Date())}`,
      metadata: { kind: "anomaly_alert" },
    });

    return { sent: true, text };
  }

  private async connectedSources(userId: string): Promise<Set<DataSourceProvider>> {
    const accounts = await this.connectors.list(userId);
    return new Set(
      accounts
        .filter((c) => c.status === "connected" && isDataSourceProvider(c.provider))
        .map((c) => c.provider as DataSourceProvider),
    );
  }

  /** Counts rows per window from whichever of Postgres/Mongo is connected (Postgres preferred). */
  private async signupCounts(
    userId: string,
    connected: Set<DataSourceProvider>,
    windows: CountWindow[],
  ): Promise<SignupCounts | undefined> {
    if (connected.has("postgres")) {
      return this.signupCountsPostgres(userId, windows);
    }
    if (connected.has("mongodb")) {
      return this.signupCountsMongo(userId, windows);
    }
    return undefined;
  }

  private async signupCountsPostgres(
    userId: string,
    windows: CountWindow[],
  ): Promise<SignupCounts | undefined> {
    const secret = await this.connectors.getDataSourceSecret(userId, "postgres");
    if (!secret.connected || secret.provider !== "postgres") return undefined;

    const schema = await this.postgres.getSchema(userId, secret.secret.connectionUrl);
    const columns = windows
      .map((w) => `${w.label} = count of rows created between ${w.untilDaysAgo} and ${w.sinceDaysAgo} days ago`)
      .join("; ");
    const question = [
      "Return exactly one row with these integer columns:",
      columns + ".",
      "Pick the single table that most likely represents new user signups",
      "(e.g. users, signups, accounts) and its created_at/timestamp column.",
    ].join(" ");

    const sql = await this.textToQuery.sqlFor(userId, question, schema);
    if (!sql) return undefined;

    const { rows } = await this.postgres.runReadOnlyQuery(secret.secret.connectionUrl, sql, [], schema);
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return undefined;

    return parseCounts(row, windows);
  }

  private async signupCountsMongo(
    userId: string,
    windows: CountWindow[],
  ): Promise<SignupCounts | undefined> {
    const secret = await this.connectors.getDataSourceSecret(userId, "mongodb");
    if (!secret.connected || secret.provider !== "mongodb") return undefined;

    const schema = await this.mongo.getSchema(userId, secret.secret.connectionUrl);
    const counts: SignupCounts = {};

    for (const w of windows) {
      const question = `Find documents created between ${w.untilDaysAgo} and ${w.sinceDaysAgo} days ago, in the collection most likely representing new user signups.`;
      const spec = await this.textToQuery.mongoSpecFor(userId, question, schema);
      if (!spec) return undefined;
      const { documents } = await this.mongo.runFind(secret.secret.connectionUrl, {
        ...spec,
        limit: 50,
      });
      // capped at 50 by runFind — undercounts beyond that, acceptable for early-stage volumes
      counts[w.label] = documents.length;
    }

    return counts;
  }

  private async razorpayWindowStats(
    userId: string,
    untilDaysAgo: number,
    sinceDaysAgo: number,
  ): Promise<{ captured: number; failedCount: number } | undefined> {
    const secret = await this.connectors.getDataSourceSecret(userId, "razorpay");
    if (!secret.connected || secret.provider !== "razorpay") return undefined;

    const now = Date.now();
    const from = Math.floor((now - sinceDaysAgo * 86_400_000) / 1000);
    const to = Math.floor((now - untilDaysAgo * 86_400_000) / 1000);

    const { items } = await this.razorpay.fetch(secret.secret, "payments", {
      from,
      to,
      count: 100,
    });

    let captured = 0;
    let failedCount = 0;
    for (const item of items) {
      const p = item as { status?: string; amount?: number };
      if (p.status === "captured") captured += p.amount ?? 0;
      if (p.status === "failed") failedCount += 1;
    }
    return { captured, failedCount };
  }
}

function isDataSourceProvider(provider: string): provider is DataSourceProvider {
  return provider === "postgres" || provider === "mongodb" || provider === "razorpay";
}

function parseCounts(row: Record<string, unknown>, windows: CountWindow[]): SignupCounts {
  const lowerRow = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  const counts: SignupCounts = {};
  for (const w of windows) {
    const value = lowerRow.get(w.label.toLowerCase());
    counts[w.label] = typeof value === "number" ? value : Number(value) || 0;
  }
  return counts;
}

function trendWord(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "up" : "flat";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "flat";
  return pct > 0 ? `up ${pct}%` : `down ${Math.abs(pct)}%`;
}

function anomalyFlag(value: number, baseline: number): "unusual high" | "unusual low" | undefined {
  if (baseline < ANOMALY_MIN_BASELINE) {
    return value >= ANOMALY_MIN_BASELINE * 2 ? "unusual high" : undefined;
  }
  const ratio = value / baseline;
  if (ratio >= ANOMALY_HIGH_RATIO) return "unusual high";
  if (ratio <= ANOMALY_LOW_RATIO) return "unusual low";
  return undefined;
}

function formatInr(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function weekKey(d: Date): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86_400_000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-w${week}`;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
