import type { ConnectorService } from "../connectors/connector.service";
import type { GitHubService } from "../connectors/github.service";
import type { HeyRizTool } from "./tool.types";

type GitHubBriefingPayload = {
  /** Max items to list (default 10, max 20). */
  limit?: number;
};

export function createGitHubBriefingTool(
  connectors: ConnectorService,
  github: GitHubService,
): HeyRizTool<GitHubBriefingPayload> {
  return {
    name: "github_briefing",
    category: "business",
    description:
      "List the principal's open GitHub pull requests and issues (authored, assigned, mentioned, or awaiting their review), most recently active first. Use when they ask what's open or pending on GitHub.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const secret = await connectors.getGitHubSecret(userId);
      if (!secret) {
        return {
          tool: "github_briefing",
          status: "needs_connection",
          message: `GitHub isn't connected yet, ${context.honorific} — add a personal access token in Connectors.`,
        };
      }

      try {
        const login = await github.getViewerLogin(secret);
        const limit = Math.min(Math.max(payload.limit ?? 10, 1), 20);
        const items = await github.listOpenInvolvements(secret, login, limit);

        if (items.length === 0) {
          return {
            tool: "github_briefing",
            status: "ok",
            message: `Nothing open on GitHub involving @${login}, ${context.honorific}.`,
            data: { login, items: [] },
          };
        }

        const lines = items.map((item) => {
          const repo = item.repository_url.split("/repos/")[1] ?? "";
          const kind = item.pull_request ? "PR" : "issue";
          return `• [${kind}] ${repo}#${item.number}: ${item.title} (${item.html_url})`;
        });

        return {
          tool: "github_briefing",
          status: "ok",
          message: `${items.length} open item${items.length === 1 ? "" : "s"} involving @${login}, ${context.honorific}:\n\n${lines.join("\n")}`,
          data: { login, count: items.length },
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        if (code === "github_invalid_token") {
          return {
            tool: "github_briefing",
            status: "needs_connection",
            message: `GitHub rejected the saved token, ${context.honorific} — it may have expired; re-enter it in Connectors.`,
          };
        }
        throw error;
      }
    },
  };
}
