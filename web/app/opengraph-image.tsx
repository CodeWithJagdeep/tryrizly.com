import { ImageResponse } from "next/og";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

export const alt = "Rizly, the Telegram-first AI operator";
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
          background: "#0d0d0d",
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(254,127,45,0.16), transparent)",
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
        { }
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
            The Telegram-first AI operator
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#a3a39e",
              maxWidth: 680,
              lineHeight: 1.5,
            }}
          >
            Triages Gmail, briefs your calendar, watches revenue, and asks
            before anything sensitive runs.
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
          <div style={{ fontSize: 18, color: "#8a8a85", fontWeight: 500 }}>
            getrizly.com
          </div>
          <div
            style={{
              background: "#FE7F2D",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 600,
              padding: "10px 24px",
              borderRadius: 8,
            }}
          >
            Start Free Trial
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
