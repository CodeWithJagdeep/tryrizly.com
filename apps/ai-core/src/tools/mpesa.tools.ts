import type { ConnectorService } from "../connectors/connector.service";
import type { MpesaService } from "../connectors/mpesa.service";
import type { HeyRizTool } from "./tool.types";
import { connectorSetupUrl } from "./connector-links";

type MpesaStatusPayload = Record<string, never>;

export function createMpesaStatusTool(
  connectors: ConnectorService,
  mpesa: MpesaService,
): HeyRizTool<MpesaStatusPayload> {
  return {
    name: "mpesa_status",
    category: "business",
    description:
      "Check the M-Pesa (Daraja) connection: verifies the saved credentials against Safaricom and reports the configured shortcode. Use when the principal asks about M-Pesa.",
    approvalRequired: false,
    sensitiveDataPolicy: "live_fetch_only",
    async execute({ userId, context }) {
      const secret = await connectors.getMpesaSecret(userId);
      if (!secret) {
        return {
          tool: "mpesa_status",
          status: "needs_connection",
          message: `M-Pesa isn't connected yet, ${context.honorific}. Add the Daraja credentials here: ${connectorSetupUrl("mpesa")}`,
        };
      }

      try {
        await mpesa.verifyCredentials(secret);
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        if (code === "mpesa_invalid_credentials") {
          return {
            tool: "mpesa_status",
            status: "needs_connection",
            message: `Safaricom rejected the saved Daraja credentials, ${context.honorific}. Reconnect it here: ${connectorSetupUrl("mpesa")}`,
          };
        }
        throw error;
      }

      return {
        tool: "mpesa_status",
        status: "ok",
        message: `M-Pesa is connected and the Daraja credentials are valid, ${context.honorific} (shortcode ${secret.shortcode}, ${secret.environment}). Balance and transaction lookups need Daraja's async callback flow, which isn't wired up yet — I'll be able to pull those once it is.`,
        data: { shortcode: secret.shortcode, environment: secret.environment },
      };
    },
  };
}
