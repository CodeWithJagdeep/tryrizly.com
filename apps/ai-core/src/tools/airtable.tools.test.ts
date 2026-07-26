import { describe, expect, it, vi } from "vitest";
import type { HeyRizRuntimeContext } from "../context/context.types";
import { createAirtableRecordsTool } from "./airtable.tools";

const context: HeyRizRuntimeContext = {
  userId: "owner@example.com",
  source: "telegram",
  structured: { activeDeals: [], preferences: [], pendingStates: [] },
  semantic: [],
  live: {
    connected: false,
    calendarConnected: false,
    inboxConnected: false,
    calendarStatus: "not_connected",
    inboxStatus: "not_connected",
    checkedAt: new Date(0).toISOString(),
    schedule: [],
    unread: [],
  },
  honorific: "sir",
  timezone: "UTC",
  timezoneConfirmed: true,
  connectedDataSources: [],
};

describe("airtable_records", () => {
  it("asks for a base/table when Airtable isn't connected", async () => {
    const connectors = { getAirtableSecret: vi.fn(async () => null) };
    const tool = createAirtableRecordsTool(connectors as never, {} as never);

    const result = await tool.execute({ userId: context.userId, payload: {}, context });

    expect(result.status).toBe("needs_connection");
  });

  it("asks which base/table when connected but neither is given", async () => {
    const connectors = { getAirtableSecret: vi.fn(async () => ({ apiKey: "pat_live" })) };
    const tool = createAirtableRecordsTool(connectors as never, {} as never);

    const result = await tool.execute({ userId: context.userId, payload: {}, context });

    expect(result.status).toBe("invalid_input");
  });

  it("lists records for a given base and table", async () => {
    const connectors = { getAirtableSecret: vi.fn(async () => ({ apiKey: "pat_live" })) };
    const airtable = {
      listRecords: vi.fn(async () => [
        { id: "rec1", createdTime: new Date(0).toISOString(), fields: { Name: "Ada" } },
      ]),
    };
    const tool = createAirtableRecordsTool(connectors as never, airtable as never);

    const result = await tool.execute({
      userId: context.userId,
      payload: { baseId: "appXXX", table: "Contacts" },
      context,
    });

    expect(result.status).toBe("ok");
    expect(airtable.listRecords).toHaveBeenCalledWith(
      { apiKey: "pat_live" },
      { baseId: "appXXX", table: "Contacts", maxRecords: 20 },
    );
  });
});
