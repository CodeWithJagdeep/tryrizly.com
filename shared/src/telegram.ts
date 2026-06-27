import { env } from "./env";
import { logger } from "./logger";

const API = "https://api.telegram.org";

export type TelegramInlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

/**
 * Approve / cancel buttons attached to an approval-gated proposal. When an
 * actionId is given it is embedded in the callback data (`approve:<id>`), so a
 * specific proposal's buttons resolve to that exact action even when several
 * are pending at once.
 */
export function approvalKeyboard(actionId?: string): TelegramInlineKeyboard {
  const suffix = actionId ? `:${actionId}` : "";
  return {
    inline_keyboard: [
      [
        { text: "✅ Do it", callback_data: `approve${suffix}` },
        { text: "❌ Cancel", callback_data: `reject${suffix}` },
      ],
    ],
  };
}

export async function sendTelegramMessage(opts: {
  chatId: string | number | undefined;
  text: string;
  replyMarkup?: TelegramInlineKeyboard;
}): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !opts.chatId) {
    logger.info("telegram message not sent (missing token/chat); logged instead", {
      text: opts.text.slice(0, 200),
    });
    return false;
  }

  const res = await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: opts.chatId,
      text: opts.text,
      reply_markup: opts.replyMarkup,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("telegram send failed", { status: res.status, body: body.slice(0, 300) });
    return false;
  }
  return true;
}

export async function sendTyping(chatId: string | number | undefined): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return;
  await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/sendChatAction`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => undefined);
}

export async function answerCallbackQuery(id: string, text?: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ callback_query_id: id, text }),
  }).catch(() => undefined);
}

export async function deleteTelegramWebhook(): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/deleteWebhook`, { method: "POST" }).catch(
    () => undefined,
  );
}

export type TelegramApiUpdate = { update_id: number } & Record<string, unknown>;

/** Long-polls Telegram for new updates. Resolves with [] if none arrive within `timeoutSeconds`. */
export async function getTelegramUpdates(
  offset: number,
  timeoutSeconds: number,
): Promise<TelegramApiUpdate[]> {
  if (!env.TELEGRAM_BOT_TOKEN) return [];
  const params = new URLSearchParams({
    offset: String(offset),
    timeout: String(timeoutSeconds),
    allowed_updates: JSON.stringify(["message", "callback_query"]),
  });
  const res = await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?${params}`);
  if (!res.ok) {
    throw new Error(`getUpdates failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { ok: boolean; result?: TelegramApiUpdate[] };
  return json.result ?? [];
}

/**
 * Downloads a Telegram voice note and transcribes it via OpenAI Whisper.
 * Returns undefined if the bot token, OpenAI key, or either HTTP call is unavailable —
 * callers should fall back to telling the principal voice notes aren't supported right now.
 */
export async function transcribeTelegramVoice(fileId: string): Promise<string | undefined> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.OPENAI_API_KEY) return undefined;

  try {
    const fileRes = await fetch(
      `${API}/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );
    if (!fileRes.ok) return undefined;
    const fileJson = (await fileRes.json()) as { ok: boolean; result?: { file_path?: string } };
    const filePath = fileJson.result?.file_path;
    if (!filePath) return undefined;

    const audioRes = await fetch(`${API}/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`);
    if (!audioRes.ok) return undefined;
    const audioBlob = await audioRes.blob();

    const form = new FormData();
    form.append("file", audioBlob, "voice.ogg");
    form.append("model", "whisper-1");

    const transcribeRes = await fetch(`${env.OPENAI_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
    });
    if (!transcribeRes.ok) {
      logger.error("voice transcription failed", { status: transcribeRes.status });
      return undefined;
    }
    const json = (await transcribeRes.json()) as { text?: string };
    return json.text?.trim() || undefined;
  } catch (error) {
    logger.error("voice transcription threw", {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

export async function setTelegramWebhook(url: string): Promise<unknown> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const res = await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET || undefined,
      allowed_updates: ["message", "callback_query"],
    }),
  });
  return res.json();
}
