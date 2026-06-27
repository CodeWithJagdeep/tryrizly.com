import { Inject, Injectable } from "@nestjs/common";
import { ConnectorRepository } from "../connectors/connector.repository";
import { ConnectorVaultService } from "../connectors/connector-vault.service";
import type {
  ConnectedAccount,
  ConnectorSecretPayload,
} from "../connectors/connector.types";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  GmailMessage,
  GmailThreadSummary,
  GoogleResult,
  SendOrDraftInput,
  UpdateCalendarEventInput,
} from "./google.types";
import { primaryUpdatesInboxQuery } from "./gmail-search";

type GoogleTokens = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
};

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * The single bridge between HeyRiz and Google. Stored OAuth tokens are decrypted
 * from the connector vault, refreshed on demand, and used to call Gmail/Calendar.
 * Every public method degrades to `{ connected: false }` instead of throwing when
 * the user has not connected Google, so tools and the agent loop stay resilient.
 */
@Injectable()
export class GoogleService {
  constructor(
    @Inject(ConnectorRepository)
    private readonly repository: ConnectorRepository,
    @Inject(ConnectorVaultService)
    private readonly vault: ConnectorVaultService,
  ) {}

  async isConnected(userId: string, provider: "gmail" | "calendar"): Promise<boolean> {
    const account = await this.findAccount(userId, provider);
    return Boolean(account);
  }

  // --- Calendar -----------------------------------------------------------

  async listEvents(
    userId: string,
    range: { timeMin: Date; timeMax: Date; maxResults?: number },
  ): Promise<GoogleResult<{ events: CalendarEvent[] }>> {
    const params = new URLSearchParams({
      timeMin: range.timeMin.toISOString(),
      timeMax: range.timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(range.maxResults ?? 25),
    });

    const res = await this.gfetch(
      userId,
      "calendar",
      `${CALENDAR_BASE}/calendars/primary/events?${params.toString()}`,
    );
    if (!res.connected) return res;

    const data = (await res.response.json()) as {
      items?: GoogleCalendarItem[];
    };
    const events = (data.items ?? []).map(toCalendarEvent);
    return { connected: true, events };
  }

  async createEvent(
    userId: string,
    input: CreateCalendarEventInput,
  ): Promise<GoogleResult<{ event: CalendarEvent }>> {
    const timeZone = input.timeZone ?? "UTC";
    const body = {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start, timeZone },
      end: { dateTime: input.end, timeZone },
      attendees: input.attendees?.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `heyriz-${userId}-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const res = await this.gfetch(
      userId,
      "calendar",
      `${CALENDAR_BASE}/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1`,
      { method: "POST", body: JSON.stringify(body) },
    );
    if (!res.connected) return res;

    const item = (await res.response.json()) as GoogleCalendarItem;
    return { connected: true, event: toCalendarEvent(item) };
  }

  async updateEvent(
    userId: string,
    eventId: string,
    patch: UpdateCalendarEventInput,
  ): Promise<GoogleResult<{ event: CalendarEvent }>> {
    const timeZone = patch.timeZone ?? "UTC";
    const body: Record<string, unknown> = {};
    if (patch.start) body.start = { dateTime: patch.start, timeZone };
    if (patch.end) body.end = { dateTime: patch.end, timeZone };
    if (patch.attendees) body.attendees = patch.attendees.map((email) => ({ email }));

    const sendUpdates = patch.notifyAttendee === false ? "none" : "all";
    const res = await this.gfetch(
      userId,
      "calendar",
      `${CALENDAR_BASE}/calendars/primary/events/${eventId}?sendUpdates=${sendUpdates}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    if (!res.connected) return res;

    const item = (await res.response.json()) as GoogleCalendarItem;
    return { connected: true, event: toCalendarEvent(item) };
  }

  // --- Contacts (via People API + Gmail search) ---------------------------

