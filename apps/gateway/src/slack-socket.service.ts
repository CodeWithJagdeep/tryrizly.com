import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { AuthRepository } from "./auth/auth.repository";
import { GatewayService } from "./gateway.service";
import {
  SlackSurfaceService,
  type SlackSurfaceAction,
  type SlackSurfaceMessage,
} from "./slack-surface.service";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import {
  fetchMissedDms,
  openSocketModeConnection,
  sendSlackSurfaceMessage,
  transcribeSlackAudio,
} from "@heyriz/shared/slack-surface";

const RETRY_DELAY_MS = 5000;
const SEEN_EVENT_CAP = 500;

// Minimal view of the Node ≥22 global WebSocket (undici) — gateway's
// @types/node predates the global, so we access it through this shim.
type WsEvent = { data?: unknown };
type WsLike = {
  send(data: string): void;
  close(): void;
  addEventListener(type: "open" | "message" | "close" | "error", listener: (event: WsEvent) => void): void;
};
type WsCtor = new (url: string) => WsLike;

type SocketEnvelope = {
  envelope_id?: string;
  type?: string;
  payload?: {
    type?: string;
    event_id?: string;
    team_id?: string;
    event?: {
      type?: string;
      subtype?: string;
      channel_type?: string;
      channel?: string;
      user?: string;
      text?: string;
      bot_id?: string;
      ts?: string;
      files?: Array<{ mimetype?: string; url_private?: string; url_private_download?: string }>;
      // reaction_added shape
      reaction?: string;
      item?: { type?: string; channel?: string; ts?: string };
    };
    team?: { id?: string };
    user?: { id?: string };
    channel?: { id?: string };
    actions?: Array<{ action_id?: string; value?: string }>;
  };
};

/**
 * Slack Socket Mode transport — the Slack analog of TelegramPollerService.
 * Opens an outbound WebSocket via apps.connections.open, so the surface works
 * without a public HTTPS domain (no Events API webhook needed). Enabled via
 * SLACK_SOCKET_ENABLED; envelopes are acked immediately and processed async.
 */
@Injectable()
export class SlackSocketService implements OnModuleInit, OnModuleDestroy {
  private stopped = false;
  private socket?: WsLike;
  private loop?: Promise<void>;
  // Slack redelivers events it thinks went unacked; remember recent event ids
  // so a redelivery can't run the same instruction twice.
  private readonly seenEventIds = new Set<string>();
  // Set the moment a live connection is lost (or first observed as failing);
  // cleared once we're back up and have replayed anything missed in between.
  // Socket Mode never redelivers events the way Slack's Events API retries
  // webhooks, so without this, any DM sent during an outage is lost forever.
  private disconnectedSince: number | null = null;

  constructor(
    @Inject(SlackSurfaceService)
    private readonly surface: SlackSurfaceService,
    @Inject(AuthRepository)
    private readonly authRepo: AuthRepository,
    @Inject(GatewayService)
    private readonly gateway: GatewayService,
  ) {}

  onModuleInit(): void {
    if (!env.SLACK_SOCKET_ENABLED || !env.SLACK_APP_TOKEN || !env.SLACK_SURFACE_BOT_TOKEN) return;
    const WebSocketImpl = (globalThis as unknown as { WebSocket?: WsCtor }).WebSocket;
    if (!WebSocketImpl) {
      logger.error("slack socket mode unavailable: no global WebSocket in this runtime");
      return;
    }
    logger.info("slack socket mode starting");
    this.loop = this.run(WebSocketImpl);
  }

  onModuleDestroy(): void {
    this.stopped = true;
    this.socket?.close();
  }

