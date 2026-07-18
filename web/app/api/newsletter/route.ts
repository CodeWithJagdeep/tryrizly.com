import { NextResponse } from "next/server";
import { rateLimit } from "../_lib/rate-limit";

const NOTIFY_INBOX = process.env.HIRING_EMAIL || "hello@getrizly.com";

export async function POST(request: Request) {
  const limited = await rateLimit(request, "newsletter", { limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!resendKey || !from) {
    console.error("[Rizly Newsletter] Email delivery is not configured");
    return NextResponse.json({ error: "delivery_unavailable" }, { status: 503 });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${resendKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: NOTIFY_INBOX,
      subject: "New newsletter subscriber",
      text: `${email} just subscribed to the Rizly newsletter from the footer form.`,
    }),
  });

  if (!response.ok) {
    console.error("Failed to notify newsletter subscription", await response.text().catch(() => ""));
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
