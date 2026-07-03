import { env } from "./env";
import { logger } from "./logger";

const API = "https://api.resend.com/emails";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
    logger.info("email not sent (missing Resend config); logged instead", {
      to: opts.to,
      subject: opts.subject,
    });
    return false;
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        reply_to: opts.replyTo,
      }),
    });

    if (!res.ok) {
      logger.error("email send failed", { to: opts.to, subject: opts.subject, status: res.status });
      return false;
    }
    return true;
  } catch (error) {
    logger.error("email send threw", {
      to: opts.to,
      subject: opts.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
