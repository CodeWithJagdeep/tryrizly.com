import { NextResponse } from "next/server";
import { rateLimit } from "../../_lib/rate-limit";

const HIRING_INBOX = process.env.HIRING_EMAIL || "careers@getrizly.com";
const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5MB, matches the form's own "max 5MB" label

export async function POST(request: Request) {
  const limited = await rateLimit(request, "careers", { limit: 5, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_RESUME_BYTES + 512 * 1024) {
    return NextResponse.json({ error: "request_too_large" }, { status: 413 });
  }
  const formData = await request.formData();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const role = String(formData.get("role") || "").trim();
  const coverNote = String(formData.get("coverNote") || "").trim();
  const resume = formData.get("resume");

  if (
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !role ||
    name.length > 120 ||
    phone.length > 40 ||
    role.length > 160 ||
    coverNote.length > 10_000
  ) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  let resumeBuffer: Buffer | null = null;
  if (resume instanceof File && resume.size > 0) {
    if (resume.size > MAX_RESUME_BYTES) {
      return NextResponse.json({ error: "resume_too_large" }, { status: 413 });
    }
    // Validate by content, not the declared MIME type: the type header is
    // client-controlled and can simply be omitted, so an arbitrary binary could
    // otherwise ride through as "resume.pdf". Require the real %PDF- signature.
    resumeBuffer = Buffer.from(await resume.arrayBuffer());
    if (resumeBuffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return NextResponse.json({ error: "resume_must_be_pdf" }, { status: 400 });
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!resendKey || !from) {
    console.error("[Rizly Careers] Email delivery is not configured");
    return NextResponse.json({ error: "delivery_unavailable" }, { status: 503 });
  }

  const attachments: { filename: string; content: string }[] = [];
  if (resumeBuffer) {
    attachments.push({ filename: "resume.pdf", content: resumeBuffer.toString("base64") });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${resendKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: HIRING_INBOX,
      reply_to: email,
      subject: `New application: ${role} — ${name}`,
      text: [
        `Role: ${role}`,
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone || "—"}`,
        "",
        coverNote || "(no cover note)",
      ].join("\n"),
      attachments: attachments.length ? attachments : undefined,
    }),
  });

  if (!response.ok) {
    console.error("Failed to send application email", await response.text().catch(() => ""));
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
