export type EmailCategory =
  | "otp"
  | "payment_due"
  | "account_alert"
  | "meeting_request"
  | "investor_update"
  | "follow_up_needed"
  | "newsletter"
  | "general_high"
  | "general_medium"
  | "general_low";

export type EmailUrgency = "urgent" | "soon" | "normal" | "low";

export type EmailSenderType =
  | "human"
  | "automated"
  | "customer"
  | "investor"
  | "vendor"
  | "internal"
  | "unknown";

export type EmailSuggestedAction =
  | "ignore"
  | "notify"
  | "remind"
  | "schedule"
  | "draft_reply"
  | "watch_thread"
  | "review_manually";

export type EmailRiskLevel = "high" | "medium" | "low";

export type EmailReplyIntent =
  | "ask"
  | "approve"
  | "decline"
  | "schedule"
  | "pay"
  | "review"
  | "ignore"
  | "delegate"
  | "unknown";

export type ExtractedEmailFacts = {
  category: EmailCategory;
  person?: string;
  entities?: string[];
  serviceName?: string;
  amount?: string;
  dueDate?: string;
  meetingTime?: string;
  meetingEndTime?: string;
  meetingTitle?: string;
  action?: string;
  requiresReply?: boolean;
  urgency?: EmailUrgency;
  senderType?: EmailSenderType;
  suggestedAction?: EmailSuggestedAction;
  reason?: string;
  riskLevel?: EmailRiskLevel;
  isAutomated?: boolean;
  isMarketing?: boolean;
  replyIntent?: EmailReplyIntent;
  summary: string;
  confidence: "high" | "medium" | "low";
};

export type EmailBehaviorPreference = {
  userId: string;
  category: EmailCategory;
  autoAct: boolean;
  defaultAction?: "remind" | "schedule" | "draft" | "silent";
  updatedAt: string;
};

export type EmailPipelineResult = {
  messageId: string;
  category: EmailCategory;
  handled: "auto" | "ask" | "ignored";
  notificationSent: boolean;
  facts: ExtractedEmailFacts;
  actionsScheduled: string[];
};
