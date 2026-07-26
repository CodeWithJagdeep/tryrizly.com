import { Controller, Inject } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { Observable } from "rxjs";
import { AiCoreService, type ChatPayload } from "./ai-core.service";
import type {
  CompleteOAuthInput,
  DeleteConnectorInput,
  SaveConnectorInput,
  StartOAuthInput,
} from "./connectors/connector.types";
import type { HeyRizContextRequest } from "./context/context.types";
import type { MemoryWriteInput } from "./memory/memory.types";
import type {
  EmailEventJobData,
  ReminderRequest,
  SpineJobData,
} from "@heyriz/shared/queue/types";
import type { EmailCategory } from "./email/email.types";
import type { ExtractedEmailFacts } from "./email/email.types";
import { AccountDeletionService } from "./account/account-deletion.service";
import {
  GmailPushService,
  type GmailPushNotification,
} from "./email/gmail-push.service";
import type { GmailPushJobData } from "@heyriz/shared/queue/types";

type ToolExecutePayload = {
  userId?: string;
  name: string;
  payload?: unknown;
  source?: HeyRizContextRequest["source"];
  authorization?: "scheduled-approved";
  executionId?: string;
};

@Controller()
export class AiCoreController {
  constructor(
    @Inject(AiCoreService)
    private readonly aiCoreService: AiCoreService,
    private readonly accountDeletion: AccountDeletionService,
    private readonly gmailPush: GmailPushService,
  ) {}

  @MessagePattern("user.deleteData")
  deleteUserData(@Payload() payload: { userId: string }) {
    return this.accountDeletion.deleteUserData(payload.userId);
  }

  @MessagePattern("health.check")
  healthCheck() {
    return this.aiCoreService.healthCheck();
  }

  @MessagePattern("tools.list")
  listTools() {
    return this.aiCoreService.listTools();
  }

  @MessagePattern("chat.message")
  chat(@Payload() payload: ChatPayload) {
    return this.aiCoreService.chat(payload);
  }

