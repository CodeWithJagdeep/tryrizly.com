import type { ReactNode } from "react";
import { CONNECTOR_LOGO_MANIFEST } from "../../lib/connector-logo-manifest";

/**
 * Renders a connector's official logo from a locally pre-downloaded copy
 * (see web/scripts/download-connector-logos.mjs — run `npm run logos:download`
 * to (re)populate web/public/connector-logos/). The running app never calls
 * Brandfetch itself; this just serves a static file, or falls back to the
 * given hand-drawn icon if that connector has no downloaded logo yet.
 */
export function ConnectorLogo({
  provider,
  alt,
  className,
  fallback,
}: {
  provider: string | undefined;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const filename = provider ? CONNECTOR_LOGO_MANIFEST[provider] : undefined;
  if (!filename) return <>{fallback}</>;

  return <img src={`/connector-logos/${filename}`} alt={alt} className={className} />;
}
