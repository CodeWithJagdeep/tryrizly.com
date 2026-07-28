import { Injectable } from "@nestjs/common";
import type { PagerDutyConnectorSecret } from "./connector.types";

export type PagerDutyCreatedIncident = { id: string; url?: string };
export type PagerDutyIncident = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  url?: string;
};

/**
 * OAuth (accessToken, Bearer auth) already identifies the acting user, so no
 * "From" header is needed. The manual shape (apiKey) is a generic API key not
 * tied to a user, so PagerDuty requires the "From" header on every write.
 */
function authHeaders(secret: PagerDutyConnectorSecret): Record<string, string> {
  if (secret.accessToken) {
    return { authorization: `Bearer ${secret.accessToken}` };
  }
  return { authorization: `Token token=${secret.apiKey}`, from: secret.fromEmail! };
}

@Injectable()
export class PagerDutyService {
  /** Newest-created first — backs the "New Incident" poll trigger. */
  async listIncidents(
    secret: PagerDutyConnectorSecret,
    opts: { limit?: number; serviceId?: string } = {},
  ): Promise<PagerDutyIncident[]> {
    const params = new URLSearchParams({
      limit: String(Math.min(opts.limit ?? 20, 50)),
      sort_by: "created_at:desc",
    });
    if (opts.serviceId) params.append("service_ids[]", opts.serviceId);
    const res = await fetch(`https://api.pagerduty.com/incidents?${params.toString()}`, {
      headers: {
        ...authHeaders(secret),
        accept: "application/vnd.pagerduty+json;version=2",
      },
    });
    if (res.status === 401 || res.status === 403) throw new Error("pagerduty_invalid_credentials");
    if (!res.ok) throw new Error(`pagerduty_api_${res.status}`);
    const data = (await res.json()) as {
      incidents?: Array<{ id: string; title: string; status: string; created_at: string; html_url?: string }>;
    };
    return (data.incidents ?? []).map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      createdAt: i.created_at,
      url: i.html_url,
    }));
  }

  async createIncident(
    secret: PagerDutyConnectorSecret,
    input: { serviceId: string; title: string; urgency?: "high" | "low"; details?: string },
  ): Promise<PagerDutyCreatedIncident> {
    const res = await fetch("https://api.pagerduty.com/incidents", {
      method: "POST",
      headers: {
        ...authHeaders(secret),
        "content-type": "application/json",
        accept: "application/vnd.pagerduty+json;version=2",
      },
      body: JSON.stringify({
        incident: {
          type: "incident",
          title: input.title,
          service: { id: input.serviceId, type: "service_reference" },
          urgency: input.urgency ?? "high",
          ...(input.details ? { body: { type: "incident_body", details: input.details } } : {}),
        },
      }),
    });
    if (res.status === 401 || res.status === 403) throw new Error("pagerduty_invalid_credentials");
    if (!res.ok) throw new Error(`pagerduty_api_${res.status}`);
    const data = (await res.json()) as { incident: { id: string; html_url?: string } };
    return { id: data.incident.id, url: data.incident.html_url };
  }
}
