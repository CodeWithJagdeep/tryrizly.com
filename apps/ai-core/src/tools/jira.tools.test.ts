import { describe, expect, it, vi } from "vitest";
import type { HeyRizRuntimeContext } from "../context/context.types";
import { createJiraSearchTool } from "./jira.tools";

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

describe("jira_search", () => {
  it("asks to connect when Jira isn't linked", async () => {
    const connectors = { getJiraSecret: vi.fn(async () => null) };
    const tool = createJiraSearchTool(connectors as never, {} as never);

    const result = await tool.execute({ userId: context.userId, payload: {}, context });

    expect(result.status).toBe("needs_connection");
  });

  it("lists issues from the connected account", async () => {
    const connectors = {
      getJiraSecret: vi.fn(async () => ({ accessToken: "at", cloudId: "cloud-1" })),
    };
    const jira = {
      searchIssues: vi.fn(async () => [
        {
          key: "ENG-1",
          summary: "Fix the thing",
          status: "In Progress",
          updated: new Date(0).toISOString(),
          url: "https://api.atlassian.com/ex/jira/cloud-1/browse/ENG-1",
        },
      ]),
    };
    const tool = createJiraSearchTool(connectors as never, jira as never);

    const result = await tool.execute({
      userId: context.userId,
      payload: { projectKey: "ENG" },
      context,
    });

    expect(result.status).toBe("ok");
    expect(jira.searchIssues).toHaveBeenCalledWith(
      { accessToken: "at", cloudId: "cloud-1" },
      { jql: undefined, projectKey: "ENG", maxResults: undefined },
    );
  });

  it("prompts to reconnect when Jira rejects the saved credentials", async () => {
    const connectors = {
      getJiraSecret: vi.fn(async () => ({ accessToken: "at", cloudId: "cloud-1" })),
    };
    const jira = {
      searchIssues: vi.fn(async () => {
        throw new Error("jira_invalid_credentials");
      }),
    };
    const tool = createJiraSearchTool(connectors as never, jira as never);

    const result = await tool.execute({ userId: context.userId, payload: {}, context });

    expect(result.status).toBe("needs_connection");
  });
});
