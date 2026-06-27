import { Injectable } from "@nestjs/common";
import { ConnectorRepository } from "../connectors/connector.repository";
import { ConnectorVaultService } from "../connectors/connector-vault.service";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import type {
  CalComBooking,
  CalComEventType,
  CalComResult,
  CalComSlotsResult,
  CancelBookingInput,
  CreateBookingInput,
  RescheduleBookingInput,
} from "./calcom.types";

const BASE = "https://api.cal.com/v2";

type CalSecret = { apiKey: string; username?: string };

/**
 * Thin wrapper around Cal.com v2 REST API.
 * Auth: the user stores their Cal.com API key via the manual connector vault.
 * Every public method returns `{ connected: false }` when the key is missing,
 * keeping the agent loop resilient.
 */
@Injectable()
export class CalComService {
  constructor(
    private readonly repository: ConnectorRepository,
    private readonly vault: ConnectorVaultService,
  ) {}

  async isConnected(userId: string): Promise<boolean> {
    return Boolean(await this.apiKeyFor(userId));
  }

  // ---- Event types ---------------------------------------------------------

  async listEventTypes(
    userId: string,
  ): Promise<CalComResult<{ eventTypes: CalComEventType[] }>> {
    const apiKey = await this.apiKeyFor(userId);
    if (!apiKey) return notConnected();

    const res = await this.cfetch(apiKey, "/event-types");
    if (!res.ok) return apiError("listEventTypes", res.status);

    const data = (await res.json()) as { data?: { eventTypes?: unknown[] }; status?: string };
    const raw = data?.data?.eventTypes ?? [];

    return {
      connected: true,
      eventTypes: raw.map(toEventType),
    };
  }

  // ---- Availability / slots -----------------------------------------------

  async getSlots(
    userId: string,
    opts: {
      eventTypeId: number;
      startTime: string;
      endTime: string;
      timeZone?: string;
    },
  ): Promise<CalComResult<CalComSlotsResult>> {
    const apiKey = await this.apiKeyFor(userId);
    if (!apiKey) return notConnected();

    const params = new URLSearchParams({
      eventTypeId: String(opts.eventTypeId),
      startTime: opts.startTime,
      endTime: opts.endTime,
      ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
    });

    const res = await this.cfetch(apiKey, `/slots?${params.toString()}`);
    if (!res.ok) return apiError("getSlots", res.status);

    const data = (await res.json()) as { data?: { slots?: Record<string, unknown[]> }; status?: string };
    const raw = data?.data?.slots ?? {};

    const slots: CalComSlotsResult["slots"] = {};
    for (const [date, daySlots] of Object.entries(raw)) {
      slots[date] = (daySlots as Array<{ time?: string }>).map((s) => ({
        start: s.time ?? "",
        end: "",
      }));
    }

    return { connected: true, slots };
  }

  // ---- Bookings ------------------------------------------------------------

  async listBookings(
    userId: string,
    opts: { status?: "upcoming" | "past" | "cancelled"; limit?: number } = {},
  ): Promise<CalComResult<{ bookings: CalComBooking[] }>> {
    const apiKey = await this.apiKeyFor(userId);
    if (!apiKey) return notConnected();

    const params = new URLSearchParams({
      limit: String(opts.limit ?? 10),
      ...(opts.status ? { status: opts.status.toUpperCase() } : {}),
    });

    const res = await this.cfetch(apiKey, `/bookings?${params.toString()}`);
    if (!res.ok) return apiError("listBookings", res.status);

    const data = (await res.json()) as { data?: unknown[]; status?: string };
    const raw = data?.data ?? [];

    return {
      connected: true,
      bookings: raw.map(toBooking),
    };
  }

  async createBooking(
    userId: string,
    input: CreateBookingInput,
  ): Promise<CalComResult<{ booking: CalComBooking }>> {
    const apiKey = await this.apiKeyFor(userId);
    if (!apiKey) return notConnected();

    const body = {
      eventTypeId: input.eventTypeId,
      start: input.start,
      attendee: {
        name: input.attendee.name,
        email: input.attendee.email,
        timeZone: input.attendee.timeZone ?? env.DEFAULT_TIMEZONE,
        language: "en",
      },
      guests: input.guests ?? [],
      metadata: input.metadata ?? {},
      ...(input.notes ? { notes: input.notes } : {}),
    };

    const res = await this.cfetch(apiKey, "/bookings", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) return apiError("createBooking", res.status);

    const data = (await res.json()) as { data?: unknown; status?: string };
    return { connected: true, booking: toBooking(data?.data) };
  }

