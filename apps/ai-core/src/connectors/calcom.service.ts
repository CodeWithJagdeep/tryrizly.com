import { Injectable } from "@nestjs/common";

/** A personal API key (manual connector) or an OAuth access token — both work as a v2 Bearer token. */
export type CalComAuth = { kind: "apikey"; apiKey: string } | { kind: "oauth"; accessToken: string };

function bearerTokenFor(auth: CalComAuth): string {
  return auth.kind === "oauth" ? auth.accessToken : auth.apiKey;
}

/** @deprecated kept for the manual-connector call sites; prefer CalComAuth. */
export type CalComSecret = { apiKey: string };

export type CalComBooking = {
  id: number;
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  attendees: { name: string; email: string }[];
  location?: string;
  meetingUrl?: string;
  description?: string;
};

export type CalComEventType = {
  id: number;
  slug: string;
  title: string;
  length: number;
  description?: string;
};

// v2 endpoints pin a specific accepted snapshot date per resource — see
// https://cal.com/docs/api-reference/v2/<resource>/... for the current value.
const V2_VERSION = {
  listBookings: "2026-05-01",
  createBooking: "2026-02-25",
  eventTypes: "2024-06-14",
} as const;

@Injectable()
export class CalComService {
  private readonly v2Base = "https://api.cal.com/v2";

  // Cal.com's v1 API was permanently decommissioned (confirmed: it now returns
  // 410 for every request, "API v1 has been decommissioned"). v2 accepts a
  // personal API key as a Bearer token exactly like an OAuth access token, so
  // both auth kinds route through the same v2 methods below.
  async listBookings(
    auth: CalComAuth,
    opts: { status?: "upcoming" | "past" | "cancelled"; take?: number } = {},
  ): Promise<CalComBooking[]> {
    return this.listBookingsV2(bearerTokenFor(auth), opts);
  }

  async listEventTypes(auth: CalComAuth): Promise<CalComEventType[]> {
    return this.listEventTypesV2(bearerTokenFor(auth));
  }

  async createBooking(
    auth: CalComAuth,
    input: {
      eventTypeId: number;
      start: string;
      name: string;
      email: string;
      timeZone?: string;
      notes?: string;
    },
  ): Promise<{ uid: string; meetingUrl?: string }> {
    return this.createBookingV2(bearerTokenFor(auth), input);
  }

  // ── v2 (OAuth access token or personal API key, both as Bearer) ─────────────

  private async listBookingsV2(
    accessToken: string,
    opts: { status?: "upcoming" | "past" | "cancelled"; take?: number },
  ): Promise<CalComBooking[]> {
    const params = new URLSearchParams();
    if (opts.status) params.set("status", opts.status);
    if (opts.take) params.set("limit", String(opts.take));

    const res = await fetch(`${this.v2Base}/bookings?${params.toString()}`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        "cal-api-version": V2_VERSION.listBookings,
      },
    });
    if (!res.ok) throw new Error(`calcom_api_${res.status}`);

    const data = (await res.json()) as { data?: unknown[] };
    return (data.data ?? []).map((b) => this.parseBookingV2(b as Record<string, unknown>));
  }

  private async listEventTypesV2(accessToken: string): Promise<CalComEventType[]> {
    const res = await fetch(`${this.v2Base}/event-types`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        "cal-api-version": V2_VERSION.eventTypes,
      },
    });
    if (!res.ok) throw new Error(`calcom_api_${res.status}`);

    const data = (await res.json()) as { data?: unknown[] };
    return (data.data ?? []).map((e) => this.parseEventTypeV2(e as Record<string, unknown>));
  }

  private async createBookingV2(
    accessToken: string,
    input: {
      eventTypeId: number;
      start: string;
      name: string;
      email: string;
      timeZone?: string;
      notes?: string;
    },
  ): Promise<{ uid: string; meetingUrl?: string }> {
    const res = await fetch(`${this.v2Base}/bookings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "cal-api-version": V2_VERSION.createBooking,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        eventTypeId: input.eventTypeId,
        start: input.start,
        attendee: {
          name: input.name,
          email: input.email,
          timeZone: input.timeZone ?? "UTC",
        },
        metadata: input.notes ? { notes: input.notes } : {},
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(err.error?.message ?? `calcom_booking_${res.status}`);
    }

    const { data } = (await res.json()) as {
      data?: { uid?: string; location?: string };
    };
    return { uid: data?.uid ?? "", meetingUrl: data?.location };
  }

  // ── parsing ─────────────────────────────────────────────────────────────────

  private parseBookingV2(b: Record<string, unknown>): CalComBooking {
    const attendees = (b.attendees as { name?: string; email?: string }[] | undefined) ?? [];
    const location = b.location as string | undefined;
    return {
      id: b.id as number,
      uid: b.uid as string,
      title: (b.title as string) ?? "Meeting",
      startTime: b.start as string,
      endTime: b.end as string,
      status: (b.status as string) ?? "accepted",
      attendees: attendees.map((a) => ({ name: a.name ?? "", email: a.email ?? "" })),
      location,
      meetingUrl: location?.startsWith("http") ? location : undefined,
      description: b.description as string | undefined,
    };
  }

  private parseEventTypeV2(e: Record<string, unknown>): CalComEventType {
    return {
      id: e.id as number,
      slug: e.slug as string,
      title: e.title as string,
      length: (e.lengthInMinutes as number) ?? 0,
      description: e.description as string | undefined,
    };
  }
}
