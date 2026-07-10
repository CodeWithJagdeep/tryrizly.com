const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";

/** Builds an absolute URL for a marketing asset (video/image) served from the gateway's static file host. */
export function mediaUrl(path: string): string {
  return `${GATEWAY_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * True when the gateway resolves to a loopback host (local dev). Next's image optimizer
 * refuses to fetch private/loopback IPs (SSRF guard), so gateway-hosted images need
 * `unoptimized` in that case — production's gateway is a public hostname, so this is
 * effectively a dev-only escape hatch.
 */
export const isLocalMedia = /^https?:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?/.test(GATEWAY_URL);