  async cancelBooking(
    userId: string,
    input: CancelBookingInput,
  ): Promise<CalComResult<{ success: boolean }>> {
    const apiKey = await this.apiKeyFor(userId);
    if (!apiKey) return notConnected();

    const res = await this.cfetch(
      apiKey,
      `/bookings/${input.bookingUid}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason: input.reason ?? "" }),
      },
    );
    if (!res.ok) return apiError("cancelBooking", res.status);

    return { connected: true, success: true };
  }

  async rescheduleBooking(
    userId: string,
    input: RescheduleBookingInput,
  ): Promise<CalComResult<{ booking: CalComBooking }>> {
    const apiKey = await this.apiKeyFor(userId);
    if (!apiKey) return notConnected();

    const res = await this.cfetch(
      apiKey,
      `/bookings/${input.bookingUid}/reschedule`,
      {
        method: "POST",
        body: JSON.stringify({
          start: input.start,
          reschedulingReason: input.reason ?? "",
        }),
      },
    );
    if (!res.ok) return apiError("rescheduleBooking", res.status);

    const data = (await res.json()) as { data?: unknown; status?: string };
    return { connected: true, booking: toBooking(data?.data) };
  }

  // ---- Auth / transport ---------------------------------------------------

  private async apiKeyFor(userId: string): Promise<string | null> {
    const account = await this.repository.find(userId, "calcom");
    if (!account) return null;
    const secret = this.vault.decrypt(account.encryptedPayload) as unknown as CalSecret;
    return secret?.apiKey ?? null;
  }

  private async cfetch(
    apiKey: string,
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const url = `${BASE}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "cal-api-v2-key": apiKey,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn("cal.com api error", { path, status: res.status, body: text.slice(0, 300) });
    }

    return res;
  }
}

// ---- Shape normalizers (v2 API fields vary by endpoint version) ----------

function toEventType(raw: unknown): CalComEventType {
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id),
    slug: String(r.slug ?? ""),
    title: String(r.title ?? r.slug ?? ""),
    description: r.description ? String(r.description) : undefined,
    length: Number(r.length ?? r.duration ?? 30),
    hidden: Boolean(r.hidden),
    bookingLink: String(r.schedulingAppLink ?? r.bookingLink ?? ""),
  };
}

function toBooking(raw: unknown): CalComBooking {
  const r = raw as Record<string, unknown>;
  const attendees = (r.attendees as Array<Record<string, string>> | undefined) ?? [];
  const evType = r.eventType as Record<string, unknown> | undefined;

  return {
    id: Number(r.id),
    uid: String(r.uid ?? r.id ?? ""),
    title: String(r.title ?? "Meeting"),
    description: r.description ? String(r.description) : undefined,
    status: (r.status ?? "ACCEPTED") as CalComBooking["status"],
    start: String(r.start ?? r.startTime ?? ""),
    end: String(r.end ?? r.endTime ?? ""),
    duration: Number(r.duration ?? r.length ?? 30),
    attendees: attendees.map((a) => ({
      name: a.name ?? "",
      email: a.email ?? "",
      timeZone: a.timeZone,
    })),
    meetingUrl: r.meetingUrl ? String(r.meetingUrl) : undefined,
    location: r.location ? String(r.location) : undefined,
    eventType: evType
      ? { id: Number(evType.id), slug: String(evType.slug ?? ""), title: String(evType.title ?? "") }
      : undefined,
  };
}

function notConnected(): CalComNotConnected {
  return { connected: false, reason: "not_connected" };
}

function apiError(op: string, status: number): CalComNotConnected {
  logger.warn("cal.com api_error", { op, status });
  return { connected: false, reason: "api_error" };
}

type CalComNotConnected = { connected: false; reason: "not_connected" | "api_error" };
