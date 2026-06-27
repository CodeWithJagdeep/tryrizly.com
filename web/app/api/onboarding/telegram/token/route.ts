import QRCode from "qrcode";
import { callGateway } from "@/app/api/auth/_lib/gateway";
import { requireSession } from "../../_lib/require-user";

let cachedBotUsername: string | undefined;

async function resolveBotUsername(): Promise<string | null> {
  if (process.env.TELEGRAM_BOT_USERNAME) return process.env.TELEGRAM_BOT_USERNAME;
  if (cachedBotUsername) return cachedBotUsername;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: { username?: string } };
  if (!json.result?.username) return null;

  cachedBotUsername = json.result.username;
  return cachedBotUsername;
}

export async function POST() {
  const session = await requireSession();
  if (!session) {
    return Response.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const botUsername = await resolveBotUsername();
  if (!botUsername) {
    return Response.json({ message: "Telegram bot is not configured" }, { status: 500 });
  }

  const { token } = await callGateway<{ token: string }>("/api/auth/onboarding/telegram-token", {
    email: session.email,
  });
  const deepLink = `https://t.me/${botUsername}?start=${token}`;
  const qrCode = await QRCode.toDataURL(deepLink, { margin: 1, width: 240 });

  return Response.json({ deepLink, qrCode });
}
