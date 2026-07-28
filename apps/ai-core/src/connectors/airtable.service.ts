import { Injectable } from "@nestjs/common";
import type { AirtableConnectorSecret } from "./connector.types";

export type AirtableRecord = { id: string; createdTime: string; fields: Record<string, unknown> };
export type AirtableBase = { id: string; name: string };
export type AirtableField = { id: string; name: string; type: string };
export type AirtableTable = { id: string; name: string; fields: AirtableField[] };

@Injectable()
export class AirtableService {
  /** Every base the connected account can see — powers the flow-builder's base picker. Requires schema.bases:read. */
  async listBases(secret: AirtableConnectorSecret): Promise<AirtableBase[]> {
    const res = await fetch("https://api.airtable.com/v0/meta/bases", {
      headers: { authorization: `Bearer ${secret.apiKey}` },
    });
    if (res.status === 401 || res.status === 403) throw new Error("airtable_invalid_credentials");
    if (!res.ok) throw new Error(`airtable_api_${res.status}`);
    const data = (await res.json()) as { bases?: Array<{ id: string; name: string }> };
    return (data.bases ?? []).map((b) => ({ id: b.id, name: b.name }));
  }

  /** Every table (+ field schema) in one base — powers the table picker and the Create Record field hints. */
  async listTables(secret: AirtableConnectorSecret, baseId: string): Promise<AirtableTable[]> {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${encodeURIComponent(baseId)}/tables`, {
      headers: { authorization: `Bearer ${secret.apiKey}` },
    });
    if (res.status === 401 || res.status === 403) throw new Error("airtable_invalid_credentials");
    if (!res.ok) throw new Error(`airtable_api_${res.status}`);
    const data = (await res.json()) as {
      tables?: Array<{ id: string; name: string; fields?: Array<{ id: string; name: string; type: string }> }>;
    };
    return (data.tables ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      fields: (t.fields ?? []).map((f) => ({ id: f.id, name: f.name, type: f.type })),
    }));
  }
  async createRecord(
    secret: AirtableConnectorSecret,
    input: { baseId: string; table: string; fields: Record<string, unknown> },
  ): Promise<AirtableRecord> {
    const res = await fetch(
      `https://api.airtable.com/v0/${encodeURIComponent(input.baseId)}/${encodeURIComponent(input.table)}`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${secret.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ fields: input.fields }),
      },
    );
    if (res.status === 401 || res.status === 403) throw new Error("airtable_invalid_credentials");
    if (!res.ok) throw new Error(`airtable_api_${res.status}`);
    return (await res.json()) as AirtableRecord;
  }

  /** Newest first — the "New Record" trigger dedups against `id`, so ordering only matters for the poll window. */
  async listRecords(
    secret: AirtableConnectorSecret,
    input: { baseId: string; table: string; maxRecords?: number },
  ): Promise<AirtableRecord[]> {
    const params = new URLSearchParams({
      maxRecords: String(Math.min(input.maxRecords ?? 20, 100)),
      "sort[0][field]": "Created",
      "sort[0][direction]": "desc",
    });
    const res = await fetch(
      `https://api.airtable.com/v0/${encodeURIComponent(input.baseId)}/${encodeURIComponent(input.table)}?${params.toString()}`,
      { headers: { authorization: `Bearer ${secret.apiKey}` } },
    );
    // A "Created" sort field is a real column, not built-in — retry unsorted rather than fail the whole poll.
    if (res.status === 422) {
      const fallback = await fetch(
        `https://api.airtable.com/v0/${encodeURIComponent(input.baseId)}/${encodeURIComponent(input.table)}?maxRecords=${Math.min(input.maxRecords ?? 20, 100)}`,
        { headers: { authorization: `Bearer ${secret.apiKey}` } },
      );
      if (!fallback.ok) throw new Error(`airtable_api_${fallback.status}`);
      const data = (await fallback.json()) as { records?: AirtableRecord[] };
      return data.records ?? [];
    }
    if (res.status === 401 || res.status === 403) throw new Error("airtable_invalid_credentials");
    if (!res.ok) throw new Error(`airtable_api_${res.status}`);
    const data = (await res.json()) as { records?: AirtableRecord[] };
    return data.records ?? [];
  }
}
