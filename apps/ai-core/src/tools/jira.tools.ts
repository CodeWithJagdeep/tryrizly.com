import type { ConnectorService } from "../connectors/connector.service";
import type { JiraService } from "../connectors/jira.service";
import type { HeyRizTool } from "./tool.types";
import { connectorSetupUrl } from "./connector-links";

type JiraSearchPayload = {
  /** Raw JQL to run, e.g. "project = ENG AND status = \"In Progress\"". Overrides projectKey when set. */
  jql?: string;
  /** Restrict to one project's issues, newest-updated first, when jql isn't given. */
  projectKey?: string;
  /** Max issues to return (default 10, max 25). */
  maxResults?: number;
};

export function createJiraSearchTool(
  connectors: ConnectorService,
  jira: JiraService,
): HeyRizTool<JiraSearchPayload> {
  return {
    name: "jira_search",
    category: "business",
    description:
      "Search Jira issues. With no arguments, lists the principal's own unresolved issues, most recently updated first. Pass projectKey to list a project's issues, or jql for an exact query. Use when they ask what's open in Jira, about a specific ticket, or the status of project work.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const secret = await connectors.getJiraSecret(userId);
      if (!secret) {
        return {
          tool: "jira_search",
          status: "needs_connection",
          message: `Jira isn't connected yet, ${context.honorific}. Connect it here: ${connectorSetupUrl("jira")}`,
        };
      }

      try {
        const issues = await jira.searchIssues(secret, {
          jql: payload.jql,
          projectKey: payload.projectKey,
          maxResults: payload.maxResults,
        });

        if (issues.length === 0) {
          return {
            tool: "jira_search",
            status: "ok",
            message: `No matching Jira issues, ${context.honorific}.`,
            data: { issues: [] },
          };
        }

        const lines = issues.map(
          (issue) =>
            `• ${issue.key} [${issue.status}]: ${issue.summary}\n  updated ${formatUpdatedAt(issue.updated, context.timezone)} · ${issue.url}`,
        );

        return {
          tool: "jira_search",
          status: "ok",
          message: `Jira · checked ${formatCheckedAt(context.timezone)}\n\n${lines.join("\n\n")}`,
          data: { issues },
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        if (code === "jira_invalid_credentials") {
          return {
            tool: "jira_search",
            status: "needs_connection",
            message: `Jira rejected the saved connection, ${context.honorific}. Reconnect it here: ${connectorSetupUrl("jira")}`,
          };
        }
        if (code === "jira_api_400") {
          return {
            tool: "jira_search",
            status: "invalid_input",
            message: `That Jira query wasn't valid, ${context.honorific}. Try rephrasing it.`,
          };
        }
        throw error;
      }
    },
  };
}

function formatUpdatedAt(value: string, timezone: string): string {
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
