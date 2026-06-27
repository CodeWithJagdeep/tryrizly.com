import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HeyRiz - Proactive AI Operator for Founders";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0f1e",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "72px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* top accent line */}
        <div
          style={{
            width: 48,
            height: 3,
            background: "#3784ff",
            borderRadius: 2,
          }}
        />

        {/* main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#3784ff",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            HeyRiz
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.1,
              maxWidth: 800,
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
            Monitors your inbox, calendar, and tools inside Telegram. Only speaks up when it matters.
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
            heyriz.co
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
