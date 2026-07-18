import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.dirname(fileURLToPath(import.meta.url));
const isProductionBuild = process.env.NODE_ENV === "production";

// The frontend host does not inject runtime environment variables. Keep these
// public production identifiers deterministic at build time so a developer
// .env file can never send production users back to localhost.
const productionFrontend = {
  siteUrl: "https://getrizly.com",
  gatewayUrl: "https://api.getrizly.com",
  googleClientId:
    "927489744703-ipmeciigf234kkceflkatb0o6pg55tlu.apps.googleusercontent.com",
  googleCallbackUrl: "https://getrizly.com/api/auth/google/callback",
  linkedInClientId: "86doutttnd7s6s",
  linkedInCallbackUrl:
    "https://getrizly.com/api/auth/oauth/linkedin/callback",
} as const;

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(webDir, ".."),
  // Fallbacks for deploys where env vars aren't configured. Real env vars
  // always take precedence. WARNING: this includes secrets baked into a
  // private repo at the owner's request. If the repo ever goes public,
  // rotate AUTH_*, RESEND_API_KEY, and TELEGRAM_BOT_TOKEN. AUTH_* values
  // must match the gateway env on the production VM.
  env: {
    NEXT_PUBLIC_SITE_URL:
      isProductionBuild
        ? productionFrontend.siteUrl
        : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    AUTH_INTERNAL_SECRET:
      process.env.AUTH_INTERNAL_SECRET ??
      "REDACTED",
    AUTH_JWT_SECRET:
      process.env.AUTH_JWT_SECRET ??
      "REDACTED",
    RESEND_API_KEY:
      process.env.RESEND_API_KEY ?? "REDACTED",
    TELEGRAM_BOT_TOKEN:
      process.env.TELEGRAM_BOT_TOKEN ??
      "REDACTED",
    RESEND_FROM: process.env.RESEND_FROM ?? "Rizly <noreply@getrizly.com>",
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME ?? "tryrizlybot",
    GOOGLE_CLIENT_ID:
      isProductionBuild
        ? productionFrontend.googleClientId
        : process.env.GOOGLE_CLIENT_ID ?? productionFrontend.googleClientId,
    GOOGLE_LOGIN_REDIRECT_URI:
      isProductionBuild
        ? productionFrontend.googleCallbackUrl
        : process.env.GOOGLE_LOGIN_REDIRECT_URI ??
          "http://localhost:3000/api/auth/google/callback",
    LINKEDIN_CLIENT_ID: isProductionBuild
      ? productionFrontend.linkedInClientId
      : process.env.LINKEDIN_CLIENT_ID ?? productionFrontend.linkedInClientId,
    LINKEDIN_REDIRECT_URI:
      isProductionBuild
        ? productionFrontend.linkedInCallbackUrl
        : process.env.LINKEDIN_REDIRECT_URI ??
          "http://localhost:3000/api/auth/oauth/linkedin/callback",
    LINKEDIN_SCOPES:
      process.env.LINKEDIN_SCOPES ?? "openid profile email",
    NEXT_PUBLIC_GATEWAY_URL:
      isProductionBuild
        ? productionFrontend.gatewayUrl
        : process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
      "BBOVlHAJfin3t1acBGcbqeXh5WKzk3mxsMO7cU0b1dj_MZbwdLLHzz8Yj1rV6G4hIZVt6GYfQan9VYFxNoDbYgQ",
    WEB_APP_URL: isProductionBuild
      ? productionFrontend.siteUrl
      : process.env.WEB_APP_URL ?? "http://localhost:3000",
    // Analytics IDs (public, non-secret). Empty string = that script never loads.
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "",
    NEXT_PUBLIC_CLARITY_PROJECT_ID: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "",
  },
  images: {
    qualities: [75, 100],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'api.getrizly.com',
        pathname: '/images/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000',
        pathname: '/images/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // cache static assets aggressively
        source: "/(.*)\\.(ico|png|svg|webp|jpg|jpeg|woff2|woff|ttf)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // no-index auth/app pages
        source: "/(login|signup|dashboard|onboarding)(.*)",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
