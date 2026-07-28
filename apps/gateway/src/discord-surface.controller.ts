import { Controller, Get, Headers, Inject, Query, Res } from "@nestjs/common";
import { AuthRepository } from "./auth/auth.repository";
import { CONVERSATION_STORE, type ConversationStore } from "./conversation-store";
import { DiscordRepository } from "./discord.repository";
import { GatewayService } from "./gateway.service";
import { requireInternalSecret } from "./internal-auth";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import {
  discordApi,
  discordInstallUrl,
  exchangeDiscordIdentity,
} from "@heyriz/shared/discord-surface";

type RedirectResponse = {
  redirect(url: string): void;
  status(code: number): {
    json(body: unknown): void;
    send(body: string): void;
  };
};

// Must match a Redirect URL registered on the Discord app (Discord requires
// HTTPS/localhost); dev without one falls back to the manual "link <token>" DM.
function redirectUri(): string | null {
  return env.DISCORD_SURFACE_REDIRECT_URI ?? null;
}

/** Only a same-site relative path is ever redirected to — guards against an open redirect via a crafted returnTo (e.g. "//evil.com"). */
function safeReturnTo(returnTo: string | undefined): string {
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  return "/dashboard/discord";
}

/**
 * The "Add to Discord" bot-install OAuth flow, mirroring
 * slack-surface.controller.ts. The web dashboard sends the principal to
 * /install with their account link token; Discord sends them back to
 * /callback with the installed guild's id directly on the query string (no
 * token exchange needed for that part) and, since we also request the
 * "identify" scope, a `code` we can exchange purely to learn the installing
 * user's Discord id and auto-link their account.
 */
@Controller("api/discord")
export class DiscordSurfaceController {
  constructor(
    @Inject(DiscordRepository)
    private readonly discordRepo: DiscordRepository,
    @Inject(GatewayService)
    private readonly gateway: GatewayService,
    @Inject(CONVERSATION_STORE)
    private readonly conversations: ConversationStore,
    @Inject(AuthRepository)
    private readonly authRepo: AuthRepository,
  ) {}

  /** Mirror of api/slack/history for the dashboard's Discord page. */
  @Get("history")
  async history(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    requireInternalSecret(secret);
    if (!userId) return { error: "userId is required" };

    const dmChannelId = await this.discordRepo.findDiscordDmChannelByUserId(userId);
    if (!dmChannelId) return { linked: false, turns: [] };

    const turns = await this.conversations.get(`discord:${dmChannelId}`);
    return { linked: true, turns };
  }

  /** Discord analog of resolveSlackTarget (gateway.controller.ts) — used by the automation-run worker's "Send Message" action. */
  @Get("resolve")
  async resolve(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    requireInternalSecret(secret);
    if (!userId) return { discordUserId: null };
    const discordUserId = await this.discordRepo.findDiscordKeyByUserId(userId);
    return { discordUserId: discordUserId ?? null };
  }

  /** This user's own installed guilds + their channels, for the flow-builder's channel pickers. Scoped by userId so one user can never see or target another user's server. */
  @Get("channels")
  async channels(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    requireInternalSecret(secret);
    if (!userId) return [];
    const guilds = await this.discordRepo.listGuilds(userId);
    const withChannels = await Promise.all(
      guilds.map(async (guild) => ({
        guildId: guild.guildId,
        guildName: guild.name,
        channels: (await this.discordRepo.listChannels(guild.guildId))
          // Only channels that can actually receive a bot message — excludes
          // categories (type 4), voice channels, stages, etc. A category
          // slipping through here is exactly what caused discord_send_failed
          // (Discord's message-create endpoint 400s on a non-text channel).
          .filter((c) => c.type === 0 || c.type === 5)
          .map((c) => ({
            channelId: c.channelId,
            name: c.name,
          })),
      })),
    );
    return withChannels;
  }

  /** Lets callers check before rendering an "Add to Discord" button. */
  @Get("config")
  config() {
    return { installConfigured: Boolean(env.DISCORD_CLIENT_ID && redirectUri()) };
  }

  @Get("install")
  install(@Query("token") token: string | undefined, @Res() res: RedirectResponse) {
    if (!token) {
      res.status(400).send("Missing link token");
      return;
    }
    const uri = redirectUri();
    if (!env.DISCORD_CLIENT_ID || !uri) {
      res
        .status(500)
        .send("Discord OAuth is not configured (DISCORD_CLIENT_ID / DISCORD_SURFACE_REDIRECT_URI missing)");
      return;
    }
    res.redirect(discordInstallUrl(env.DISCORD_CLIENT_ID, uri, token));
  }

  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("guild_id") guildId: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    const fail = (message: string, returnTo?: string) => {
      const base = safeReturnTo(returnTo);
      const sep = base.includes("?") ? "&" : "?";
      res.redirect(`${env.WEB_APP_URL}${base}${sep}error=${encodeURIComponent(message)}`);
    };

    if (error) return fail(error);

    if (guildId && env.DISCORD_BOT_TOKEN) {
      const guild = await discordApi<{ name?: string }>(
        "GET",
        `/guilds/${guildId}`,
        env.DISCORD_BOT_TOKEN,
      ).catch(() => null);
      await this.discordRepo.upsertGuild(guildId, guild?.name ?? guildId);
    }

    if (!code || !state) {
      // A bare guild install with no link token still succeeds — the socket's
      // GUILD_CREATE dispatch will finish backfilling the channel catalog.
      res.redirect(`${env.WEB_APP_URL}/dashboard/discord?connected=1`);
      return;
    }

    const uri = redirectUri();
    if (!uri) return fail("Discord OAuth is not configured.");
    const identity = await exchangeDiscordIdentity(code, uri);
    if (!identity) return fail("Discord sign-in failed — try again.");

    const record = await this.discordRepo.consumeDiscordLinkToken(state, identity.discordUserId);
    if (!record) return fail("That link expired — start again from the dashboard.");

    const userId = record.email.trim().toLowerCase();
    const linked = await this.discordRepo.linkDiscordUser(identity.discordUserId, record.email, userId);
    if (!linked.ok) {
      return fail("That Discord account is already linked to a different Rizly account.", record.returnTo);
    }
    if (guildId) {
      await this.discordRepo.setGuildOwner(guildId, userId).catch(() => undefined);
    }
    await this.authRepo
      .setOnboarding(record.email, { discordLinked: true })
      .catch(() => undefined);

    try {
      await this.gateway.sendToAiCore("connector.save", {
        userId,
        provider: "discord_surface",
        authType: "oauth",
        // Shows the actual linked Discord account in the connectors/automation
        // UI instead of a generic "Discord DM" label for every user.
        label: identity.username ? `Discord (@${identity.username})` : "Discord DM",
        secret: { discordUserId: identity.discordUserId, guildId: guildId ?? null },
        metadata: { setup: "discord_oauth", discordUsername: identity.username ?? null },
      });
    } catch (err) {
      logger.warn("failed to save discord surface connector record", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const base = safeReturnTo(record.returnTo);
    const sep = base.includes("?") ? "&" : "?";
    res.redirect(`${env.WEB_APP_URL}${base}${sep}connected=1`);
  }
}
