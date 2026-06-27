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

export type ExtractedEmailFacts = {
  category: EmailCategory;
  person?: string;
  serviceName?: string;
  amount?: string;
  dueDate?: string;
  meetingTime?: string;
  meetingEndTime?: string;
  meetingTitle?: string;
  action?: string;
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
