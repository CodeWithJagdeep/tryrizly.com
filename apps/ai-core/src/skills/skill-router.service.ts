import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { LlmRouterService, extractJson } from "../llm/llm-router.service";
import { AgentSkillRegistryService } from "./agent-skill-registry.service";
import type {
  AgentSkillId,
  SkillRouteInput,
  SkillSelection,
} from "./agent-skill.types";

type ClassifierOutput = {
  skill_ids?: string[];
};

const RULES: ReadonlyArray<{
  id: AgentSkillId;
  pattern: RegExp;
  reason: string;
}> = [
  {
    id: "email",
    pattern:
      /\b(?:email|e-mail|gmail|inbox|mail|message|reply|respond|draft|send|write|compose|forward|cc|bcc|subject|shoot|note)\b/i,
    reason: "email language",
  },
  {
    id: "calendar",
    pattern:
      /\b(?:calendar|meeting|meet|schedule|agenda|availability|available|free|busy|appointment|event|invite|reschedule|book|booking|cal\.?com|call|sync|slot)\b/i,
    reason: "calendar language",
  },
  {
    id: "reminders",
    pattern:
      /\b(?:remind|reminder|follow[- ]?up|to-?do|task|later|every\s+(?:day|week|month)|recurring)\b|\b(?:i have|i've got|got a)\b.{0,40}\b(?:meeting|call|appointment)\b/i,
    reason: "reminder or task language",
  },
  {
    id: "memory",
    pattern:
      /\b(?:remember|recall|memory|decision|decided|agreed|who is|what did|relationship|know about|person|contact)\b/i,
    reason: "memory or entity language",
  },
  {
    id: "connected_sources",
    pattern:
      /\b(?:slack|notion|github|discord|connector|connected|integration|source|announcement|latest update|what changed|going on)\b/i,
    reason: "connected-source language",
  },
  {
    id: "business",
    pattern:
      /\b(?:revenue|revue|mrr|arr|payment|payments|subscription|stripe|razorpay|paypal|m-?pesa|metric|sales|database|postgres|mongodb|mongo)\b/i,
    reason: "business intelligence language",
  },
  {
    id: "automations",
    pattern:
      /\b(?:automation|automate|workflow|flow builder|trigger|when .{0,80} then|every time|activate|pause flow)\b/i,
    reason: "automation language",
  },
  {
    id: "preferences",
    pattern:
      /\b(?:call me|my name|address me|honorific|timezone|time zone|i(?:'m| am) in|language|speak|reply in|away mode|i(?:'m| am) away|back now)\b/i,
    reason: "preference language",
  },
];

const AMBIGUOUS_REQUEST =
  /\b(?:do it|take care of|handle it|send it|book it|move it|that one|what about|check that|go ahead|help me|can you|could you|please)\b/i;

@Injectable()
export class SkillRouterService {
  constructor(
    @Inject(AgentSkillRegistryService)
    private readonly registry: AgentSkillRegistryService,
    @Inject(LlmRouterService)
    private readonly llm: LlmRouterService,
  ) {}

  async route(input: SkillRouteInput): Promise<SkillSelection> {
    const ids: AgentSkillId[] = [];
    const reasons: string[] = [];
    const current = input.message.trim();

    this.applyRules(current, ids, reasons);

    if (input.pendingTool) {
      const approvalSkill = this.registry.skillForTool(input.pendingTool);
      if (approvalSkill) {
        ids.push(approvalSkill);
        reasons.push(`pending approved tool: ${input.pendingTool}`);
      }
    }

    // Contextual follow-ups inherit every plausible domain from recent turns.
    // This is intentionally over-inclusive: an extra small skill is cheaper
    // than making the assistant claim it lacks a capability it actually has.
    if (AMBIGUOUS_REQUEST.test(current) && input.history?.length) {
      const recent = input.history
        .slice(-4)
        .map((turn) => turn.content)
        .join("\n");
      this.applyRules(recent, ids, reasons, "recent conversation: ");
    }

    const shouldClassify =
      ids.length === 0 &&
      current.length > 2 &&
      (AMBIGUOUS_REQUEST.test(current) || Boolean(input.history?.length));
    if (shouldClassify) {
      const classified = await this.classify(input).catch((error: unknown) => {
        logger.warn("skill router classifier failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      });
      for (const id of classified) {
        ids.push(id);
        reasons.push("cheap classifier marked capability plausible");
      }
    }

    return this.registry.select(ids.length ? ids : ["conversation"], {
      reasons,
      source: shouldClassify ? "hybrid" : "rules",
    });
  }

  private applyRules(
    text: string,
    ids: AgentSkillId[],
    reasons: string[],
    prefix = "",
  ): void {
    for (const rule of RULES) {
      if (!rule.pattern.test(text)) continue;
      ids.push(rule.id);
      reasons.push(`${prefix}${rule.reason}`);
    }
  }

  private async classify(input: SkillRouteInput): Promise<AgentSkillId[]> {
    if (!this.llm.hasProvider("agent")) return [];
    const catalog = this.registry
      .list()
      .filter((skill) => skill.id !== "conversation")
      .map((skill) => `- ${skill.id}: ${skill.description}`)
      .join("\n");
    const history = input.history?.slice(-4).map((turn) => `${turn.role}: ${turn.content}`).join("\n");
    const raw = await this.llm.complete({
      messages: [
        {
          role: "user",
          content: [
            "Select capability modules for the user's request.",
            "Be over-inclusive: include a skill whenever there is at least a 20% chance it is needed.",
            "Return only JSON: {\"skill_ids\":[\"id\"]}. Never invent ids.",
            catalog,
            history ? `Recent conversation:\n${history}` : "",
            `Current request:\n${input.message}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      temperature: 0,
      task: "agent",
      provider: "grok",
      model: "grok-3-mini",
      userId: input.userId,
    });
    const parsed = extractJson<ClassifierOutput>(raw ?? "");
    return (parsed?.skill_ids ?? []).filter(
      (id): id is AgentSkillId =>
        id !== "general" && Boolean(this.registry.get(id)),
    );
  }
}
