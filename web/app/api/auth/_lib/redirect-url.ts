const PRODUCTION_WEB_APP_URL = "https://getrizly.com";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

type RedirectEnvironment = {
  WEB_APP_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

function localOrigin(requestUrl: URL): string {
  // 0.0.0.0 and :: are bind addresses, not browser destinations. Keep the
  // active development port but always return through the canonical loopback
  // hostname registered with the OAuth providers.
  const local = new URL("http://localhost");
  local.port = requestUrl.port;
  return local.origin;
}

function productionBaseUrl(environment: RedirectEnvironment): URL {
  for (const value of [environment.WEB_APP_URL, environment.NEXT_PUBLIC_SITE_URL]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !LOCAL_HOSTS.has(url.hostname)) {
        return new URL(url.origin);
      }
    } catch {
      // Ignore malformed deployment configuration and use the canonical site.
    }
  }

  return new URL(PRODUCTION_WEB_APP_URL);
}

export function getAuthRedirectBaseUrl(
  requestUrl: URL,
  environment: RedirectEnvironment = process.env as RedirectEnvironment,
): string {
  if (LOCAL_HOSTS.has(requestUrl.hostname)) {
    return localOrigin(requestUrl);
  }

  return productionBaseUrl(environment).origin;
}

export function resolveOAuthCallbackUrl(
  requestUrl: URL,
  callbackPath: string,
  configuredRedirectUri: string | undefined,
  environment: RedirectEnvironment = process.env as RedirectEnvironment,
): string {
  if (LOCAL_HOSTS.has(requestUrl.hostname)) {
    return new URL(callbackPath, localOrigin(requestUrl)).toString();
  }

  if (configuredRedirectUri) {
    try {
      const configured = new URL(configuredRedirectUri);
      if (
        configured.protocol === "https:" &&
        !LOCAL_HOSTS.has(configured.hostname) &&
        configured.pathname === callbackPath &&
        !configured.search &&
        !configured.hash
      ) {
        return configured.toString();
      }
    } catch {
      // Fall through to the deployment's public web origin.
    }
  }

  return new URL(callbackPath, productionBaseUrl(environment)).toString();
}
