import { Injectable } from "@nestjs/common";
import type { CalendlyConnectorSecret } from "./connector.types";

export type CalendlyEvent = {
  uri: string;
  name: string;
  startTime: string;
  endTime: string;
  status: string;
  location?: string;
};

/** Calendly — OAuth access token when connected, falling back to a manually pasted Personal Access Token. Both are plain Bearer tokens against the same API. */
@Injectable()
export class CalendlyService {
  async listScheduledEvents(
    secret: CalendlyConnectorSecret,
    input: { status?: "active" | "canceled"; minStartTime?: string; maxStartTime?: string; maxResults?: number },
  ): Promise<CalendlyEvent[]> {
    const token = secret.accessToken ?? secret.apiToken;
    if (!token || !secret.userUri) throw new Error("calendly_invalid_credentials");

    const params = new URLSearchParams({
      user: secret.userUri,
      status: input.status ?? "active",
      sort: "start_time:asc",
      count: String(Math.min(Math.max(input.maxResults ?? 10, 1), 25)),
    });
    if (input.minStartTime) params.set("min_start_time", input.minStartTime);
    if (input.maxStartTime) params.set("max_start_time", input.maxStartTime);

    const res = await fetch(`https://api.calendly.com/scheduled_events?${params.toString()}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 401) throw new Error("calendly_invalid_credentials");
    if (!res.ok) throw new Error(`calendly_api_${res.status}`);
    const data = (await res.json()) as {
      collection?: Array<{
        uri: string;
        name: string | null;
        start_time: string;
        end_time: string;
        status: string;
        location?: { location?: string; join_url?: string };
      }>;
    };
    return (data.collection ?? []).map((event) => ({
      uri: event.uri,
      name: event.name ?? "Untitled event",
      startTime: event.start_time,
      endTime: event.end_time,
      status: event.status,
      location: event.location?.join_url ?? event.location?.location,
    }));
  }
}
