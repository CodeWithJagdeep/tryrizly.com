export const PRODUCTION_WEB_APP_URL = "https://getrizly.com";

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
]);

export function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname.toLowerCase());
}

/**
 * Return a stable origin for links and redirects produced by backend services.
 * A production process must never send a user to a loopback address, even if a
 * developer .env file was loaded accidentally.
 */
export function resolveWebAppUrl(
  configuredUrl: string,
  nodeEnv: string | undefined,
): string {
  const url = new URL(configuredUrl);

  if (
    nodeEnv === "production" &&
    (url.protocol !== "https:" || isLocalHostname(url.hostname))
  ) {
    return PRODUCTION_WEB_APP_URL;
  }

  return url.origin;
}
