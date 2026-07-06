import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Fallbacks for deploys where env vars aren't configured (Cloud Run).
  // Real env vars always take precedence. WARNING: this includes secrets
  // baked into a private repo at the owner's request. If the repo ever
  // goes public, rotate AUTH_*, RESEND_API_KEY, and TELEGRAM_BOT_TOKEN.
  // AUTH_* values must match the gateway env on the production VM.
  env: {
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com",
    AUTH_INTERNAL_SECRET:
      process.env.AUTH_INTERNAL_SECRET ??
      "REDACTED",
    AUTH_JWT_SECRET:
      process.env.AUTH_JWT_SECRET ??
      "REDACTED",
    RESEND_API_KEY:
      process.env.RESEND_API_KEY ?? "REDACTED",
    RESEND_FROM: process.env.RESEND_FROM ?? "Rizly <noreply@getrizly.com>",
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME ?? "tryrizlybot",
    TELEGRAM_BOT_TOKEN:
      process.env.TELEGRAM_BOT_TOKEN ??
      "REDACTED",
    GOOGLE_CLIENT_ID:
      process.env.GOOGLE_CLIENT_ID ??
      "927489744703-ipmeciigf234kkceflkatb0o6pg55tlu.apps.googleusercontent.com",
    GOOGLE_LOGIN_REDIRECT_URI:
      process.env.GOOGLE_LOGIN_REDIRECT_URI ??
      "https://getrizly.com/api/auth/google/callback",
    LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID ?? "86doutttnd7s6s",
    LINKEDIN_REDIRECT_URI:
      process.env.LINKEDIN_REDIRECT_URI ??
      "https://getrizly.com/api/auth/oauth/linkedin/callback",
    LINKEDIN_SCOPES:
      process.env.LINKEDIN_SCOPES ?? "openid profile email",
    NEXT_PUBLIC_GATEWAY_URL:
      process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://api.getrizly.com",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
      "BBOVlHAJfin3t1acBGcbqeXh5WKzk3mxsMO7cU0b1dj_MZbwdLLHzz8Yj1rV6G4hIZVt6GYfQan9VYFxNoDbYgQ",
    WEB_APP_URL: process.env.WEB_APP_URL ?? "https://getrizly.com",
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
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
