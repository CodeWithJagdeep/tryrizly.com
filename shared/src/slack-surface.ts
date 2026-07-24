import { env } from "./env";
import { logger } from "./logger";

/**
 * Slack as a chat *surface* (the principal talks to Rizly in a Slack DM),
 * mirroring ./telegram.ts. Distinct from the ai-core Slack connector, which
 * reads the principal's own workspace with a per-user token: the surface bot
 * is one app-level bot (SLACK_SURFACE_BOT_TOKEN), like the one Telegram bot.
 */

const API = "https://slack.com/api";

type SlackApiResponse = { ok: boolean; error?: string } & Record<string, unknown>;

async function slackApi(
  method: string,
  token: string,
  body: Record<string, unknown>,
): Promise<SlackApiResponse | null> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    logger.error("slack api http failure", { method, status: res.status });
    return null;
  }
  const json = (await res.json()) as SlackApiResponse;
  if (!json.ok) {
    logger.error("slack api error", { method, error: json.error });
  }
  return json;
}

export type SlackBlock = Record<string, unknown>;

/**
 * Approve / cancel buttons attached to an approval-gated proposal — the Block
 * Kit analog of telegram.ts approvalKeyboard. The action id embeds the
 * pending-approval id (`approve:<id>`) so a specific proposal's buttons
 * resolve to that exact action even when several are pending at once.
 */
export function approvalActionBlocks(text: string, actionId?: string): SlackBlock[] {
  const suffix = actionId ? `:${actionId}` : "";
  // Slack caps section text at 3000 chars; the full text still travels in the
  // message's `text` fallback, so truncation here only affects the rich view.
  const sectionText = text.length > 2900 ? `${text.slice(0, 2900)}…` : text;
  return [
    { type: "section", text: { type: "mrkdwn", text: sectionText } },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          style: "primary",
          text: { type: "plain_text", text: "✅ Do it", emoji: true },
          action_id: `approve${suffix}`,
          value: `approve${suffix}`,
        },
        {
          type: "button",
          style: "danger",
          text: { type: "plain_text", text: "❌ Cancel", emoji: true },
          action_id: `reject${suffix}`,
          value: `reject${suffix}`,
        },
      ],
    },
  ];
}

export async function sendSlackSurfaceMessage(opts: {
  channel: string | undefined;
  text: string;
  blocks?: SlackBlock[];
  /** Workspace-specific bot token (OAuth installs); falls back to the home-workspace env token. */
  botToken?: string;
}): Promise<boolean> {
  const token = opts.botToken ?? env.SLACK_SURFACE_BOT_TOKEN;
  if (!token || !opts.channel) {
    logger.info("slack surface message not sent (missing token/channel); logged instead", {
      text: opts.text.slice(0, 200),
    });
    return false;
  }
  const json = await slackApi("chat.postMessage", token, {
    channel: opts.channel,
    text: opts.text,
    blocks: opts.blocks,
  });
  return Boolean(json?.ok);
}

/**
 * Posts a short-lived "Thinking…" placeholder while the agent works — Slack's
 * analog of Telegram's sendChatAction typing indicator (Slack has no bare
 * typing event over the Web API/Socket Mode). Returns the message ts so the
 * caller can edit it in place via updateSlackSurfaceMessage, or null if it
 * couldn't be posted (missing token/channel — caller falls back to a normal send).
 */
export async function sendSlackPlaceholder(opts: {
  channel: string | undefined;
  botToken?: string;
  text?: string;
}): Promise<string | null> {
  const token = opts.botToken ?? env.SLACK_SURFACE_BOT_TOKEN;
  if (!token || !opts.channel) return null;
  const json = await slackApi("chat.postMessage", token, {
    channel: opts.channel,
    text: opts.text ?? "_Thinking…_",
  });
  const ts = json?.ts;
  return typeof ts === "string" ? ts : null;
}

/** Edits a previously-sent message in place — used to replace the "Thinking…" placeholder with the real reply. */
export async function updateSlackSurfaceMessage(opts: {
  channel: string;
  ts: string;
  text: string;
  blocks?: SlackBlock[];
  botToken?: string;
}): Promise<boolean> {
  const token = opts.botToken ?? env.SLACK_SURFACE_BOT_TOKEN;
  if (!token) return false;
  const json = await slackApi("chat.update", token, {
    channel: opts.channel,
    ts: opts.ts,
    text: opts.text,
    blocks: opts.blocks,
  });
  return Boolean(json?.ok);
}

/**
 * Opens (or fetches) the 1:1 DM channel between the surface bot and a Slack
 * user, for proactive sends — Slack's analog of already knowing a Telegram
 * chatId. Returns the DM channel id, or null if unavailable.
 */
export async function openSlackDm(
  slackUserId: string,
  botToken?: string,
): Promise<string | null> {
  const token = botToken ?? env.SLACK_SURFACE_BOT_TOKEN;
  if (!token) return null;
  const json = await slackApi("conversations.open", token, {
    users: slackUserId,
  });
  const channel = (json?.channel as { id?: string } | undefined)?.id;
  return channel ?? null;
}

