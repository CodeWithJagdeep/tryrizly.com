import { ImageResponse } from "next/og";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

export const alt = "Rizly — Proactive AI Operator for Founders";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const logoData = await readFile(
    join(process.cwd(), "public", "rizly-wordmark-white.png"),
    "base64",
  );
  const logoSrc = `data:image/png;base64,${logoData}`;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0f1e",
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(55,132,255,0.18), transparent)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "64px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" height={64} />

        {/* main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.1,
              maxWidth: 820,
              letterSpacing: "-0.02em",
            }}
          >
            Proactive AI Operator for Founders
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#8b9cb8",
              maxWidth: 680,
              lineHeight: 1.5,
            }}
          >
            Monitors your inbox, calendar, and tools inside Telegram. Only
            speaks up when it matters.
          </div>
        </div>

        {/* bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ fontSize: 18, color: "#4a5568", fontWeight: 500 }}>
            getrizly.com
          </div>
          <div
            style={{
              background: "#3784ff",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 600,
              padding: "10px 24px",
              borderRadius: 8,
            }}
          >
            Get Early Access
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
