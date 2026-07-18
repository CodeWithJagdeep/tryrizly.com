import { env } from "@heyriz/shared/env";
import type { ConnectorProvider } from "../connectors/connector.types";

export function connectorSetupUrl(provider: ConnectorProvider): string {
  if (provider === "notion") {
    const returnTo = `/dashboard/connectors?connected=${provider}`;
    return `${env.WEB_APP_URL}/api/connectors/notion/start?returnTo=${encodeURIComponent(returnTo)}`;
  }
  return `${env.WEB_APP_URL}/dashboard/connectors?setup=${encodeURIComponent(provider)}`;
}
