import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_GATEWAY_URL: "https://api.getrizly.com",
    NEXT_PUBLIC_SITE_URL: "https://getrizly.com",
    WEB_APP_URL: "https://getrizly.com",
    AUTH_JWT_SECRET: "2CAK52uRNuzrSxFrdRNRZexpB5Qqc/go44RNbF7CrvjKFoXAkmk24QueAv1p9G35",
    AUTH_INTERNAL_SECRET: "Y78vEBQB8cNNqM6bSnv7w0GfSp6qomcAoNdJdY6o2/6fddxea1ZM8Q1cjcsb4eao",
    GOOGLE_CLIENT_ID: "927489744703-ipmeciigf234kkceflkatb0o6pg55tlu.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "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",
    GOOGLE_REDIRECT_URI: "https://api.getrizly.com/api/connectors/google/callback",
    GOOGLE_LOGIN_REDIRECT_URI: "https://getrizly.com/api/auth/google/callback",
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
