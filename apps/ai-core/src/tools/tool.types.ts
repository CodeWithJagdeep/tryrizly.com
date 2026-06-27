import type {
  HeyRizPriority,
  HeyRizRuntimeContext,
} from "../context/context.types";

export type ToolCategory =
  | "gmail"
  | "calendar"
  | "memory"
  | "queue"
  | "business"
  | "database"
  | "task";

export type HeyRizToolDefinition = {
  name: string;
  category: ToolCategory;
  description: string;
  approvalRequired: boolean;
  sensitiveDataPolicy: "none" | "live_fetch_only" | "read_only";
};

export type ToolExecutionInput<TPayload = unknown> = {
  userId: string;
  payload: TPayload;
  context: HeyRizRuntimeContext;
};

export type ToolExecutionResult = {
  tool: string;
  status:
    | "ok"
    | "pending_approval"
    | "not_implemented"
    | "needs_connection"
    | "conflict";
  message: string;
  priority?: HeyRizPriority;
  data?: unknown;
};

export type HeyRizTool<TPayload = unknown> = HeyRizToolDefinition & {
  execute(input: ToolExecutionInput<TPayload>): Promise<ToolExecutionResult>;
};
