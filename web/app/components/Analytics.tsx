"use client";

import Clarity from "@microsoft/clarity";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";

/** Same key CookieNotice has always written — pre-existing "accepted" choices enable analytics without re-prompting. */
export const COOKIE_CONSENT_KEY = "rizly-cookie-notice-dismissed";
export const COOKIE_CONSENT_EVENT = "rizly:cookie-consent";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Consent is an external store: localStorage holds the choice, and CookieNotice
// dispatches COOKIE_CONSENT_EVENT after writing it so same-session grants are
// picked up without a reload. Server snapshot is always "no consent".
function subscribeConsent(callback: () => void) {
  window.addEventListener(COOKIE_CONSENT_EVENT, callback);
  return () => window.removeEventListener(COOKIE_CONSENT_EVENT, callback);
}

function readConsent(): boolean {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

/**
 * Google Analytics 4 + Microsoft Clarity, gated on explicit opt-in: nothing
 * loads until the stored cookie choice is "accepted" (see CookieNotice), and
 * both stay off entirely when their env IDs are unset. GA's initial config
 * call reports the landing page view itself; the pathname effect below covers
 * client-side navigations, which GA can't see on its own. Clarity handles SPA
 * navigation natively, and its custom events/identify go through the typed
 * `Clarity.*` API from @microsoft/clarity.
 */
export function Analytics() {
  const consented = useSyncExternalStore(subscribeConsent, readConsent, () => false);
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!consented || !CLARITY_ID) return;
    // init() self-guards against double-injection, so Strict Mode re-runs are
    // fine. We only ever init after opt-in, so signal full analytics consent.
    Clarity.init(CLARITY_ID);
    Clarity.consentV2({ ad_Storage: "denied", analytics_Storage: "granted" });
  }, [consented]);

  useEffect(() => {
    if (!consented || !GA_ID || !window.gtag) return;
    if (lastPath.current === null || lastPath.current === pathname) {
      lastPath.current = pathname;
      return;
    }
    lastPath.current = pathname;
    window.gtag("event", "page_view", { page_path: pathname });
  }, [pathname, consented]);

  if (!consented || !GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