  /**
   * Same turn as "chat.message", but emits a "step" frame at each reasoning/tool
   * point before the final "final" frame — NestJS TCP transport sends every
   * Observable emission as its own response frame, so gateway's client-side
   * subscription sees them as they happen, not just the last one.
   */
  @MessagePattern("chat.message.stream")
  chatStream(
    @Payload() payload: ChatPayload,
  ): Observable<
    | { type: "step"; label: string }
    | { type: "final"; result: Record<string, unknown> }
    | { type: "error"; message: string }
  > {
    return new Observable((subscriber) => {
      this.aiCoreService
        .chat(payload, (label) => subscriber.next({ type: "step", label }))
        .then((result) => {
          subscriber.next({ type: "final", result });
          subscriber.complete();
        })
        .catch((error: unknown) => {
          subscriber.next({
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
          subscriber.complete();
        });
    });
  }

  @MessagePattern("event.ingest")
  ingestEvent(@Payload() payload: HeyRizContextRequest) {
    return this.aiCoreService.ingestEvent(payload);
  }

  @MessagePattern("tool.execute")
  executeTool(@Payload() payload: ToolExecutePayload) {
    return this.aiCoreService.executeTool(payload);
  }

  @MessagePattern("memory.remember")
  remember(@Payload() payload: MemoryWriteInput) {
    return this.aiCoreService.remember(payload);
  }

  @MessagePattern("memory.list")
  listMemories(@Payload() payload: { userId: string; limit?: number }) {
    return this.aiCoreService.listMemories(payload);
  }

  @MessagePattern("memory.forget")
  forgetMemory(@Payload() payload: { userId: string; id: string }) {
    return this.aiCoreService.forgetMemory(payload);
  }

  @MessagePattern("memory.forgetAll")
  forgetAllMemories(@Payload() payload: { userId: string }) {
    return this.aiCoreService.forgetAllMemories(payload);
  }

  @MessagePattern("user.preferences.get")
  getUserPreferences(@Payload() payload: { userId?: string }) {
    return this.aiCoreService.getUserPreferences(payload);
  }

  @MessagePattern("user.avatar.set")
  setUserAvatar(@Payload() payload: { userId?: string; avatarUrl: string }) {
    return this.aiCoreService.setUserAvatar(payload);
  }

  @MessagePattern("user.sync")
  syncUser(
    @Payload() payload: { userId?: string; name?: string; timezone?: string },
  ) {
    return this.aiCoreService.syncUser(payload);
  }

  @MessagePattern("entity.list")
  listPeople(@Payload() payload: { userId?: string; limit?: number }) {
    return this.aiCoreService.listPeople(payload);
  }

  @MessagePattern("entity.resolve")
  resolveEntity(
    @Payload()
    payload: {
      userId?: string;
      from?: string;
      name?: string;
      email?: string;
    },
  ) {
    return this.aiCoreService.resolveEntity(payload);
  }

  @MessagePattern("spine.backfill")
  backfillSpine(@Payload() payload: { userId?: string; days?: number }) {
    return this.aiCoreService.backfillSpine(payload);
  }

  @MessagePattern("spine.timeline")
  timeline(@Payload() payload: { userId?: string; limit?: number }) {
    return this.aiCoreService.timeline(payload);
  }

  @MessagePattern("spine.decisions")
  recallDecisions(@Payload() payload: { userId?: string; topic?: string }) {
    return this.aiCoreService.recallDecisions(payload);
  }

  @MessagePattern("scheduled.list")
  listScheduled(@Payload() payload: { userId?: string }) {
    return this.aiCoreService.listScheduled(payload);
  }

  @MessagePattern("usage.get")
  getUsage(@Payload() payload: { userId?: string }) {
    return this.aiCoreService.getUsage(payload);
  }

  @MessagePattern("usage.listAll")
  listAllUsage(@Payload() payload: { sinceDays?: number }) {
    return this.aiCoreService.listAllUsage(payload);
  }

  @MessagePattern("reminder.schedule")
  scheduleReminder(@Payload() payload: ReminderRequest) {
    return this.aiCoreService.scheduleReminder(payload);
  }

  @MessagePattern("task.markDone")
  markTaskDone(@Payload() payload: { id: string; userId: string }) {
    return this.aiCoreService.markTaskDone(payload);
  }

  @MessagePattern("reminder.cancel")
  cancelReminder(@Payload() payload: { id: string; userId: string }) {
    return this.aiCoreService.cancelScheduledReminder(payload);
  }

  @MessagePattern("proactive.brief")
  proactiveBrief(@Payload() payload: { userId?: string }) {
    return this.aiCoreService.proactiveBrief(payload);
  }

  @MessagePattern("proactive.briefIfDue")
  proactiveBriefIfDue(
    @Payload() payload: { userId?: string; briefHour?: number },
  ) {
    return this.aiCoreService.proactiveBriefIfDue(payload);
  }

  @MessagePattern("proactive.sync")
  proactiveSync(
    @Payload() payload: { userId?: string; source?: "calendar" | "calcom" },
  ) {
    return this.aiCoreService.proactiveSync(payload);
  }

  @MessagePattern("spine.ingestEmail")
  ingestEmailSpine(@Payload() payload: SpineJobData) {
    return this.aiCoreService.ingestEmailSpine(payload);
  }

  @MessagePattern("gmail.getMessage")
  getGmailMessage(@Payload() payload: { userId?: string; messageId: string }) {
    return this.aiCoreService.getGmailMessage(payload);
  }

  @MessagePattern("email.draftReply")
  draftEmailReply(
    @Payload()
    payload: {
      userId?: string;
      messageId: string;
      instructions?: string;
    },
  ) {
    return this.aiCoreService.draftEmailReply(payload);
  }

  @MessagePattern("proactive.weeklyDigest")
  weeklyDigest(@Payload() payload: { userId?: string }) {
    return this.aiCoreService.weeklyDigest(payload);
  }

  @MessagePattern("proactive.dailyAnomalyCheck")
  dailyAnomalyCheck(@Payload() payload: { userId?: string }) {
    return this.aiCoreService.dailyAnomalyCheck(payload);
  }

  @MessagePattern("gmail.checkThreadReply")
  checkThreadReply(
    @Payload()
    payload: {
      userId?: string;
      accountId?: string;
      threadId?: string;
      baselineMessageCount?: number;
    },
  ) {
    return this.aiCoreService.checkThreadReply(payload);
  }

  @MessagePattern("connector.list")
  listConnectors(@Payload() payload: { userId?: string }) {
    return this.aiCoreService.listConnectors(payload);
  }

  @MessagePattern("users.active")
  activeUsers(@Payload() payload: { provider?: string }) {
    return this.aiCoreService.activeUsers(payload);
  }

  @MessagePattern("connector.save")
  saveConnector(@Payload() payload: SaveConnectorInput) {
    return this.aiCoreService.saveConnector(payload);
  }

  @MessagePattern("connector.delete")
  deleteConnector(@Payload() payload: DeleteConnectorInput) {
    return this.aiCoreService.deleteConnector(payload);
  }

  @MessagePattern("connector.deleteById")
  deleteConnectorById(@Payload() payload: { userId?: string; id: string }) {
    return this.aiCoreService.deleteConnectorById(payload);
  }

  @MessagePattern("connector.updateMetadata")
  updateConnectorMetadata(
    @Payload()
    payload: {
      userId?: string;
      id: string;
      metadata: Record<string, unknown>;
    },
  ) {
    return this.aiCoreService.updateConnectorMetadata(payload);
  }

  @MessagePattern("connector.notification.check")
  checkConnectorNotification(
    @Payload() payload: { userId: string; provider: string },
  ) {
    return this.aiCoreService.checkConnectorNotification(payload);
  }

  @MessagePattern("connector.autoprocess.check")
  checkConnectorAutoProcess(
    @Payload() payload: { userId: string; provider: string },
  ) {
    return this.aiCoreService.checkConnectorAutoProcess(payload);
  }

  @MessagePattern("proactive.away.sweep")
  awayReturnSweep() {
    return this.aiCoreService.awayReturnSweep();
  }

  @MessagePattern("connector.oauth.start")
  startOAuth(@Payload() payload: StartOAuthInput) {
    return this.aiCoreService.startConnectorOAuth(payload);
  }

  @MessagePattern("connector.oauth.complete")
  completeOAuth(@Payload() payload: CompleteOAuthInput) {
    return this.aiCoreService.completeConnectorOAuth(payload);
  }

  @MessagePattern("gmail.listRecent")
  listRecentEmails(
    @Payload() payload: { userId?: string; maxResults?: number },
  ) {
    return this.aiCoreService.listRecentEmails(payload);
  }

  @MessagePattern("gmail.push.enqueue")
  enqueueGmailPush(@Payload() payload: GmailPushNotification) {
    return this.gmailPush.enqueueNotification(payload);
  }

  @MessagePattern("gmail.push.process")
  processGmailPush(@Payload() payload: GmailPushJobData) {
    return this.gmailPush.process(payload);
  }

  @MessagePattern("gmail.push.status")
  gmailPushStatus(@Payload() payload: { userId: string }) {
    return this.gmailPush.pushStatus(payload.userId);
  }

  @MessagePattern("gmail.watch.renew")
  renewGmailWatch(@Payload() payload: { userId: string }) {
    return this.gmailPush.renewWatches(payload.userId);
  }

  @MessagePattern("notification.log")
  logNotification(
    @Payload()
    payload: {
      userId: string;
      message: string;
      source?: string;
      sentAt?: string;
    },
  ) {
    return this.aiCoreService.logNotification(payload);
  }

  @MessagePattern("notification.list")
  listNotifications(@Payload() payload: { userId: string; limit?: number }) {
    return this.aiCoreService.listNotifications(payload);
  }

  @MessagePattern("gmail.listEmailMemories")
  listEmailMemories(@Payload() payload: { userId?: string; limit?: number }) {
    return this.aiCoreService.listEmailMemories(payload);
  }

  @MessagePattern("chat.listMemories")
  listChatMemories(@Payload() payload: { userId?: string; limit?: number }) {
    return this.aiCoreService.listChatMemories(payload);
  }

  @MessagePattern("email.process")
  processEmail(@Payload() payload: EmailEventJobData) {
    return this.aiCoreService.processEmail(payload);
  }

  @MessagePattern("automation.gmail.search")
  automationGmailSearch(
    @Payload()
    payload: {
      userId?: string;
      query: string;
      maxResults?: number;
      accountId?: string;
    },
  ) {
    return this.aiCoreService.automationGmailSearch(payload);
  }

  @MessagePattern("automation.calendar.list")
  automationCalendarList(
    @Payload()
    payload: {
      userId?: string;
      timeMin: string;
      timeMax: string;
      maxResults?: number;
    },
  ) {
    return this.aiCoreService.automationCalendarList(payload);
  }

  @MessagePattern("automation.gmail.sendEmail")
  automationGmailSendEmail(
    @Payload() payload: { userId?: string; to: string; subject: string; body: string },
  ) {
    return this.aiCoreService.automationGmailSendEmail(payload);
  }

  @MessagePattern("automation.gmail.createDraft")
  automationGmailCreateDraft(
    @Payload() payload: { userId?: string; to: string; subject: string; body: string },
  ) {
    return this.aiCoreService.automationGmailCreateDraft(payload);
  }

  @MessagePattern("automation.gmail.reply")
  automationGmailReply(
    @Payload()
    payload: {
      userId?: string;
      messageId: string;
      to?: string;
      subject?: string;
      body: string;
    },
  ) {
    return this.aiCoreService.automationGmailReply(payload);
  }

  @MessagePattern("automation.gmail.addLabel")
  automationGmailAddLabel(
    @Payload() payload: { userId?: string; messageId: string; label: string },
  ) {
    return this.aiCoreService.automationGmailAddLabel(payload);
  }

  @MessagePattern("automation.calendar.createEvent")
  automationCalendarCreateEvent(
    @Payload()
    payload: {
      userId?: string;
      summary: string;
      start: string;
      end: string;
      description?: string;
      location?: string;
      attendees?: string[];
    },
  ) {
    return this.aiCoreService.automationCalendarCreateEvent(payload);
  }

  @MessagePattern("automation.calendar.updateEvent")
  automationCalendarUpdateEvent(
    @Payload()
    payload: {
      userId?: string;
      eventId: string;
      start?: string;
      end?: string;
      attendees?: string[];
      notifyAttendee?: boolean;
    },
  ) {
    return this.aiCoreService.automationCalendarUpdateEvent(payload);
  }

  @MessagePattern("automation.calendar.freeBusy")
  automationCalendarFreeBusy(
    @Payload() payload: { userId?: string; timeMin: string; timeMax: string },
  ) {
    return this.aiCoreService.automationCalendarFreeBusy(payload);
  }

  @MessagePattern("automation.calcom.listBookings")
  automationCalcomListBookings(@Payload() payload: { userId?: string }) {
    return this.aiCoreService.automationCalcomListBookings(payload);
  }

  @MessagePattern("automation.jira.searchNewIssues")
  automationJiraSearchNewIssues(
    @Payload() payload: { userId?: string; projectKey?: string },
  ) {
    return this.aiCoreService.automationJiraSearchNewIssues(payload);
  }

  @MessagePattern("automation.pagerduty.listIncidents")
  automationPagerDutyListIncidents(
    @Payload() payload: { userId?: string; serviceId?: string },
  ) {
    return this.aiCoreService.automationPagerDutyListIncidents(payload);
  }

  @MessagePattern("automation.trello.listCards")
  automationTrelloListCards(
    @Payload() payload: { userId?: string; listId: string },
  ) {
    return this.aiCoreService.automationTrelloListCards(payload);
  }

  @MessagePattern("automation.mongo.pollNew")
  automationMongoPollNew(
    @Payload() payload: { userId?: string; collection: string },
  ) {
    return this.aiCoreService.automationMongoPollNew(payload);
  }

  @MessagePattern("automation.drive.listRecentFiles")
  automationDriveListRecentFiles(@Payload() payload: { userId?: string }) {
    return this.aiCoreService.automationDriveListRecentFiles(payload);
  }

  @MessagePattern("connector.notion.webhook")
  notionWebhook(@Payload() payload: { event: Record<string, unknown> }) {
    return this.aiCoreService.notionWebhookEvent(payload.event);
  }

  @MessagePattern("connector.shopify.webhook")
  shopifyWebhook(
    @Payload() payload: { topic: string; shopDomain: string; payload: Record<string, unknown> },
  ) {
    return this.aiCoreService.shopifyWebhookEvent(payload);
  }

  @MessagePattern("connector.calendly.webhook")
  calendlyWebhook(@Payload() payload: { event: string; payload: Record<string, unknown> }) {
    return this.aiCoreService.calendlyWebhookEvent(payload);
  }

  @MessagePattern("connector.typeform.webhook")
  typeformWebhook(@Payload() payload: { formResponse: Record<string, unknown> }) {
    return this.aiCoreService.typeformWebhookEvent(payload);
  }

  @MessagePattern("connector.gumroad.webhook")
  gumroadWebhook(@Payload() payload: Record<string, unknown>) {
    return this.aiCoreService.gumroadWebhookEvent(payload);
  }

  @MessagePattern("connector.lemonsqueezy.webhook")
  lemonSqueezyWebhook(@Payload() payload: { storeId: string; payload: Record<string, unknown> }) {
    return this.aiCoreService.lemonSqueezyWebhookEvent(payload);
  }

  @MessagePattern("connector.dropbox.webhook")
  dropboxWebhook(@Payload() payload: { accountIds: string[] }) {
    return this.aiCoreService.dropboxWebhookEvent(payload);
  }

  @MessagePattern("connector.figma.webhook")
  figmaWebhook(@Payload() payload: { teamId: string; payload: Record<string, unknown> }) {
    return this.aiCoreService.figmaWebhookEvent(payload);
  }

  @MessagePattern("connector.uptimerobot.webhook")
  uptimeRobotWebhook(
    @Payload()
    payload: {
      userId: string;
      monitorId: string;
      monitorFriendlyName?: string;
      alertTypeFriendlyName: string;
    },
  ) {
    return this.aiCoreService.uptimeRobotWebhookEvent(payload);
  }

  @MessagePattern("connector.uptimerobot.resolveSecret")
  resolveUptimeRobotSecret(@Payload() payload: { secret: string }) {
    return this.aiCoreService.resolveUptimeRobotWebhookSecret(payload.secret);
  }

  @MessagePattern("connector.calendly.signingKey")
  getCalendlySigningKey(@Payload() payload: { organizationUri: string }) {
    return this.aiCoreService.getCalendlySigningKey(payload.organizationUri);
  }

  @MessagePattern("connector.typeform.webhookSecret")
  getTypeformWebhookSecret(@Payload() payload: { formId: string }) {
    return this.aiCoreService.getTypeformWebhookSecret(payload.formId);
  }

  @MessagePattern("connector.lemonsqueezy.webhookSecret")
  getLemonSqueezyWebhookSecret(@Payload() payload: { storeId: string }) {
    return this.aiCoreService.getLemonSqueezyWebhookSecret(payload.storeId);
  }

  @MessagePattern("connector.figma.webhookPasscode")
  getFigmaWebhookPasscode(@Payload() payload: { teamId: string }) {
    return this.aiCoreService.getFigmaWebhookPasscode(payload.teamId);
  }

  @MessagePattern("connector.quickbooks.webhook")
  quickBooksWebhook(
    @Payload()
    payload: {
      notifications: Array<{
        realmId?: string;
        dataChangeEvent?: { entities?: Array<{ name?: string; id?: string; operation?: string }> };
      }>;
    },
  ) {
    return this.aiCoreService.quickBooksWebhookEvent(payload);
  }

  @MessagePattern("connector.xero.webhook")
  xeroWebhook(@Payload() payload: { events: Array<Record<string, unknown>> }) {
    return this.aiCoreService.xeroWebhookEvent(payload);
  }

  @MessagePattern("connector.wise.webhook")
  wiseWebhook(@Payload() payload: { profileId?: string; payload: Record<string, unknown> }) {
    return this.aiCoreService.wiseWebhookEvent(payload);
  }

  @MessagePattern("connector.deel.webhook")
  deelWebhook(@Payload() payload: { event?: string; data: Record<string, unknown>; organizationId: string }) {
    return this.aiCoreService.deelWebhookEvent(payload);
  }

  @MessagePattern("connector.deel.signingKey")
  getDeelSigningKey(@Payload() payload: { organizationId: string }) {
    return this.aiCoreService.getDeelSigningKey(payload.organizationId);
  }

  @MessagePattern("connector.stripe.webhook")
  stripeWebhook(
    @Payload() payload: { userId: string; type: string; eventId: string; data: Record<string, unknown> },
  ) {
    return this.aiCoreService.stripeWebhookEvent(payload);
  }

  @MessagePattern("connector.stripe.webhookSecretByAccount")
  getStripeWebhookSecretByAccount(@Payload() payload: { stripeAccountId: string }) {
    return this.aiCoreService.getStripeWebhookSecretByAccount(payload.stripeAccountId);
  }

  @MessagePattern("connector.stripe.allWebhookSecrets")
  getAllStripeWebhookSecrets() {
    return this.aiCoreService.getAllStripeWebhookSecrets();
  }

  @MessagePattern("connector.razorpay.webhook")
  razorpayWebhook(@Payload() payload: { userId: string; event: string; payload: Record<string, unknown> }) {
    return this.aiCoreService.razorpayWebhookEvent(payload);
  }

  @MessagePattern("connector.razorpay.allWebhookSecrets")
  getAllRazorpayWebhookSecrets() {
    return this.aiCoreService.getAllRazorpayWebhookSecrets();
  }

  @MessagePattern("automation.razorpay.createInvoice")
  automationRazorpayCreateInvoice(
    @Payload() payload: { userId?: string; email?: string; amount?: number; currency?: string; description?: string },
  ) {
    return this.aiCoreService.automationRazorpayCreateInvoice(payload);
  }

  @MessagePattern("connector.paypal.webhook")
  paypalWebhook(@Payload() payload: { userId: string; event: Record<string, unknown> }) {
    return this.aiCoreService.paypalWebhookEvent(payload);
  }

  @MessagePattern("connector.paypal.allWebhookAccounts")
  getAllPayPalWebhookAccounts() {
    return this.aiCoreService.getAllPayPalWebhookAccounts();
  }

  @MessagePattern("automation.paypal.createInvoice")
  automationPayPalCreateInvoice(
    @Payload() payload: { userId?: string; email?: string; amount?: number; currency?: string; description?: string },
  ) {
    return this.aiCoreService.automationPayPalCreateInvoice(payload);
  }

  @MessagePattern("connector.box.webhook")
  boxWebhook(@Payload() payload: { folderId: string; payload: Record<string, unknown> }) {
    return this.aiCoreService.boxWebhookEvent(payload);
  }

  @MessagePattern("connector.box.signatureKeys")
  getBoxSignatureKeys(@Payload() payload: { folderId: string }) {
    return this.aiCoreService.getBoxSignatureKeys(payload.folderId);
  }

  @MessagePattern("connector.statuspage.webhook")
  statuspageWebhook(
    @Payload() payload: { userId: string; incidentId: string; status: string; name?: string },
  ) {
    return this.aiCoreService.statuspageWebhookEvent(payload);
  }

  @MessagePattern("connector.statuspage.resolveSecret")
  resolveStatuspageSecret(@Payload() payload: { secret: string }) {
    return this.aiCoreService.resolveStatuspageWebhookSecret(payload.secret);
  }

  @MessagePattern("connector.betterstack.webhook")
  betterStackWebhook(
    @Payload() payload: { userId: string; incidentId: string; status: string; name?: string },
  ) {
    return this.aiCoreService.betterStackWebhookEvent(payload);
  }

  @MessagePattern("connector.betterstack.resolveSecret")
  resolveBetterStackSecret(@Payload() payload: { secret: string }) {
    return this.aiCoreService.resolveBetterStackWebhookSecret(payload.secret);
  }

  @MessagePattern("connector.discord.channelMessage")
  discordChannelMessage(
    @Payload()
    payload: {
      guildId: string;
      channelId: string;
      messageId: string;
      content: string;
      authorId: string;
      messageUrl?: string;
    },
  ) {
    return this.aiCoreService.discordChannelEvent(payload);
  }

  @MessagePattern("automation.ai.extract")
  automationAiExtract(
    @Payload()
    payload: {
      userId?: string;
      prompt: string;
      input: string;
      quality?: "fast" | "advanced";
      outputType?: "text" | "json" | "boolean" | "number";
      contextScopes?: Array<"preferences" | "memory" | "decisions">;
    },
  ) {
    return this.aiCoreService.automationAiExtract(payload);
  }

  @MessagePattern("automation.ai.enhancePrompt")
  automationAiEnhancePrompt(
    @Payload() payload: { userId?: string; prompt: string },
  ) {
    return this.aiCoreService.automationAiEnhancePrompt(payload);
  }

  @MessagePattern("automation.builderChat")
  automationBuilderChat(
    @Payload()
    payload: {
      userId?: string;
      message?: string;
      history?: Array<{ role?: string; content?: string }>;
      flow?: { id?: string; name?: string; steps?: unknown };
    },
  ) {
    return this.aiCoreService.automationBuilderChat(payload);
  }

  @MessagePattern("automation.calcom.eventTypes")
  automationCalcomEventTypes(@Payload() payload: { userId?: string }) {
    return this.aiCoreService.automationCalcomEventTypes(payload);
  }

  @MessagePattern("automation.discord.postMessage")
  automationDiscordPostMessage(
    @Payload() payload: { userId?: string; content: string },
  ) {
    return this.aiCoreService.automationDiscordPostMessage(payload);
  }

  @MessagePattern("automation.github.createIssue")
  automationGitHubCreateIssue(
    @Payload()
    payload: {
      userId?: string;
      repo: string;
      title: string;
      body?: string;
    },
  ) {
    return this.aiCoreService.automationGitHubCreateIssue(payload);
  }

  @MessagePattern("automation.github.listNewIssues")
  automationGitHubListIssues(
    @Payload() payload: { userId?: string; repo: string },
  ) {
    return this.aiCoreService.automationGitHubListIssues(payload);
  }

  @MessagePattern("automation.github.listNewPullRequests")
  automationGitHubListPullRequests(
    @Payload() payload: { userId?: string; repo: string },
  ) {
    return this.aiCoreService.automationGitHubListPullRequests(payload);
  }

  @MessagePattern("automation.github.listNewCommits")
  automationGitHubListCommits(
    @Payload() payload: { userId?: string; repo: string },
  ) {
    return this.aiCoreService.automationGitHubListCommits(payload);
  }

  @MessagePattern("automation.notion.createPage")
  automationNotionCreatePage(
    @Payload()
    payload: {
      userId?: string;
      parentId: string;
      parentType: "database_id" | "page_id";
      title: string;
      content?: string;
    },
  ) {
    return this.aiCoreService.automationNotionCreatePage(payload);
  }

  @MessagePattern("automation.stripe.createCustomer")
  automationStripeCreateCustomer(
    @Payload() payload: { userId?: string; email?: string; name?: string },
  ) {
    return this.aiCoreService.automationStripeCreateCustomer(payload);
  }

  @MessagePattern("automation.google.uploadFile")
  automationGoogleUploadFile(
    @Payload()
    payload: {
      userId?: string;
      name: string;
      mimeType: string;
      content: string;
    },
  ) {
    return this.aiCoreService.automationGoogleUploadFile(payload);
  }

  @MessagePattern("automation.google.appendRow")
  automationGoogleAppendRow(
    @Payload()
    payload: {
      userId?: string;
      spreadsheetId: string;
      range: string;
      values: string[];
    },
  ) {
    return this.aiCoreService.automationGoogleAppendRow(payload);
  }

  @MessagePattern("automation.google.readSheetRows")
  automationGoogleReadSheetRows(
    @Payload()
    payload: {
      userId?: string;
      spreadsheetId: string;
      range: string;
    },
  ) {
    return this.aiCoreService.automationGoogleReadSheetRows(payload);
  }

  @MessagePattern("automation.google.createDoc")
  automationGoogleCreateDoc(
    @Payload() payload: { userId?: string; title: string; content?: string },
  ) {
    return this.aiCoreService.automationGoogleCreateDoc(payload);
  }

  @MessagePattern("automation.google.createMeeting")
  automationGoogleCreateMeeting(
    @Payload()
    payload: {
      userId?: string;
      summary: string;
      start: string;
      end: string;
      attendees?: string[];
    },
  ) {
    return this.aiCoreService.automationGoogleCreateMeeting(payload);
  }

  @MessagePattern("automation.postgres.query")
  automationPostgresQuery(
    @Payload() payload: { userId?: string; query: string; params?: unknown[] },
  ) {
    return this.aiCoreService.automationPostgresQuery(payload);
  }

  @MessagePattern("automation.mongo.find")
  automationMongoFind(
    @Payload()
    payload: {
      userId?: string;
      collection: string;
      filter?: Record<string, unknown>;
      limit?: number;
    },
  ) {
    return this.aiCoreService.automationMongoFind(payload);
  }

  @MessagePattern("automation.jira.createIssue")
  automationJiraCreateIssue(
    @Payload()
    payload: {
      userId?: string;
      projectKey: string;
      summary: string;
      description?: string;
      issueType?: string;
    },
  ) {
    return this.aiCoreService.automationJiraCreateIssue(payload);
  }

  @MessagePattern("automation.pagerduty.createIncident")
  automationPagerDutyCreateIncident(
    @Payload()
    payload: {
      userId?: string;
      serviceId: string;
      title: string;
      urgency?: "high" | "low";
      details?: string;
    },
  ) {
    return this.aiCoreService.automationPagerDutyCreateIncident(payload);
  }

  @MessagePattern("automation.trello.createCard")
  automationTrelloCreateCard(
    @Payload()
    payload: {
      userId?: string;
      listId: string;
      name: string;
      description?: string;
    },
  ) {
    return this.aiCoreService.automationTrelloCreateCard(payload);
  }

  @MessagePattern("automation.airtable.createRecord")
  automationAirtableCreateRecord(
    @Payload()
    payload: {
      userId?: string;
      baseId: string;
      table: string;
      fields: Record<string, unknown>;
    },
  ) {
    return this.aiCoreService.automationAirtableCreateRecord(payload);
  }

  @MessagePattern("automation.bamboohr.listTimeOffRequests")
  automationBambooHrListTimeOffRequests(@Payload() payload: { userId?: string }) {
    return this.aiCoreService.automationBambooHrListTimeOffRequests(payload);
  }

  @MessagePattern("automation.bamboohr.listNewHires")
  automationBambooHrListNewHires(@Payload() payload: { userId?: string }) {
    return this.aiCoreService.automationBambooHrListNewHires(payload);
  }

  @MessagePattern("automation.airtable.listRecords")
  automationAirtableListRecords(
    @Payload()
    payload: {
      userId?: string;
      baseId: string;
      table: string;
      maxRecords?: number;
    },
  ) {
    return this.aiCoreService.automationAirtableListRecords(payload);
  }

  @MessagePattern("automation.twilio.sendSms")
  automationTwilioSendSms(
    @Payload() payload: { userId?: string; to: string; body: string },
  ) {
    return this.aiCoreService.automationTwilioSendSms(payload);
  }

  @MessagePattern("automation.calcom.createBooking")
  automationCalcomCreateBooking(
    @Payload()
    payload: {
      userId?: string;
      eventTypeId: number;
      start: string;
      attendeeName: string;
      attendeeEmail: string;
      timeZone?: string;
      notes?: string;
    },
  ) {
    return this.aiCoreService.automationCalcomCreateBooking(payload);
  }

  @MessagePattern("email.confirm")
  confirmEmailAction(
    @Payload()
    payload: {
      userId?: string;
      accountId?: string;
      messageId?: string;
      threadId?: string;
      category?: EmailCategory;
      facts?: ExtractedEmailFacts;
      action?: "remind" | "schedule" | "draft" | "watch";
      learnPreference?: boolean;
    },
  ) {
    return this.aiCoreService.confirmEmailAction(payload);
  }
}