  async searchContacts(
    userId: string,
    name: string,
  ): Promise<GoogleResult<{ contacts: Array<{ name: string; email: string; source: string }> }>> {
    const found = new Map<string, { name: string; email: string; source: string }>();

    // 1. People API — primary contacts directory
    const peopleParams = new URLSearchParams({
      query: name,
      readMask: "names,emailAddresses",
      pageSize: "5",
    });
    const peopleRes = await this.gfetch(
      userId,
      "gmail",
      `https://people.googleapis.com/v1/people:searchContacts?${peopleParams.toString()}`,
    );
    if (peopleRes.connected) {
      const data = (await peopleRes.response.json()) as {
        results?: Array<{
          person?: {
            names?: Array<{ displayName?: string }>;
            emailAddresses?: Array<{ value?: string }>;
          };
        }>;
      };
      for (const r of data.results ?? []) {
        const displayName = r.person?.names?.[0]?.displayName ?? name;
        for (const ea of r.person?.emailAddresses ?? []) {
          if (ea.value) {
            found.set(ea.value, { name: displayName, email: ea.value, source: "contacts" });
          }
        }
      }
    }

    // 2. Gmail search — scan recent mail to/from this name for email addresses
    if (found.size < 3) {
      const q = `(from:"${name}" OR to:"${name}") newer_than:180d`;
      const gmailParams = new URLSearchParams({ q, maxResults: "5" });
      const listRes = await this.gfetch(
        userId,
        "gmail",
        `${GMAIL_BASE}/users/me/messages?${gmailParams.toString()}`,
      );
      if (listRes.connected) {
        const list = (await listRes.response.json()) as { messages?: Array<{ id: string }> };
        for (const m of (list.messages ?? []).slice(0, 5)) {
          const msg = await this.getMessage(userId, m.id, "metadata");
          if (!msg.connected) continue;
          for (const addr of [msg.message.from, msg.message.to]) {
            const parsed = parseEmailAddress(addr);
            if (
              parsed &&
              !found.has(parsed.email) &&
              parsed.name.toLowerCase().includes(name.toLowerCase())
            ) {
              found.set(parsed.email, { ...parsed, source: "gmail" });
            }
          }
        }
      }
    }

    if (found.size === 0) {
      // Return connected:true but empty — not an auth error, just not found
      return { connected: true, contacts: [] };
    }

    return { connected: true, contacts: [...found.values()].slice(0, 5) };
  }

  // --- Gmail --------------------------------------------------------------

  async listThreads(
    userId: string,
    opts: { q?: string; maxResults?: number } = {},
  ): Promise<GoogleResult<{ messages: GmailThreadSummary[] }>> {
    const params = new URLSearchParams({
      maxResults: String(opts.maxResults ?? 10),
      q:
        opts.q ??
        primaryUpdatesInboxQuery(
          `is:unread (newer_than:${env.EMAIL_TRIAGE_WINDOW_DAYS}d OR is:starred OR is:important)`,
        ),
    });

    const listRes = await this.gfetch(
      userId,
      "gmail",
      `${GMAIL_BASE}/users/me/messages?${params.toString()}`,
    );
    if (!listRes.connected) return listRes;

    const list = (await listRes.response.json()) as {
      messages?: Array<{ id: string }>;
    };
    const ids = (list.messages ?? []).map((m) => m.id);
    const messages: GmailThreadSummary[] = [];

    for (const id of ids) {
      const msg = await this.getMessage(userId, id, "metadata");
      if (msg.connected) {
        const m = msg.message;
        messages.push({
          id: m.id,
          threadId: m.threadId,
          from: m.from,
          to: m.to,
          subject: m.subject,
          snippet: m.snippet,
          date: m.date,
          labelIds: m.labelIds,
        });
      }
    }

    return { connected: true, messages };
  }

  async getMessage(
    userId: string,
    id: string,
    format: "full" | "metadata" = "full",
  ): Promise<GoogleResult<{ message: GmailMessage }>> {
    const params = new URLSearchParams({ format });
    if (format === "metadata") {
      for (const header of ["Subject", "From", "To", "Cc", "Date", "Message-ID"]) {
        params.append("metadataHeaders", header);
      }
    }

    const res = await this.gfetch(
      userId,
      "gmail",
      `${GMAIL_BASE}/users/me/messages/${id}?${params.toString()}`,
    );
    if (!res.connected) return res;

    const data = (await res.response.json()) as GoogleGmailMessage;
    return { connected: true, message: toGmailMessage(data) };
  }

