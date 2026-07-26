import { env } from "./env";
import { logger } from "./logger";

/**
 * Discord as a chat *surface* (the principal DMs Rizly, and Rizly watches
 * every channel of every installed guild), mirroring ./slack-surface.ts.
 * Distinct from the ai-core Discord connector (connectors/discord.service.ts),
 * which is a per-user single-channel webhook/read integration: the surface
 * bot is one app-wide bot (DISCORD_BOT_TOKEN) installed once per guild via
 * OAuth, the same bot for every server and every DM.
 *
 * Required Gateway v10 intents for the surface socket (see discord-socket.service.ts):
 * GUILDS (1<<0) | GUILD_MESSAGES (1<<9) | MESSAGE_CONTENT (1<<15) | DIRECT_MESSAGES (1<<12) = 37377.
 */

const API = "https://discord.com/api/v10";
export const DISCORD_CONTENT_LIMIT = 2000;

export async function discordApi<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bot ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    logger.error("discord api http failure", { method, path, status: res.status });
    return null;
  }
  if (res.status === 204) return null;
  return (await res.json().catch(() => null)) as T | null;
}

function truncate(content: string): string {
  return content.length > DISCORD_CONTENT_LIMIT
    ? `${content.slice(0, DISCORD_CONTENT_LIMIT - 1)}…`
    : content;
}

/** Opens (or fetches) the 1:1 DM channel with a Discord user, then posts — Discord has no single "send to user id" endpoint. */
export async function sendDiscordDm(
  discordUserId: string,
  content: string,
  botToken?: string,
): Promise<boolean> {
  const token = botToken ?? env.DISCORD_BOT_TOKEN;
  if (!token) {
    logger.info("discord dm not sent (missing bot token); logged instead", {
      text: content.slice(0, 200),
    });
    return false;
  }
  const channel = await discordApi<{ id?: string }>("POST", "/users/@me/channels", token, {
    recipient_id: discordUserId,
  });
  if (!channel?.id) return false;
  return sendDiscordChannelMessage(channel.id, content, token);
}

export async function sendDiscordChannelMessage(
  channelId: string,
  content: string,
  botToken?: string,
): Promise<boolean> {
  const token = botToken ?? env.DISCORD_BOT_TOKEN;
  if (!token) {
    logger.info("discord message not sent (missing bot token); logged instead", {
      channelId,
      text: content.slice(0, 200),
    });
    return false;
  }
  const message = await discordApi<{ id?: string }>("POST", `/channels/${channelId}/messages`, token, {
    content: truncate(content),
  });
  return Boolean(message?.id);
}

/** Thin wrapper over sendDiscordChannelMessage, named/shaped to match sendSlackSurfaceMessage's call site in discord-surface.service.ts. */
export function sendDiscordSurfaceMessage(opts: {
  channel: string | undefined;
  text: string;
  botToken?: string;
}): Promise<boolean> {
  if (!opts.channel) return Promise.resolve(false);
  return sendDiscordChannelMessage(opts.channel, opts.text, opts.botToken);
}

/** Posts a short-lived "Thinking…" placeholder; returns its message id so the caller can edit it in place, or null if it couldn't be posted. */
export async function sendDiscordPlaceholder(opts: {
  channel: string | undefined;
  botToken?: string;
  text?: string;
}): Promise<string | null> {
  const token = opts.botToken ?? env.DISCORD_BOT_TOKEN;
  if (!token || !opts.channel) return null;
  const message = await discordApi<{ id?: string }>(
    "POST",
    `/channels/${opts.channel}/messages`,
    token,
    { content: opts.text ?? "_Thinking…_" },
  );
  return message?.id ?? null;
}

/** Edits a previously-sent message in place — used to replace the "Thinking…" placeholder with the real reply. */
export async function updateDiscordSurfaceMessage(opts: {
  channel: string;
  messageId: string;
  text: string;
  botToken?: string;
}): Promise<boolean> {
  const token = opts.botToken ?? env.DISCORD_BOT_TOKEN;
  if (!token) return false;
  const message = await discordApi<{ id?: string }>(
    "PATCH",
    `/channels/${opts.channel}/messages/${opts.messageId}`,
    token,
    { content: truncate(opts.text) },
  );
  return Boolean(message?.id);
}

export type DiscordGatewayInfo = {
  url: string;
  sessionStartLimit?: { total: number; remaining: number; resetAfter: number };
};

/** Asks Discord for a fresh Gateway v10 WebSocket URL, plus rate-limit info for Identify. */
export async function fetchGatewayUrl(botToken: string): Promise<DiscordGatewayInfo | null> {
  const json = await discordApi<{
    url?: string;
    session_start_limit?: { total: number; remaining: number; reset_after: number };
  }>("GET", "/gateway/bot", botToken);
  if (!json?.url) return null;
  return {
    url: json.url,
    sessionStartLimit: json.session_start_limit
      ? {
          total: json.session_start_limit.total,
          remaining: json.session_start_limit.remaining,
          resetAfter: json.session_start_limit.reset_after,
        }
      : undefined,
  };
}

// View Channels (1<<10) | Send Messages (1<<11) | Read Message History (1<<16) = 274878221312.
export const DISCORD_SURFACE_BOT_PERMISSIONS = "274878221312";

/**
 * The "Add to Discord" bot-install OAuth URL. Discord's bot-scope authorize
 * flow returns `guild_id` directly on the callback query string — no token
 * exchange needed to know which guild was installed. The "identify" scope
 * (+ response_type=code) rides along so the callback CAN additionally
 * exchange `code` for the installing user's Discord id via
 * exchangeDiscordIdentity, letting it auto-link the account the same way
 * Slack's OAuth callback does. `state` carries the account link token; a
 * manual "link <token>" DM remains as fallback.
 */
export function discordInstallUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  permissions: string = DISCORD_SURFACE_BOT_PERMISSIONS,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "bot applications.commands identify",
    permissions,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

/**
 * Exchanges the OAuth `code` for the installing user's Discord id — used
 * only to auto-link the dashboard account to a Discord identity on install;
 * the guild install itself needs no exchange (guild_id arrives on the query
 * string already). Returns null if OAuth isn't configured or either call fails.
 */
export async function exchangeDiscordIdentity(
  code: string,
  redirectUri: string,
): Promise<{ discordUserId: string; username?: string } | null> {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return null;
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    logger.error("discord oauth token exchange http failure", { status: tokenRes.status });
    return null;
  }
  const tokenJson = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
  if (!tokenJson?.access_token) return null;

  const meRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!meRes.ok) {
    logger.error("discord oauth identify http failure", { status: meRes.status });
    return null;
  }
  const me = (await meRes.json().catch(() => null)) as
    | { id?: string; username?: string; global_name?: string | null }
    | null;
  if (!me?.id) return null;
  // global_name is Discord's newer display name; falls back to the classic
  // username when unset (bots and older accounts without one).
  return { discordUserId: me.id, username: me.global_name || me.username };
}