  /** Connect → serve until the socket closes → reconnect, forever. */
  private async run(WebSocketImpl: WsCtor): Promise<void> {
    while (!this.stopped) {
      try {
        const url = await openSocketModeConnection();
        if (!url) throw new Error("apps.connections.open returned no url");
        await this.serve(WebSocketImpl, url);
      } catch (error) {
        this.disconnectedSince ??= Date.now();
        logger.warn("slack socket connection failed; retrying", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (!this.stopped) await sleep(RETRY_DELAY_MS);
    }
  }

  /** Resolves when the socket closes (Slack rotates connections; we reconnect). */
  private serve(WebSocketImpl: WsCtor, url: string): Promise<void> {
    return new Promise((resolve) => {
      const socket = new WebSocketImpl(url);
      this.socket = socket;

      socket.addEventListener("open", () => {
        logger.info("slack socket connected");
        this.replayMissedMessages();
      });
      socket.addEventListener("close", () => {
        this.disconnectedSince ??= Date.now();
        resolve();
      });
      socket.addEventListener("error", () => socket.close());
      socket.addEventListener("message", (event) => {
        let envelope: SocketEnvelope;
        try {
          envelope = JSON.parse(String(event.data)) as SocketEnvelope;
        } catch {
          return;
        }

        // Slack asks clients to reconnect (refresh, warning) via this frame.
        if (envelope.type === "disconnect") {
          socket.close();
          return;
        }

        // Ack first — Slack redelivers anything not acked within seconds,
        // and agent turns routinely take longer than that.
        if (envelope.envelope_id) {
          socket.send(JSON.stringify({ envelope_id: envelope.envelope_id }));
        }

        void this.dispatch(envelope).catch((error) =>
          logger.error("slack envelope handling failed", {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      });
    });
  }

  private async dispatch(envelope: SocketEnvelope): Promise<void> {
    const payload = envelope.payload;
    if (!payload) return;

    if (envelope.type === "events_api") {
      const event = payload.event;
      if (!event || !payload.team_id) return;

      // Channel-based automation triggers — requires the app's Event
      // Subscriptions to include message.channels/app_mention/reaction_added
      // (a dashboard config, see SLACK_SURFACE_BOT_SCOPES's comment) and the
      // new OAuth scopes; older installs won't have either until reauthorized.
      if (event.type === "message" && event.channel_type === "channel") {
        if (event.bot_id || event.subtype) return; // human channel messages only
        if (!event.user || !event.channel || !event.text) return;
        if (payload.event_id && !this.markSeen(payload.event_id)) return;
        await this.forwardChannelTrigger("New Message Posted to Channel", {
          teamId: payload.team_id,
          channelId: event.channel,
          userId: event.user,
          text: event.text,
          messageId: `${event.channel}:${event.ts ?? Date.now()}`,
        });
        return;
      }

      if (event.type === "app_mention") {
        if (!event.user || !event.channel || !event.text) return;
        if (payload.event_id && !this.markSeen(payload.event_id)) return;
        await this.forwardWorkspaceTrigger("New Mention", payload.team_id, {
          channelId: event.channel,
          userId: event.user,
          text: event.text,
          messageId: `${event.channel}:${event.ts ?? Date.now()}`,
        });
        return;
      }

      if (event.type === "reaction_added") {
        if (!event.user || !event.item?.channel || !event.reaction) return;
        if (payload.event_id && !this.markSeen(payload.event_id)) return;
        await this.forwardWorkspaceTrigger("New Reaction Added", payload.team_id, {
          channelId: event.item.channel,
          userId: event.user,
          reaction: event.reaction,
          messageId: `${event.item.channel}:${event.item.ts ?? Date.now()}:${event.reaction}`,
        });
        return;
      }

      if (event.type !== "message") return;
      // DMs only, humans only: skip bot echoes (incl. our own replies). Allow
      // the "file_share" subtype through (voice notes land there) but still
      // drop other subtypes (message_changed / message_deleted, etc).
      if (event.channel_type !== "im" || event.bot_id) return;
      if (event.subtype && event.subtype !== "file_share") return;
      if (!event.user || !event.channel) return;
      if (payload.event_id && !this.markSeen(payload.event_id)) return;

      let text = event.text;
      if (!text) {
        const audioFile = event.files?.find((f) => f.mimetype?.startsWith("audio/"));
        if (!audioFile) return;
        const url = audioFile.url_private_download ?? audioFile.url_private;
        const botToken = await this.resolveBotToken(payload.team_id);
        text = url
          ? await transcribeSlackAudio(url, botToken, audioFile.mimetype)
          : undefined;
        if (!text) {
          await sendSlackSurfaceMessage({
            channel: event.channel,
            botToken,
            text: "Couldn't make out that voice note — try again or type it out?",
          });
          return;
        }
      }

      const message: SlackSurfaceMessage = {
        teamId: payload.team_id,
        slackUserId: event.user,
        channel: event.channel,
        text,
      };
      await this.surface.handleMessage(message);
      return;
    }

    if (envelope.type === "interactive" && payload.type === "block_actions") {
      const value = payload.actions?.[0]?.value ?? payload.actions?.[0]?.action_id;
      if (!payload.team?.id || !payload.user?.id || !payload.channel?.id || !value) return;

      const action: SlackSurfaceAction = {
        teamId: payload.team.id,
        slackUserId: payload.user.id,
        channel: payload.channel.id,
        value,
      };
      await this.surface.handleAction(action);
    }
  }

  /**
   * Fires once per reconnect, right after "open". If this reconnect follows a
   * real outage (not the very first connect of this process), replay any DMs
   * that arrived in every linked channel while we were down — Socket Mode has
   * no redelivery mechanism of its own, so without this those messages are
   * simply gone.
   */
  private replayMissedMessages(): void {
    const since = this.disconnectedSince;
    if (since === null) return;
    this.disconnectedSince = null;
    void this.doReplay(since).catch((error) =>
      logger.error("slack missed-message replay failed", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  private async doReplay(since: number): Promise<void> {
    const oldestTs = (since / 1000).toFixed(6);
    const links = await this.authRepo.listSlackLinks();

    for (const link of links) {
      if (!link.dmChannelId) continue;
      const [teamId, slackUserId] = link.slackKey.split(":");
      if (!teamId || !slackUserId) continue;

      try {
        const botToken = await this.resolveBotToken(teamId);
        const messages = await fetchMissedDms(link.dmChannelId, oldestTs, botToken);

        for (const message of messages) {
          if (message.bot_id || message.subtype || !message.user || !message.text) continue;
          // Namespaced separately from live event_ids (different id space) so
          // a message can't be silently skipped by an unrelated collision.
          if (!this.markSeen(`history:${link.dmChannelId}:${message.ts}`)) continue;

          await this.surface.handleMessage({
            teamId,
            slackUserId,
            channel: link.dmChannelId,
            text: message.text,
          });
        }
      } catch (error) {
        logger.warn("slack missed-message replay failed for one link", {
          teamId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * "New Message Posted to Channel" — mirrors Discord's discordChannelEvent:
   * forwarded as-is, matched in ai-core by exact channelId equality against
   * the flow's trigger config, no per-user resolution needed here.
   */
  private async forwardChannelTrigger(
    title: "New Message Posted to Channel",
    input: { teamId: string; channelId: string; userId: string; text: string; messageId: string },
  ): Promise<void> {
    try {
      await this.gateway.sendToAiCore("automation.slack.channelEvent", { title, ...input });
    } catch (error) {
      logger.warn("slack channel trigger forward to ai-core failed", {
        channelId: input.channelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * "New Mention" / "New Reaction Added" — no channelId to match on, so
   * unlike Discord/channel-message these are scoped by resolving which of
   * our users are linked into this Slack team, here in gateway (ai-core has
   * no view of slack_links, that's gateway/AuthRepository's collection).
   */
  private async forwardWorkspaceTrigger(
    title: "New Mention" | "New Reaction Added",
    teamId: string,
    input: { channelId: string; userId: string; text?: string; reaction?: string; messageId: string },
  ): Promise<void> {
    const userIds = await this.authRepo.findUserIdsByTeamId(teamId).catch(() => []);
    if (userIds.length === 0) return;
    try {
      await this.gateway.sendToAiCore("automation.slack.workspaceEvent", { title, teamId, userIds, ...input });
    } catch (error) {
      logger.warn("slack workspace trigger forward to ai-core failed", {
        teamId,
        title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** OAuth-installed workspaces have their bot token in Mongo; home workspace falls through to the env token inside the caller. */
  private async resolveBotToken(teamId: string): Promise<string | undefined> {
    return (await this.authRepo.findSlackBotTokenByTeam(teamId).catch(() => null)) ?? undefined;
  }

  /** Returns false when the event was already handled (Slack redelivery). */
  private markSeen(eventId: string): boolean {
    if (this.seenEventIds.has(eventId)) return false;
    this.seenEventIds.add(eventId);
    if (this.seenEventIds.size > SEEN_EVENT_CAP) {
      const oldest = this.seenEventIds.values().next().value;
      if (oldest) this.seenEventIds.delete(oldest);
    }
    return true;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
