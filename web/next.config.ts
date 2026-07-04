import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Fallbacks for deploys where env vars aren't configured (e.g. Vercel).
  // Real env vars always take precedence. Only public-safe values belong
  // here: the client ID and redirect URI appear in the OAuth URL anyway.
  // GOOGLE_CLIENT_SECRET must stay a real env var and is never needed here.
  env: {
    GOOGLE_CLIENT_ID:
      process.env.GOOGLE_CLIENT_ID ??
      "927489744703-ipmeciigf234kkceflkatb0o6pg55tlu.apps.googleusercontent.com",
    GOOGLE_LOGIN_REDIRECT_URI:
      process.env.GOOGLE_LOGIN_REDIRECT_URI ??
      "https://getrizly.com/api/auth/google/callback",
    LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID ?? "77q1dwz0kefw6u",
    LINKEDIN_REDIRECT_URI:
      process.env.LINKEDIN_REDIRECT_URI ??
      "https://getrizly.com/api/auth/oauth/linkedin/callback",
    LINKEDIN_SCOPES: process.env.LINKEDIN_SCOPES ?? "openid profile email",
    NEXT_PUBLIC_GATEWAY_URL:
      process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://api.getrizly.com",
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
