import type { ConnectorService } from "../connectors/connector.service";
import type { DiscordService } from "../connectors/discord.service";
import type { NotionService } from "../connectors/notion.service";
import type { SlackService } from "../connectors/slack.service";
import type { GoogleService } from "../google/google.service";
import { primaryUpdatesInboxQuery } from "../google/gmail-search";
import type {
  SourceEvidence,
  SourceReceiptRepository,
} from "../intelligence/source-receipt.repository";
import type { HeyRizTool } from "./tool.types";

const SOURCES = ["slack", "discord", "notion", "gmail", "calendar"] as const;
type UpdateSource = (typeof SOURCES)[number];

type SourceUpdatesPayload = {
  query?: string;
  sources?: UpdateSource[];
  days?: number;
  limit?: number;
  onlyNew?: boolean;
};

type Coverage = {
  source: UpdateSource;
  status: "checked" | "not_connected" | "limited" | "error";
  count: number;
  note?: string;
};

export function createSourceUpdatesTool(
  connectors: ConnectorService,
  google: GoogleService,
  slack: SlackService,
  notion: NotionService,
  discord: DiscordService,
  receipts: SourceReceiptRepository,
): HeyRizTool<SourceUpdatesPayload> {
  return {
    name: "source_updates",
    category: "business",
    description:
      "Search recent evidence across connected Slack, Discord, Notion, Gmail, and Calendar, order it by time, and identify what is new, updated, or already reported. Use for ambiguous questions such as 'what is going on with the announcement?', 'what changed?', or 'find the latest update across my connected apps'. Optional query, sources, days (default 14), limit (default 12), and onlyNew.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const query = payload.query?.trim().slice(0, 200);
      const days = Math.min(Math.max(integer(payload.days, 14), 1), 90);
      const limit = Math.min(Math.max(integer(payload.limit, 12), 1), 25);
      const requested = normalizeSources(payload.sources);
      const oldest = new Date(Date.now() - days * 86_400_000);
      const newest = new Date(Date.now() + 30 * 86_400_000);

      const settled = await Promise.all(
        requested.map(async (source) => {
          try {
            return await fetchSource(source, {
              userId,
              query,
              oldest,
              newest,
              connectors,
              google,
              slack,
              notion,
              discord,
            });
          } catch (error) {
            return {
              evidence: [] as SourceEvidence[],
              coverage: {
                source,
                status: "error" as const,
                count: 0,
                note: safeError(error),
              },
            };
          }
        }),
      );

      const coverage = settled.map((entry) => entry.coverage);
      const ranked = settled
        .flatMap((entry) => entry.evidence)
        .filter((item) => Number.isFinite(Date.parse(item.timestamp)))
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, limit);
      const classified = await receipts.classifyAndMark(userId, ranked);
      const visible = payload.onlyNew
        ? classified.filter((item) => item.deliveryState !== "already_reported")
        : classified;

      const checkedAt = new Date().toISOString();
      const message = renderUpdateBrief(
        visible,
        coverage,
        context.timezone,
        query,
        days,
        context.honorific,
      );
      return {
        tool: "source_updates",
        status: "ok",
        message,
        data: {
          query: query ?? null,
          checkedAt,
          windowDays: days,
          evidence: visible,
          coverage,
          counts: {
            new: visible.filter((item) => item.deliveryState === "new").length,
            updated: visible.filter((item) => item.deliveryState === "updated").length,
            alreadyReported: visible.filter((item) => item.deliveryState === "already_reported").length,
          },
        },
      };
    },
  };
}

