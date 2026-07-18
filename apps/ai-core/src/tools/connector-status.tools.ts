import { env } from "@heyriz/shared/env";
import type { ConnectorService } from "../connectors/connector.service";
import type { ConnectorProvider } from "../connectors/connector.types";
import type { HeyRizTool } from "./tool.types";

type ConnectorStatusPayload = Record<string, never>;

const CAPABILITIES: Partial<Record<ConnectorProvider, string>> = {
  gmail: 'inbox triage and drafting — try "check my inbox"',
  calendar: 'schedule and conflicts — try "what is on today?"',
  calcom: 'bookings — try "check my Cal.com meetings"',
  notion: 'pages and knowledge — try "show recently edited Notion pages"',
  slack: 'joined channels — try "what happened in Slack #sales?"',
  github: 'PRs and issues — try "show GitHub work waiting on me"',
  discord: 'channel updates and approved posts — try "what is new in Discord?"',
  stripe: 'payments, subscriptions, and MRR — try "check Stripe MRR"',
  razorpay: 'payments and settlements — try "check Razorpay today"',
  paypal: 'balances and transactions — try "check PayPal this week"',
  mpesa: 'Daraja connection status — try "check M-Pesa"',
  postgres: 'read-only business questions',
  mongodb: 'read-only business questions',
};

export function createConnectorStatusTool(connectors: ConnectorService): HeyRizTool<ConnectorStatusPayload> {
  return {
    name: "connector_status",
    category: "business",
    description:
      "List the principal's connected sources and explain what they can ask through Telegram. Use for questions like 'what is connected?', 'what can you access?', or 'what can you do with my integrations?'.",
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, context }) {
      const connected = (await connectors.list(userId)).filter((account) => account.status === "connected");
      if (connected.length === 0) {
        return {
          tool: "connector_status",
          status: "ok",
          message: `No external sources are connected yet, ${context.honorific}. Add one here: ${env.WEB_APP_URL}/dashboard/connectors`,
          data: { connected: [] },
        };
      }

      const lines = connected.map((account) => {
        const capability = CAPABILITIES[account.provider] ?? "connected";
        return `• ${account.label}: ${capability}`;
      });
      return {
        tool: "connector_status",
        status: "ok",
        message: `Connected sources · ${connected.length}\n\n${lines.join("\n")}\n\nManage access: ${env.WEB_APP_URL}/dashboard/connectors`,
        data: { connected: connected.map(({ id, provider, label }) => ({ id, provider, label })) },
      };
    },
  };
}
