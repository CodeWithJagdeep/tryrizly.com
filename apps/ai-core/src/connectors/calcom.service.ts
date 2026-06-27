import { Injectable } from "@nestjs/common";

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

@Injectable()
export class CalComService {
  private readonly base = "https://api.cal.com/v1";

  async listBookings(
    secret: CalComSecret,
    opts: { status?: "upcoming" | "past" | "cancelled"; take?: number } = {},
  ): Promise<CalComBooking[]> {
    const params = new URLSearchParams({ apiKey: secret.apiKey });
    if (opts.status) params.set("status", opts.status);
    if (opts.take) params.set("take", String(opts.take));

    const res = await fetch(`${this.base}/bookings?${params.toString()}`);
    if (!res.ok) throw new Error(`calcom_api_${res.status}`);

    const data = (await res.json()) as { bookings?: unknown[] };
    return (data.bookings ?? []).map((b) => this.parseBooking(b as Record<string, unknown>));
  }

  async listEventTypes(secret: CalComSecret): Promise<CalComEventType[]> {
    const params = new URLSearchParams({ apiKey: secret.apiKey });
    const res = await fetch(`${this.base}/event-types?${params.toString()}`);
    if (!res.ok) throw new Error(`calcom_api_${res.status}`);

    const data = (await res.json()) as { event_types?: unknown[] };
    return (data.event_types ?? []).map((e) => this.parseEventType(e as Record<string, unknown>));
  }

  async createBooking(
    secret: CalComSecret,
    input: {
      eventTypeId: number;
      start: string;
      name: string;
      email: string;
      timeZone?: string;
      notes?: string;
    },
  ): Promise<{ uid: string; meetingUrl?: string }> {
    const params = new URLSearchParams({ apiKey: secret.apiKey });
    const res = await fetch(`${this.base}/bookings?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventTypeId: input.eventTypeId,
        start: input.start,
        responses: { name: input.name, email: input.email, notes: input.notes ?? "" },
        timeZone: input.timeZone ?? "UTC",
        language: "en",
        metadata: {},
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message ?? `calcom_booking_${res.status}`);
    }

    const data = (await res.json()) as { uid?: string; meetingUrl?: string };
    return { uid: data.uid ?? "", meetingUrl: data.meetingUrl };
  }

  private parseBooking(b: Record<string, unknown>): CalComBooking {
    const attendees = (b.attendees as { name?: string; email?: string }[] | undefined) ?? [];
    return {
      id: b.id as number,
      uid: b.uid as string,
      title: (b.title as string) ?? "Meeting",
      startTime: b.startTime as string,
      endTime: b.endTime as string,
      status: (b.status as string) ?? "accepted",
      attendees: attendees.map((a) => ({ name: a.name ?? "", email: a.email ?? "" })),
      location: b.location as string | undefined,
      meetingUrl: (b.videoCallData as { url?: string } | undefined)?.url,
      description: b.description as string | undefined,
    };
  }

  private parseEventType(e: Record<string, unknown>): CalComEventType {
    return {
      id: e.id as number,
      slug: e.slug as string,
      title: e.title as string,
      length: e.length as number,
      description: e.description as string | undefined,
    };
  }
}