  async getThreadMessages(
    userId: string,
    threadId: string,
  ): Promise<GoogleResult<{ messages: GmailMessage[] }>> {
    const params = new URLSearchParams({ format: "metadata" });
    for (const header of ["Subject", "From", "To", "Date", "Message-ID"]) {
      params.append("metadataHeaders", header);
    }

    const res = await this.gfetch(
      userId,
      "gmail",
      `${GMAIL_BASE}/users/me/threads/${threadId}?${params.toString()}`,
    );
    if (!res.connected) return res;

    const data = (await res.response.json()) as { messages?: GoogleGmailMessage[] };
    return {
      connected: true,
      messages: (data.messages ?? []).map(toGmailMessage),
    };
  }

  async createDraft(
    userId: string,
    input: SendOrDraftInput,
  ): Promise<GoogleResult<{ draftId: string; threadId?: string }>> {
    const raw = buildRawMessage(input);
    const res = await this.gfetch(userId, "gmail", `${GMAIL_BASE}/users/me/drafts`, {
      method: "POST",
      body: JSON.stringify({
        message: { raw, threadId: input.threadId },
      }),
    });
    if (!res.connected) return res;

    const data = (await res.response.json()) as {
      id: string;
      message?: { threadId?: string };
    };
    return {
      connected: true,
      draftId: data.id,
      threadId: data.message?.threadId,
    };
  }

  async sendMessage(
    userId: string,
    input: SendOrDraftInput,
  ): Promise<GoogleResult<{ messageId: string; threadId?: string }>> {
    const raw = buildRawMessage(input);
    const res = await this.gfetch(
      userId,
      "gmail",
      `${GMAIL_BASE}/users/me/messages/send`,
      {
        method: "POST",
        body: JSON.stringify({ raw, threadId: input.threadId }),
      },
    );
    if (!res.connected) return res;

    const data = (await res.response.json()) as {
      id: string;
      threadId?: string;
    };
    return { connected: true, messageId: data.id, threadId: data.threadId };
  }

  // --- Auth + transport ---------------------------------------------------

  /**
   * Authenticated fetch with one automatic retry after a token refresh on 401.
   * Returns `{ connected: false }` when the account or OAuth config is missing.
   */
  private async gfetch(
    userId: string,
    provider: "gmail" | "calendar",
    url: string,
    init: RequestInit = {},
  ): Promise<{ connected: true; response: Response } | GoogleNotConnectedLocal> {
    const account = await this.findAccount(userId, provider);
    if (!account) {
      return { connected: false, reason: "not_connected" };
    }

    let token = await this.accessTokenFor(account);
    if (!token) {
      return { connected: false, reason: "missing_oauth_config" };
    }

    const doFetch = (bearer: string) =>
      fetch(url, {
        ...init,
        headers: {
          authorization: `Bearer ${bearer}`,
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
      });

    let response = await doFetch(token);
    if (response.status === 401) {
      const refreshed = await this.refresh(account);
      if (refreshed) {
        token = refreshed;
        response = await doFetch(refreshed);
      }
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.warn("google api call failed", {
        url,
        status: response.status,
        body: text.slice(0, 500),
      });
      throw new Error(`google_api_${response.status}`);
    }

    return { connected: true, response };
  }

  /**
   * Looks up the provider-specific row first; falls back to the old combined
   * "google" row so users who connected before the Gmail/Calendar split keep
   * working until they reconnect.
   */
  private async findAccount(
    userId: string,
    provider: "gmail" | "calendar",
  ): Promise<ConnectedAccount | undefined> {
    const account = await this.repository.find(userId, provider);
    if (account) return account;
    return this.repository.find(userId, "google");
  }

  private async accessTokenFor(account: ConnectedAccount): Promise<string | null> {
    const tokens = this.tokensOf(account);
    const expiry =
      tokens.expiry_date ??
      Date.parse(account.updatedAt) + (tokens.expires_in ?? 0) * 1000;

    if (tokens.access_token && Date.now() < expiry - 60_000) {
      return tokens.access_token;
    }

    return (await this.refresh(account)) ?? tokens.access_token ?? null;
  }

  private async refresh(account: ConnectedAccount): Promise<string | null> {
    const tokens = this.tokensOf(account);
    if (
      !tokens.refresh_token ||
      !env.GOOGLE_CLIENT_ID ||
      !env.GOOGLE_CLIENT_SECRET
    ) {
      return null;
    }

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
      }),
    });

    if (!res.ok) {
      logger.error("google token refresh failed", { status: res.status });
      return null;
    }

    const refreshed = (await res.json()) as GoogleTokens;
    const next: GoogleTokens = {
      ...tokens,
      ...refreshed,
      refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
      expiry_date: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
    };

    await this.repository.upsert({
      userId: account.userId,
      provider: account.provider,
      authType: account.authType,
      label: account.label,
      status: "connected",
      encryptedPayload: this.vault.encrypt(next as unknown as ConnectorSecretPayload),
      scopes: account.scopes,
      metadata: { ...account.metadata, lastRefreshAt: new Date().toISOString() },
    });

    return next.access_token ?? null;
  }

  private tokensOf(account: ConnectedAccount): GoogleTokens {
    return this.vault.decrypt(account.encryptedPayload) as unknown as GoogleTokens;
  }
}

