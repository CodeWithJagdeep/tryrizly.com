import { Injectable } from "@nestjs/common";
import type { PagerDutyConnectorSecret } from "./connector.types";

export type PagerDutyCreatedIncident = { id: string; url?: string };

@Injectable()
export class PagerDutyService {
  async createIncident(
    secret: PagerDutyConnectorSecret,
    input: { serviceId: string; title: string; urgency?: "high" | "low"; details?: string },
  ): Promise<PagerDutyCreatedIncident> {
    const res = await fetch("https://api.pagerduty.com/incidents", {
      method: "POST",
      headers: {
        authorization: `Token token=${secret.apiKey}`,
        "content-type": "application/json",
        accept: "application/vnd.pagerduty+json;version=2",
        from: secret.fromEmail,
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
