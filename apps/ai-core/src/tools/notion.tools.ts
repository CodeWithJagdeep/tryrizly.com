import type { ConnectorService } from "../connectors/connector.service";
import type { NotionService } from "../connectors/notion.service";
import type { HeyRizTool } from "./tool.types";
import { connectorSetupUrl } from "./connector-links";

type NotionSearchPayload = {
  /** Search text, e.g. a page title or keyword. */
  query?: string;
  /** Also fetch the full text content of the top match instead of just listing titles. */
  includeContent?: boolean;
};

export function createNotionSearchTool(
  connectors: ConnectorService,
  notion: NotionService,
): HeyRizTool<NotionSearchPayload> {
  return {
    name: "notion_search",
    category: "business",
    description:
      "Search the connected Notion workspace by title or keyword and list matching pages with edit times and links. With no query, list recently edited pages. Set includeContent to read the top match. Use when they ask to find, check, or read something in Notion.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const secret = await connectors.getNotionSecret(userId);
      if (!secret) {
        return {
          tool: "notion_search",
          status: "needs_connection",
          message: `Notion isn't connected yet, ${context.honorific}. Connect it here: ${connectorSetupUrl("notion")}`,
        };
      }

      try {
        const query = payload.query?.trim() ?? "";
        const pages = await notion.search(secret, query);

        if (pages.length === 0) {
          return {
            tool: "notion_search",
            status: "ok",
            message: query
              ? `No Notion pages matched "${query}", ${context.honorific}. The integration may not have access to that page.`
              : `No accessible Notion pages were found, ${context.honorific}. Share pages with the Rizly integration and try again.`,
            data: { query, pages: [] },
          };
        }

        const lines = pages.map((page) =>
          `• ${page.title} · edited ${formatEditedAt(page.lastEdited, context.timezone)}\n  ${page.url}`,
        );
        let content: string | undefined;
        if (payload.includeContent) {
          content = await notion.getPageContent(secret, pages[0].id).catch(() => undefined);
        }

        const contentBlock = content
          ? `\n\nTop page · ${pages[0].title}\n${truncate(content, 1600)}`
          : payload.includeContent
            ? `\n\nI found the page but could not read its blocks. Check that the integration has access.`
            : "";

        return {
          tool: "notion_search",
          status: "ok",
          message: `Notion · ${query ? `search: ${query}` : "recently edited"} · checked ${formatCheckedAt(context.timezone)}\n\n${lines.join("\n\n")}${contentBlock}`,
          data: { query, pages },
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        if (code === "notion_api_401" || code === "notion_api_403") {
          return {
            tool: "notion_search",
            status: "needs_connection",
            message: `Notion rejected the saved connection, ${context.honorific}. Reconnect it here: ${connectorSetupUrl("notion")}`,
          };
        }
        throw error;
      }
    },
  };
}

function formatEditedAt(value: string, timezone: string): string {
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

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}
