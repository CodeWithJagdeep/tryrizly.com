import { Controller, Get, Headers, Inject, Query, Res } from "@nestjs/common";
import { AuthRepository } from "./auth/auth.repository";
import { CONVERSATION_STORE, type ConversationStore } from "./conversation-store";
import { GatewayService } from "./gateway.service";
import { requireInternalSecret } from "./internal-auth";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import {
  exchangeSlackOAuthCode,
  fetchSlackChannels,
  fetchSlackUserName,
  openSlackDm,
  sendSlackSurfaceMessage,
  slackAuthorizeUrl,
} from "@heyriz/shared/slack-surface";

type RedirectResponse = {
  redirect(url: string): void;
  status(code: number): {
    json(body: unknown): void;
    send(body: string): void;
  };
};

// Must match a Redirect URL registered on the Slack app (HTTPS required by
// Slack, so this is a production-only flow; dev uses the manual "link <token>" DM).
function redirectUri(): string | null {
  return env.SLACK_SURFACE_REDIRECT_URI ?? null;
}

/**
 * The "Add to Slack" OAuth install flow. The web dashboard sends the principal
 * to /install with their account link token; Slack sends them back to
 * /callback, where the workspace bot token is stored and the account is linked
 * in one step — no typing in the DM. Socket Mode (one app-level connection)
 * still receives events for every workspace the app is installed in.
 */
@Controller("api/slack")
export class SlackSurfaceController {
  constructor(
    @Inject(AuthRepository)
    private readonly authRepo: AuthRepository,
    @Inject(GatewayService)
    private readonly gateway: GatewayService,
    @Inject(CONVERSATION_STORE)
    private readonly conversations: ConversationStore,
  ) {}

  /** Mirror of api/telegram/history for the dashboard's Slack page. */
  @Get("history")
  async history(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    requireInternalSecret(secret);
    if (!userId) return { error: "userId is required" };

    const dmChannelId = await this.authRepo.findSlackDmChannelByUserId(userId);
    if (!dmChannelId) return { linked: false, turns: [] };

    const link = await this.authRepo.findSlackLinkByUserId(userId);
    const turns = await this.conversations.get(`slack:${dmChannelId}`);
    return { linked: true, turns, displayName: link?.displayName };
  }

  /** Lets callers check before rendering an "Add to Slack" button — avoids
   * sending users to /install just to hit a 500 when OAuth isn't set up
   * (always true in local dev, since Slack requires an HTTPS redirect). */
  /** Public channels in this user's linked workspace, for the flow-builder's Slack channel pickers. Scoped by userId so one user can never enumerate another workspace's channels. */
  @Get("channels")
  async channels(
    @Headers("x-heyriz-internal-secret") secret: string | undefined,
    @Query("userId") userId: string | undefined,
  ) {
    requireInternalSecret(secret);
    if (!userId) return [];
    const link = await this.authRepo.findSlackLinkByUserId(userId);
    // Deliberately not requiring dmChannelId (unlike resolveSlackTarget): a
    // workspace can list channels perfectly well before any DM was opened.
    if (!link) return [];
    const teamId = link.slackKey.split(":")[0];
    const botToken = await this.authRepo.findSlackBotTokenByTeam(teamId);
    if (!botToken) return [];
    // Best-effort: a revoked token or a workspace missing channels:read just
    // yields an empty picker, never a 500 that breaks the config panel.
    return await fetchSlackChannels(botToken).catch(() => []);
  }

  @Get("config")
  config() {
    return { installConfigured: Boolean(env.SLACK_CLIENT_ID && redirectUri()) };
  }

  @Get("install")
  install(@Query("token") token: string | undefined, @Res() res: RedirectResponse) {
    if (!token) {
      res.status(400).send("Missing link token");
      return;
    }
    const uri = redirectUri();
    const url = uri && slackAuthorizeUrl(token, uri);
    if (!url) {
      res
        .status(500)
        .send("Slack OAuth is not configured (SLACK_CLIENT_ID / SLACK_SURFACE_REDIRECT_URI missing)");
      return;
    }
    res.redirect(url);
  }

  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: RedirectResponse,
  ) {
    const fail = (message: string) => {
      res.redirect(`${env.WEB_APP_URL}/dashboard/slack?error=${encodeURIComponent(message)}`);
    };

    if (error) return fail(error);
    if (!code || !state) {
      res.status(400).send("Missing Slack OAuth code or state");
      return;
    }

    const uri = redirectUri();
    if (!uri) return fail("Slack OAuth is not configured.");
    const oauth = await exchangeSlackOAuthCode(code, uri);
    if (!oauth) return fail("Slack sign-in failed — try again.");

    const slackKey = `${oauth.teamId}:${oauth.authedUserId}`;
    const record = await this.authRepo.consumeSlackLinkToken(state, slackKey);
    if (!record) return fail("That link expired — start again from the dashboard.");

    // Store the workspace token first so the welcome DM below can use it.
    await this.authRepo.saveSlackWorkspace(oauth.teamId, oauth.botToken, oauth.teamName);

    const userId = record.email.trim().toLowerCase();
    const dmChannelId =
      (await openSlackDm(oauth.authedUserId, oauth.botToken)) ?? undefined;
    // Best-effort — a lookup failure just falls back to the generic label,
    // never blocks the actual link.
    const slackName = await fetchSlackUserName(oauth.authedUserId, oauth.botToken).catch(() => undefined);
    const linked = await this.authRepo.linkSlackUser(
      slackKey,
      record.email,
      userId,
      dmChannelId,
      slackName,
    );
    if (!linked.ok) {
      return fail("That Slack account is already linked to a different Rizly account.");
    }

    try {
      await this.gateway.sendToAiCore("connector.save", {
        userId,
        provider: "slack_surface",
        authType: "oauth",
        // Shows who's actually linked ("Slack (Jagdeep)") instead of the same
        // generic label for every account — mirrors the Discord username fix.
        label: slackName ? `Slack (${slackName})` : "Slack DM",
        secret: {
          teamId: oauth.teamId,
          slackUserId: oauth.authedUserId,
          dmChannelId: dmChannelId ?? null,
        },
        metadata: { setup: "slack_oauth", slackUserName: slackName ?? null },
      });
    } catch (err) {
      logger.warn("failed to save slack surface connector record", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (dmChannelId) {
      await sendSlackSurfaceMessage({
        channel: dmChannelId,
        botToken: oauth.botToken,
        text: `Linked, ${env.PRINCIPAL_HONORIFIC} — I'll take it from here. Ask me anything about your inbox, calendar, or revenue.`,
      });
    }

    res.redirect(`${env.WEB_APP_URL}/dashboard/slack?connected=1`);
  }
}
