import { Controller, Inject } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
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

type ToolExecutePayload = {
  userId?: string;
  name: string;
  payload?: unknown;
  source?: HeyRizContextRequest["source"];
  authorization?: "scheduled-approved";
};

@Controller()
export class AiCoreController {
  constructor(
    @Inject(AiCoreService)
    private readonly aiCoreService: AiCoreService,
  ) {}

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
  syncUser(@Payload() payload: { userId?: string; name?: string; timezone?: string }) {
    return this.aiCoreService.syncUser(payload);
  }

  @MessagePattern("entity.list")
  listPeople(@Payload() payload: { userId?: string; limit?: number }) {
    return this.aiCoreService.listPeople(payload);
  }

  @MessagePattern("entity.resolve")
  resolveEntity(
    @Payload() payload: { userId?: string; from?: string; name?: string; email?: string },
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
  proactiveBriefIfDue(@Payload() payload: { userId?: string; briefHour?: number }) {
    return this.aiCoreService.proactiveBriefIfDue(payload);
  }

  @MessagePattern("proactive.sync")
  proactiveSync(@Payload() payload: { userId?: string; source?: "calendar" | "calcom" }) {
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
    @Payload() payload: { userId?: string; messageId: string; instructions?: string },
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
    payload: { userId?: string; threadId?: string; baselineMessageCount?: number },
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
  updateConnectorMetadata(@Payload() payload: { userId?: string; id: string; metadata: Record<string, unknown> }) {
    return this.aiCoreService.updateConnectorMetadata(payload);
  }

  @MessagePattern("connector.notification.check")
  checkConnectorNotification(@Payload() payload: { userId: string; provider: string }) {
    return this.aiCoreService.checkConnectorNotification(payload);
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

  @MessagePattern("notification.log")
  logNotification(
    @Payload() payload: { userId: string; message: string; source?: string; sentAt?: string },
  ) {
    return this.aiCoreService.logNotification(payload);
  }

  @MessagePattern("notification.list")
  listNotifications(
    @Payload() payload: { userId: string; limit?: number },
  ) {
    return this.aiCoreService.listNotifications(payload);
  }

  @MessagePattern("gmail.listEmailMemories")
  listEmailMemories(
    @Payload() payload: { userId?: string; limit?: number },
  ) {
    return this.aiCoreService.listEmailMemories(payload);
  }

  @MessagePattern("chat.listMemories")
  listChatMemories(
    @Payload() payload: { userId?: string; limit?: number },
  ) {
    return this.aiCoreService.listChatMemories(payload);
  }

  @MessagePattern("email.process")
  processEmail(@Payload() payload: EmailEventJobData) {
    return this.aiCoreService.processEmail(payload);
  }

  @MessagePattern("email.confirm")
  confirmEmailAction(
    @Payload()
    payload: {
      userId?: string;
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
