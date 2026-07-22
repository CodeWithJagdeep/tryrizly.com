import { Controller, Get, Headers, Inject, Query, Res } from "@nestjs/common";
import { AuthRepository } from "./auth/auth.repository";
import { CONVERSATION_STORE, type ConversationStore } from "./conversation-store";
import { GatewayService } from "./gateway.service";
import { requireInternalSecret } from "./internal-auth";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import {
  exchangeSlackOAuthCode,
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

    const turns = await this.conversations.get(`slack:${dmChannelId}`);
    return { linked: true, turns };
  }

  /** Lets callers check before rendering an "Add to Slack" button — avoids
   * sending users to /install just to hit a 500 when OAuth isn't set up
   * (always true in local dev, since Slack requires an HTTPS redirect). */
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
    const linked = await this.authRepo.linkSlackUser(
      slackKey,
      record.email,
      userId,
      dmChannelId,
    );
    if (!linked.ok) {
      return fail("That Slack account is already linked to a different Rizly account.");
    }

    try {
      await this.gateway.sendToAiCore("connector.save", {
        userId,
        provider: "slack_surface",
        authType: "oauth",
        label: "Slack DM",
        secret: {
          teamId: oauth.teamId,
          slackUserId: oauth.authedUserId,
          dmChannelId: dmChannelId ?? null,
        },
        metadata: { setup: "slack_oauth" },
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
