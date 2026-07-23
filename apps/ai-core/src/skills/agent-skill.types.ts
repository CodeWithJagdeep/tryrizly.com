export type AgentContextScope =
  | "memory"
  | "live_calendar"
  | "live_inbox"
  | "connectors";

export type AgentSkillId =
  | "conversation"
  | "email"
  | "calendar"
  | "reminders"
  | "memory"
  | "connected_sources"
  | "business"
  | "automations"
  | "preferences"
  | "general";

/**
 * Skills are deterministic capability modules, not retrieved documents.
 * Their policy text, tool grants, and context requirements are versioned in
 * code and can only be selected by the trusted runtime.
 */
export type AgentSkill = {
  readonly id: AgentSkillId;
  readonly version: number;
  readonly description: string;
  readonly instructions: string;
  readonly tools: readonly string[];
  readonly contextScopes: readonly AgentContextScope[];
};

export type SkillSelection = {
  skillIds: AgentSkillId[];
  toolNames: string[];
  contextScopes: AgentContextScope[];
  reasons: string[];
  source: "rules" | "hybrid" | "fallback";
};

export type SkillRouteInput = {
  message: string;
  userId: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  pendingTool?: string;
};
