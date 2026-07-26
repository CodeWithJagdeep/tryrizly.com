import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { DiscordRepository } from "./discord.repository";
import { DiscordSurfaceService, type DiscordSurfaceMessage } from "./discord-surface.service";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { fetchGatewayUrl } from "@heyriz/shared/discord-surface";

const RETRY_DELAY_MS = 5000;
const SEEN_EVENT_CAP = 500;
const GATEWAY_VERSION_QS = "?v=10&encoding=json";

// Minimal view of the Node >=22 global WebSocket (undici) — gateway's
// @types/node predates the global, so we access it through this shim
// (mirrors slack-socket.service.ts's WsLike/WsCtor).
type WsEvent = { data?: unknown };
type WsLike = {
  send(data: string): void;
  close(): void;
  addEventListener(type: "open" | "message" | "close" | "error", listener: (event: WsEvent) => void): void;
};
type WsCtor = new (url: string) => WsLike;

const OP = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  RESUME: 6,
  RECONNECT: 7,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
} as const;

// GUILDS(1<<0) | GUILD_MESSAGES(1<<9) | MESSAGE_CONTENT(1<<15) | DIRECT_MESSAGES(1<<12)
const INTENTS = 1 | 512 | 32768 | 4096;

type GatewayPayload = { op: number; d?: unknown; s?: number | null; t?: string | null };
type DiscordChannelPayload = { id: string; name?: string; type?: number; guild_id?: string };
type DiscordGuildCreatePayload = { id: string; name?: string; channels?: DiscordChannelPayload[] };
type DiscordMessageCreatePayload = {
  id: string;
  channel_id: string;
  guild_id?: string;
  content?: string;
  author?: { id: string; bot?: boolean };
};
type ReadyPayload = { session_id?: string; resume_gateway_url?: string };

/**
 * Discord Gateway v10 connection lifecycle — the Discord analog of
 * SlackSocketService, but implementing Discord's own opcode protocol instead
 * of Slack Socket Mode envelopes. One persistent connection covers every
 * guild the bot is installed in and every DM, so the always-on channel
 * catalog and automation triggers work with no public HTTPS endpoint.
 */
@Injectable()
export class DiscordSocketService implements OnModuleInit, OnModuleDestroy {
  private stopped = false;
  private socket?: WsLike;
  private loop?: Promise<void>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private seq: number | null = null;
  private sessionId?: string;
  private resumeUrl?: string;
  // De-dupes MESSAGE_CREATE — Discord can redeliver around a reconnect/resume.
  private readonly seenMessageIds = new Set<string>();

  constructor(
    @Inject(DiscordSurfaceService)
    private readonly surface: DiscordSurfaceService,
    @Inject(DiscordRepository)
    private readonly discordRepo: DiscordRepository,
  ) {}

  onModuleInit(): void {
    if (!env.DISCORD_SOCKET_ENABLED || !env.DISCORD_BOT_TOKEN) return;
    const WebSocketImpl = (globalThis as unknown as { WebSocket?: WsCtor }).WebSocket;
    if (!WebSocketImpl) {
      logger.error("discord gateway socket unavailable: no global WebSocket in this runtime");
      return;
    }
    logger.info("discord gateway socket starting");
    this.loop = this.run(WebSocketImpl);
  }

  onModuleDestroy(): void {
    this.stopped = true;
    this.stopHeartbeat();
    this.socket?.close();
  }

