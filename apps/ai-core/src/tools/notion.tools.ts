import type { ConnectorService } from "../connectors/connector.service";
import type { NotionService } from "../connectors/notion.service";
import type { HeyRizTool } from "./tool.types";

type NotionSearchPayload = {
  /** Search text, e.g. a page title or keyword. */
  query: string;
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
      "Search the principal's connected Notion workspace by title or keyword and list matching pages. Set includeContent to also read the top match's text. Use when they ask to find, check, or read something in Notion.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const secret = await connectors.getNotionSecret(userId);
      if (!secret) {
        return {
          tool: "notion_search",
          status: "needs_connection",
          message: `Notion isn't connected yet, ${context.honorific} — connect it in Connectors.`,
        };
      }

      try {
        const pages = await notion.search(secret, payload.query);

        if (pages.length === 0) {
          return {
            tool: "notion_search",
            status: "ok",
            message: `No Notion pages matched "${payload.query}", ${context.honorific}.`,
            data: { query: payload.query, pages: [] },
          };
        }

        const lines = pages.map((p) => `• ${p.title} (${p.url})`);
        let content: string | undefined;
        if (payload.includeContent) {
          content = await notion.getPageContent(secret, pages[0].id).catch(() => undefined);
        }

        const contentBlock = content ? `\n\nContent of "${pages[0].title}":\n${content}` : "";

        return {
          tool: "notion_search",
          status: "ok",
          message: `${pages.length} Notion page${pages.length === 1 ? "" : "s"} matching "${payload.query}", ${context.honorific}:\n\n${lines.join("\n")}${contentBlock}`,
          data: { query: payload.query, pages },
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        if (code === "notion_api_401" || code === "notion_api_403") {
          return {
            tool: "notion_search",
            status: "needs_connection",
            message: `Notion rejected the saved connection, ${context.honorific} — reconnect it in Connectors.`,
          };
        }
        throw error;
      }
    },
  };
}
