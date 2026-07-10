const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export function getAuthRedirectBaseUrl(requestUrl: URL): string {
  if (LOCAL_HOSTS.has(requestUrl.hostname)) {
    return requestUrl.origin;
  }

  return process.env.WEB_APP_URL || requestUrl.origin;
}