/** A single message row from conversations.history, trimmed to what callers need. */
export type SlackHistoryMessage = {
  ts: string;
  user?: string;
  text?: string;
  bot_id?: string;
  subtype?: string;
};

/**
 * Messages sent in a DM since `oldestTs` (exclusive) — used to replay any DMs
 * that arrived while the Socket Mode connection was down, since Slack doesn't
 * redeliver missed events the way Telegram's poller naturally catches up.
 */
export async function fetchMissedDms(
  channel: string,
  oldestTs: string,
  botToken?: string,
): Promise<SlackHistoryMessage[]> {
  const token = botToken ?? env.SLACK_SURFACE_BOT_TOKEN;
  if (!token) return [];
  const json = await slackApi("conversations.history", token, {
    channel,
    oldest: oldestTs,
    inclusive: false,
    limit: 50,
  });
  const messages = (json?.messages as SlackHistoryMessage[] | undefined) ?? [];
  // Slack returns newest-first; replay in the order they were actually sent.
  return messages.slice().reverse();
}

/**
 * Downloads a Slack voice/audio file and transcribes it via OpenAI Whisper —
 * the Slack analog of transcribeTelegramVoice. Slack's file URLs are private:
 * the download itself needs the bot token as a Bearer header, same token used
 * for chat.postMessage. Returns undefined if the OpenAI key, bot token, or
 * either HTTP call is unavailable — callers should fall back to telling the
 * principal voice notes couldn't be understood right now.
 */
export async function transcribeSlackAudio(
  urlPrivate: string,
  botToken: string | undefined,
): Promise<string | undefined> {
  const token = botToken ?? env.SLACK_SURFACE_BOT_TOKEN;
  if (!token || !env.OPENAI_API_KEY) return undefined;

  try {
    const audioRes = await fetch(urlPrivate, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!audioRes.ok) return undefined;
    const audioBlob = await audioRes.blob();

    const form = new FormData();
    form.append("file", audioBlob, "voice.m4a");
    form.append("model", "whisper-1");

    const transcribeRes = await fetch(`${env.OPENAI_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
    });
    if (!transcribeRes.ok) {
      logger.error("slack voice transcription failed", { status: transcribeRes.status });
      return undefined;
    }
    const json = (await transcribeRes.json()) as { text?: string };
    return json.text?.trim() || undefined;
  } catch (error) {
    logger.error("slack voice transcription threw", {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Bot scopes the surface needs; the single source for the OAuth authorize URL.
 * files:read is required to download voice-note audio from url_private —
 * workspaces installed before this scope was added must reauthorize
 * ("Add to Slack" again) for voice notes to work; text chat is unaffected.
 */
export const SLACK_SURFACE_BOT_SCOPES = ["chat:write", "im:history", "im:write", "files:read"] as const;

/**
 * The "Add to Slack" authorize URL. `state` carries the account link token so
 * the callback can bind the installing user to their Rizly account with no
 * typing (the Socket-Mode-era manual "link <token>" DM remains as fallback).
 */
export function slackAuthorizeUrl(state: string, redirectUri: string): string | null {
  if (!env.SLACK_CLIENT_ID) return null;
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: SLACK_SURFACE_BOT_SCOPES.join(","),
    state,
    redirect_uri: redirectUri,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

export type SlackOAuthResult = {
  botToken: string;
  teamId: string;
  teamName?: string;
  /** The Slack user who clicked "Add to Slack". */
  authedUserId: string;
};

/** Exchanges an OAuth code for a workspace bot token (oauth.v2.access). */
export async function exchangeSlackOAuthCode(
  code: string,
  redirectUri: string,
): Promise<SlackOAuthResult | null> {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) return null;
  const res = await fetch(`${API}/oauth.v2.access`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    logger.error("slack oauth exchange http failure", { status: res.status });
    return null;
  }
  const json = (await res.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    team?: { id?: string; name?: string };
    authed_user?: { id?: string };
  };
  if (!json.ok || !json.access_token || !json.team?.id || !json.authed_user?.id) {
    logger.error("slack oauth exchange failed", { error: json.error });
    return null;
  }
  return {
    botToken: json.access_token,
    teamId: json.team.id,
    teamName: json.team.name,
    authedUserId: json.authed_user.id,
  };
}

/**
 * Socket Mode: asks Slack for a fresh WebSocket URL. Requires the app-level
 * token (xapp-…) with connections:write. The caller owns the WebSocket
 * lifecycle; this only mints the URL (they are single-use and short-lived).
 */
export async function openSocketModeConnection(): Promise<string | null> {
  if (!env.SLACK_APP_TOKEN) return null;
  const json = await slackApi("apps.connections.open", env.SLACK_APP_TOKEN, {});
  const url = json?.url;
  return typeof url === "string" ? url : null;
}