type GoogleNotConnectedLocal = {
  connected: false;
  reason: "not_connected" | "missing_oauth_config";
};

type GoogleCalendarItem = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { email?: string };
  attendees?: Array<{ email?: string }>;
};

type GoogleGmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  labelIds?: string[];
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    mimeType?: string;
    body?: { data?: string };
    parts?: GoogleGmailMessage["payload"][];
  };
};

function toCalendarEvent(item: GoogleCalendarItem): CalendarEvent {
  const start = item.start?.dateTime ?? item.start?.date;
  const end = item.end?.dateTime ?? item.end?.date;
  return {
    id: item.id,
    title: item.summary ?? "(no title)",
    start,
    end,
    allDay: Boolean(item.start?.date && !item.start?.dateTime),
    location: item.location,
    hangoutLink: item.hangoutLink,
    attendees: (item.attendees ?? [])
      .map((a) => a.email)
      .filter((email): email is string => Boolean(email)),
    organizer: item.organizer?.email,
    status: item.status,
    description: item.description,
  };
}

function toGmailMessage(data: GoogleGmailMessage): GmailMessage {
  const headers = data.payload?.headers ?? [];
  const header = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  return {
    id: data.id,
    threadId: data.threadId,
    from: header("From"),
    to: header("To"),
    cc: header("Cc") || undefined,
    subject: header("Subject"),
    date: header("Date") || undefined,
    snippet: decodeHtmlEntities(data.snippet ?? ""),
    labelIds: data.labelIds ?? [],
    messageIdHeader: header("Message-ID") || undefined,
    body: extractPlainBody(data.payload),
  };
}

function extractPlainBody(payload: GoogleGmailMessage["payload"]): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractPlainBody(part);
    if (text) return text;
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

function buildRawMessage(input: SendOrDraftInput): string {
  const lines = [
    `To: ${input.to}`,
    input.cc ? `Cc: ${input.cc}` : undefined,
    `Subject: ${input.subject}`,
    input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : undefined,
    input.references ?? input.inReplyTo
      ? `References: ${input.references ?? input.inReplyTo}`
      : undefined,
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
    "",
    input.body,
  ].filter((line): line is string => line !== undefined);

  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function parseEmailAddress(raw: string): { name: string; email: string } | null {
  const withAngle = raw.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>/);
  if (withAngle) return { name: withAngle[1].trim(), email: withAngle[2].trim() };
  const bare = raw.match(/^\s*([^\s@]+@[^\s@]+)\s*$/);
  if (bare) return { name: bare[1].split("@")[0], email: bare[1].trim() };
  return null;
}
