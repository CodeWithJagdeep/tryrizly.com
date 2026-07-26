import type { ConnectorService } from "../connectors/connector.service";
import type { AirtableService } from "../connectors/airtable.service";
import type { HeyRizTool } from "./tool.types";
import { connectorSetupUrl } from "./connector-links";

type AirtableRecordsPayload = {
  /** The Airtable base id, e.g. "appXXXXXXXXXXXXXX". Ask the principal for this if it isn't already known from context. */
  baseId?: string;
  /** The table name within that base. Ask the principal for this if it isn't already known from context. */
  table?: string;
  /** Max records to return (default 20, max 100). */
  maxRecords?: number;
};

export function createAirtableRecordsTool(
  connectors: ConnectorService,
  airtable: AirtableService,
): HeyRizTool<AirtableRecordsPayload> {
  return {
    name: "airtable_records",
    category: "business",
    description:
      "List the most recently created records in a specific Airtable base and table, newest first. Requires baseId and table — ask the principal which base/table if not already clear from the conversation. Use when they ask what's in Airtable, to check a base, or to find a record.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const secret = await connectors.getAirtableSecret(userId);
      if (!secret) {
        return {
          tool: "airtable_records",
          status: "needs_connection",
          message: `Airtable isn't connected yet, ${context.honorific}. Connect it here: ${connectorSetupUrl("airtable")}`,
        };
      }

      const baseId = payload.baseId?.trim();
      const table = payload.table?.trim();
      if (!baseId || !table) {
        return {
          tool: "airtable_records",
          status: "invalid_input",
          message: `I need the Airtable base id and table name to look that up, ${context.honorific}. Which base and table?`,
        };
      }

      try {
        const maxRecords = Math.min(Math.max(payload.maxRecords ?? 20, 1), 100);
        const records = await airtable.listRecords(secret, { baseId, table, maxRecords });

        if (records.length === 0) {
          return {
            tool: "airtable_records",
            status: "ok",
            message: `No records found in ${table}, ${context.honorific}.`,
            data: { baseId, table, records: [] },
          };
        }

        const lines = records.map((record) => {
          const summary = summarizeFields(record.fields);
          return `• ${record.id} · created ${formatCreatedAt(record.createdTime, context.timezone)}\n  ${summary}`;
        });

        return {
          tool: "airtable_records",
          status: "ok",
          message: `Airtable · ${table} · checked ${formatCheckedAt(context.timezone)}\n\n${lines.join("\n\n")}`,
          data: { baseId, table, records },
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        if (code === "airtable_invalid_credentials") {
          return {
            tool: "airtable_records",
            status: "needs_connection",
            message: `Airtable rejected the saved connection, ${context.honorific}. Reconnect it here: ${connectorSetupUrl("airtable")}`,
          };
        }
        throw error;
      }
    },
  };
}

function summarizeFields(fields: Record<string, unknown>): string {
  const entries = Object.entries(fields).slice(0, 5);
  if (entries.length === 0) return "(no fields)";
  return entries
    .map(([key, value]) => `${key}: ${truncate(stringifyValue(value), 80)}`)
    .join(" · ");
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringifyValue).join(", ");
  return JSON.stringify(value);
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function formatCreatedAt(value: string, timezone: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "unknown"
    : date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      });
}

function formatCheckedAt(timezone: string): string {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}
