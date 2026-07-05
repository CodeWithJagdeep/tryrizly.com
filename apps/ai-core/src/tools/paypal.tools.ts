import type { ConnectorService } from "../connectors/connector.service";
import type { PayPalService, PayPalTransaction } from "../connectors/paypal.service";
import type { HeyRizTool } from "./tool.types";

type PayPalSnapshotPayload = {
  /** How many days of transactions to include (default 7, max 31). */
  days?: number;
};

export function createPayPalSnapshotTool(
  connectors: ConnectorService,
  paypal: PayPalService,
): HeyRizTool<PayPalSnapshotPayload> {
  return {
    name: "paypal_snapshot",
    category: "business",
    description:
      "Read-only PayPal snapshot: current balances and recent transactions. Use when the principal asks about PayPal revenue, payments, or balance.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, payload, context }) {
      const secret = await connectors.getPayPalSecret(userId);
      if (!secret) {
        return {
          tool: "paypal_snapshot",
          status: "needs_connection",
          message: `PayPal isn't connected yet, ${context.honorific} — add your REST app client ID and secret in Connectors.`,
        };
      }

      const days = Math.min(Math.max(payload.days ?? 7, 1), 31);
      const end = new Date();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

      try {
        const [balances, transactions] = await Promise.all([
          paypal.getBalances(secret).catch(() => undefined),
          paypal.getTransactions(secret, start, end),
        ]);

        const txns = transactions.transaction_details ?? [];
        const lines = txns.slice(0, 10).map((t) => formatTransaction(t));
        const balanceLine = (balances?.balances ?? [])
          .map((b) => `${b.total_balance?.value ?? "?"} ${b.total_balance?.currency_code ?? b.currency ?? ""}`)
          .filter(Boolean)
          .join(", ");

        const parts = [
          balanceLine ? `Balance: ${balanceLine}` : undefined,
          txns.length === 0
            ? `No PayPal transactions in the last ${days} day${days === 1 ? "" : "s"}.`
            : `${txns.length} transaction${txns.length === 1 ? "" : "s"} in the last ${days} day${days === 1 ? "" : "s"}:\n${lines.join("\n")}`,
        ].filter(Boolean);

        return {
          tool: "paypal_snapshot",
          status: "ok",
          message: `${parts.join("\n\n")}`,
          data: { balances: balances?.balances ?? [], transactionCount: txns.length },
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        if (code === "paypal_invalid_credentials") {
          return {
            tool: "paypal_snapshot",
            status: "needs_connection",
            message: `PayPal rejected the saved credentials, ${context.honorific} — re-enter the client ID and secret in Connectors.`,
          };
        }
        if (code === "paypal_reporting_not_enabled") {
          return {
            tool: "paypal_snapshot",
            status: "ok",
            message: `PayPal is connected but the "Transaction Search" product isn't enabled on that REST app, ${context.honorific}. Enable it in the PayPal developer dashboard and try again.`,
          };
        }
        throw error;
      }
    },
  };
}

function formatTransaction(t: PayPalTransaction): string {
  const info = t.transaction_info ?? {};
  const amount = info.transaction_amount;
  const who = t.payer_info?.payer_name?.alternate_full_name ?? t.payer_info?.email_address;
  const when = info.transaction_initiation_date
    ? new Date(info.transaction_initiation_date).toISOString().slice(0, 10)
    : "";
  return `• ${amount?.value ?? "?"} ${amount?.currency_code ?? ""} — ${info.transaction_status ?? "?"}${who ? ` from ${who}` : ""}${when ? ` (${when})` : ""}`;
}