  /** Connect -> serve until the socket closes -> reconnect (resuming when possible), forever. */
  private async run(WebSocketImpl: WsCtor): Promise<void> {
    while (!this.stopped) {
      try {
        const url = await this.nextUrl();
        if (!url) throw new Error("could not resolve a discord gateway url");
        await this.serve(WebSocketImpl, url);
      } catch (error) {
        logger.warn("discord gateway connection failed; retrying", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (!this.stopped) await sleep(RETRY_DELAY_MS);
    }
  }

  /** A still-valid prior session resumes against its own resume_gateway_url; otherwise a fresh /gateway/bot lookup. */
  private async nextUrl(): Promise<string | null> {
    if (this.sessionId && this.resumeUrl) return `${this.resumeUrl}${GATEWAY_VERSION_QS}`;
    const info = await fetchGatewayUrl(env.DISCORD_BOT_TOKEN as string);
    return info ? `${info.url}${GATEWAY_VERSION_QS}` : null;
  }

  /** Resolves when the socket closes (reconnect/invalid-session/network drop); the run loop reconnects. */
  private serve(WebSocketImpl: WsCtor, url: string): Promise<void> {
    return new Promise((resolve) => {
      const socket = new WebSocketImpl(url);
      this.socket = socket;
      let identified = false;

      socket.addEventListener("close", () => {
        this.stopHeartbeat();
        resolve();
      });
      socket.addEventListener("error", () => socket.close());
      socket.addEventListener("message", (event) => {
        let payload: GatewayPayload;
        try {
          payload = JSON.parse(String(event.data)) as GatewayPayload;
        } catch {
          return;
        }
        if (typeof payload.s === "number") this.seq = payload.s;

        if (payload.op === OP.HELLO) {
          const interval =
            (payload.d as { heartbeat_interval?: number } | undefined)?.heartbeat_interval ?? 41_250;
          this.stopHeartbeat();
          this.heartbeatTimer = setInterval(() => {
            socket.send(JSON.stringify({ op: OP.HEARTBEAT, d: this.seq }));
          }, interval);

          if (!identified) {
            identified = true;
            if (this.sessionId) {
              socket.send(
                JSON.stringify({
                  op: OP.RESUME,
                  d: { token: env.DISCORD_BOT_TOKEN, session_id: this.sessionId, seq: this.seq },
                }),
              );
            } else {
              socket.send(
                JSON.stringify({
                  op: OP.IDENTIFY,
                  d: {
                    token: env.DISCORD_BOT_TOKEN,
                    intents: INTENTS,
                    properties: { os: "linux", browser: "rizly", device: "rizly" },
                  },
                }),
              );
            }
          }
          return;
        }

        if (payload.op === OP.HEARTBEAT_ACK) return;

        if (payload.op === OP.RECONNECT) {
          socket.close();
          return;
        }

        if (payload.op === OP.INVALID_SESSION) {
          const resumable = payload.d === true;
          if (!resumable) {
            this.sessionId = undefined;
            this.resumeUrl = undefined;
            this.seq = null;
          }
          // Discord asks clients to wait a random 1-5s before re-identifying.
          setTimeout(() => socket.close(), 1_000 + Math.random() * 4_000);
          return;
        }

        if (payload.op === OP.DISPATCH) {
          void this.dispatch(payload).catch((error) =>
            logger.error("discord dispatch handling failed", {
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });
    });
  }

  private async dispatch(payload: GatewayPayload): Promise<void> {
    const type = payload.t;
    const data = payload.d as Record<string, unknown> | undefined;
    if (!type || !data) return;

    if (type === "READY") {
      const ready = data as ReadyPayload;
      this.sessionId = ready.session_id;
      this.resumeUrl = ready.resume_gateway_url;
      logger.info("discord gateway ready", { sessionId: this.sessionId });
      return;
    }

    if (type === "GUILD_CREATE") {
      const guild = data as DiscordGuildCreatePayload;
      if (!guild.id) return;
      await this.discordRepo.upsertGuild(guild.id, guild.name ?? guild.id);
      const channels = (guild.channels ?? []).filter((c) => typeof c.id === "string");
      await this.discordRepo.bulkUpsertChannels(
        guild.id,
        channels.map((c) => ({ id: c.id, name: c.name ?? c.id, type: c.type ?? 0 })),
      );
      return;
    }

    if (type === "CHANNEL_CREATE" || type === "CHANNEL_UPDATE") {
      const channel = data as DiscordChannelPayload;
      if (!channel.id || !channel.guild_id) return;
      await this.discordRepo.upsertChannel(
        channel.guild_id,
        channel.id,
        channel.name ?? channel.id,
        channel.type ?? 0,
      );
      return;
    }

    if (type === "CHANNEL_DELETE") {
      const channel = data as DiscordChannelPayload;
      if (!channel.id) return;
      await this.discordRepo.removeChannel(channel.id);
      return;
    }

    if (type === "MESSAGE_CREATE") {
      const message = data as DiscordMessageCreatePayload;
      if (!message.channel_id || !message.author?.id || message.author.bot) return;
      if (!this.markSeen(message.id)) return;

      if (!message.guild_id) {
        const dm: DiscordSurfaceMessage = {
          discordUserId: message.author.id,
          channel: message.channel_id,
          text: message.content ?? "",
        };
        await this.surface.handleMessage(dm);
        return;
      }

      await this.surface.handleChannelMessage({
        guildId: message.guild_id,
        channelId: message.channel_id,
        messageId: message.id,
        content: message.content ?? "",
        authorId: message.author.id,
        messageUrl: `https://discord.com/channels/${message.guild_id}/${message.channel_id}/${message.id}`,
      });
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /** Returns false when the message was already handled (redelivery around a reconnect). */
  private markSeen(id: string): boolean {
    if (this.seenMessageIds.has(id)) return false;
    this.seenMessageIds.add(id);
    if (this.seenMessageIds.size > SEEN_EVENT_CAP) {
      const oldest = this.seenMessageIds.values().next().value;
      if (oldest) this.seenMessageIds.delete(oldest);
    }
    return true;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
