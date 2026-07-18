import { NextResponse } from "next/server";
import { rateLimit } from "../_lib/rate-limit";

const CONTACT_INBOX = process.env.CONTACT_EMAIL || "hello@getrizly.com";

export async function POST(request: Request) {
  const limited = await rateLimit(request, "contact", { limit: 5, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const company = String(body.company || "").trim();
  const inquiryType = String(body.inquiryType || "").trim();
  const message = String(body.message || "").trim();

  if (
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !inquiryType ||
    !message ||
    name.length > 120 ||
    company.length > 160 ||
    inquiryType.length > 80 ||
    message.length > 10_000
  ) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!resendKey || !from) {
    console.error("[Rizly Contact] Email delivery is not configured");
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
      to: CONTACT_INBOX,
      reply_to: email,
      subject: `[${inquiryType}] New message from ${name}`,
      text: [
        `Inquiry type: ${inquiryType}`,
        `Name: ${name}`,
        `Email: ${email}`,
        `Company: ${company || "—"}`,
        "",
        message,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    console.error("Failed to send contact email", await response.text().catch(() => ""));
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