async function fetchSource(
  source: UpdateSource,
  input: {
    userId: string;
    query?: string;
    oldest: Date;
    newest: Date;
    connectors: ConnectorService;
    google: GoogleService;
    slack: SlackService;
    notion: NotionService;
    discord: DiscordService;
  },
): Promise<{ evidence: SourceEvidence[]; coverage: Coverage }> {
  if (source === "slack") {
    const secret = await input.connectors.getSlackSecret(input.userId);
    if (!secret) return unavailable(source);
    const messages = await input.slack.getRecentMessages(secret, {
      query: input.query,
      oldest: input.oldest,
      limit: 20,
    });
    const evidence = messages.map((message): SourceEvidence => ({
      key: `slack:${message.channelId ?? message.channel ?? "unknown"}:${message.ts}`,
      source,
      title: `#${message.channel ?? "channel"}: ${clip(clean(message.text), 100) || "Message"}`,
      excerpt: clip(clean(message.text), 360),
      timestamp: slackTimestamp(message.ts),
      url: message.permalink,
      author: message.userName,
      location: message.channel ? `#${message.channel}` : undefined,
    }));
    return checked(source, evidence);
  }

  if (source === "discord") {
    const secret = await input.connectors.getDiscordSecret(input.userId);
    if (!secret) return unavailable(source);
    if (!secret.botToken || !secret.channelId) {
      return {
        evidence: [],
        coverage: {
          source,
          status: "limited",
          count: 0,
          note: "connected for webhook posting only; add a bot token and channel ID for read access",
        },
      };
    }
    const messages = (await input.discord.getChannelMessages(secret, 50))
      .filter((message) => Date.parse(message.timestamp) >= input.oldest.getTime())
      .filter((message) => !input.query || matchesQuery(message.content, input.query))
      .slice(0, 20);
    const evidence = messages.map((message): SourceEvidence => ({
      key: `discord:${message.id}`,
      source,
      title: `${message.channelName ? `#${message.channelName}: ` : ""}${clip(clean(message.content), 100) || "Message"}`,
      excerpt: clip(clean(message.content), 360),
      timestamp: message.timestamp,
      url: message.url,
      author: message.author,
      location: message.channelName ? `#${message.channelName}` : message.channelId,
    }));
    return checked(source, evidence);
  }

  if (source === "notion") {
    const secret = await input.connectors.getNotionSecret(input.userId);
    if (!secret) return unavailable(source);
    const pages = await input.notion.search(secret, input.query ?? "");
    const pageContent = await Promise.all(
      pages.slice(0, 5).map((page) => input.notion.getPageContent(secret, page.id).catch(() => "")),
    );
    const evidence = pages
      .filter((page) => Date.parse(page.lastEdited) >= input.oldest.getTime())
      .map((page, index): SourceEvidence => ({
        key: `notion:${page.id}`,
        source,
        title: page.title,
        excerpt: clip(clean(pageContent[index] ?? ""), 360) || undefined,
        timestamp: page.lastEdited,
        url: page.url,
        location: "Notion",
      }));
    return checked(source, evidence);
  }

  if (source === "gmail") {
    const q = primaryUpdatesInboxQuery(
      `newer_than:${Math.max(1, Math.ceil((Date.now() - input.oldest.getTime()) / 86_400_000))}d${input.query ? ` ${gmailTerm(input.query)}` : ""}`,
    );
    const result = await input.google.listThreads(input.userId, { q, maxResults: 25 });
    if (!result.connected) return unavailable(source);
    const evidence = result.messages.map((message): SourceEvidence => ({
      key: `gmail:${message.id}`,
      source,
      title: message.subject || "Email update",
      excerpt: clip(clean(message.snippet), 360),
      timestamp: validTimestamp(message.date),
      author: message.from,
      location: "Gmail",
    }));
    return checked(source, evidence);
  }

  const result = await input.google.listEvents(input.userId, {
    timeMin: input.oldest,
    timeMax: input.newest,
    maxResults: 200,
  });
  if (!result.connected) return unavailable(source);
  const query = input.query?.toLowerCase();
  const events = result.events.filter(
    (event) =>
      !query || matchesQuery(`${event.title} ${event.description ?? ""} ${event.location ?? ""}`, query),
  );
  const evidence = events.map((event): SourceEvidence => ({
    key: `calendar:${event.id}`,
    source,
    title: event.title,
    excerpt: clip(clean(event.description ?? event.location ?? ""), 360) || undefined,
    timestamp: validTimestamp(event.start),
    url: event.hangoutLink,
    location: event.location ?? "Calendar",
  }));
  return checked(source, evidence);
}

function checked(source: UpdateSource, evidence: SourceEvidence[]) {
  return {
    evidence,
    coverage: { source, status: "checked" as const, count: evidence.length },
  };
}

function unavailable(source: UpdateSource) {
  return {
    evidence: [] as SourceEvidence[],
    coverage: { source, status: "not_connected" as const, count: 0 },
  };
}

function renderUpdateBrief(
  evidence: Array<SourceEvidence & { deliveryState: "new" | "updated" | "already_reported" }>,
  coverage: Coverage[],
  timezone: string,
  query: string | undefined,
  days: number,
  honorific: string,
): string {
  const checkedSources = coverage.filter((entry) => entry.status === "checked").map((entry) => entry.source);
  const gaps = coverage
    .filter((entry) => entry.status !== "checked")
    .map((entry) => `${entry.source}: ${entry.note ?? entry.status.replaceAll("_", " ")}`);
  if (evidence.length === 0) {
    return [
      `I checked ${checkedSources.join(", ") || "the requested sources"} for ${query ? `"${query}"` : "recent updates"} over ${days} days and found no matching evidence, ${honorific}.`,
      gaps.length ? `Coverage gaps: ${gaps.join("; ")}.` : "",
    ].filter(Boolean).join("\n");
  }

  const lines = evidence.map((item) => {
    const state = item.deliveryState === "already_reported" ? "ALREADY REPORTED" : item.deliveryState.toUpperCase();
    const by = item.author ? ` · ${item.author}` : "";
    return `• [${state}] ${item.source} · ${formatTime(item.timestamp, timezone)}${by}\n  ${item.title}${item.url ? `\n  ${item.url}` : ""}`;
  });
  return [
    `Latest ${query ? `"${query}" ` : ""}updates · checked ${checkedSources.join(", ") || "requested sources"}`,
    lines.join("\n\n"),
    gaps.length ? `Coverage gaps: ${gaps.join("; ")}.` : "",
  ].filter(Boolean).join("\n\n");
}

function normalizeSources(value: UpdateSource[] | undefined): UpdateSource[] {
  if (!Array.isArray(value) || value.length === 0) return [...SOURCES];
  return [...new Set(value.filter((source): source is UpdateSource => SOURCES.includes(source)))];
}

function integer(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.trunc(value as number) : fallback;
}

function clean(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function clip(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function slackTimestamp(value: string): string {
  const seconds = Number(value.split(".")[0]);
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : new Date(0).toISOString();
}

function validTimestamp(value: string | undefined): string {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date(0).toISOString();
}

function formatTime(value: string, timezone: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function gmailTerm(value: string): string {
  return value.replace(/["{}()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

function matchesQuery(text: string, query: string): boolean {
  const terms = query.toLowerCase().match(/[a-z0-9_-]{2,}/g) ?? [];
  if (terms.length === 0) return true;
  const haystack = text.toLowerCase();
  const matches = terms.filter((term) => haystack.includes(term)).length;
  return matches >= Math.max(1, Math.ceil(terms.length * 0.6));
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/auth|token|forbidden|401|403/i.test(message)) return "connection needs attention";
  return "temporarily unavailable";
}
