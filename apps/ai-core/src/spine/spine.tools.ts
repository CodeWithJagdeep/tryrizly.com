import type { DecisionService } from "./decision.service";
import type { EntityResolverService } from "./entity-resolver.service";
import type { EventRepository } from "./event.repository";
import type { HeyRizTool } from "../tools/tool.types";

type RecallDecisionsPayload = { topic?: string };
type EntityBriefPayload = { name?: string; email?: string };

/** "What did I decide about X" — reads the structured decision layer (current state). */
export function createRecallDecisionsTool(
  decisions: DecisionService,
): HeyRizTool<RecallDecisionsPayload> {
  return {
    name: "recall_decisions",
    category: "memory",
    description:
      "Look up decisions the principal has actually made (current, non-superseded), optionally about a topic. Use this for 'what did I decide about X', 'what's the plan on Y', 'did we settle Z'. Authoritative — prefer over fuzzy memory_recall for decisions.",
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      const rows = await decisions.recall(userId, payload.topic?.trim());
      if (rows.length === 0) {
        return {
          tool: "recall_decisions",
          status: "ok",
          message: payload.topic
            ? `Nothing decided about "${payload.topic}" yet, ${context.honorific}.`
            : `No decisions on record yet, ${context.honorific}.`,
          data: { decisions: [] },
        };
      }
      const lines = rows.map((d) => `• ${d.content}${d.topic ? ` (${d.topic})` : ""}`).join("\n");
      return {
        tool: "recall_decisions",
        status: "ok",
        message: `${cap(context.honorific)}, current decisions${payload.topic ? ` on ${payload.topic}` : ""}:\n${lines}`,
        data: { decisions: rows },
      };
    },
  };
}

/** "Everything involving X / what did I decide with X" — entity's cross-source history + decisions. */
export function createEntityBriefTool(
  entities: EntityResolverService,
  events: EventRepository,
  decisions: DecisionService,
): HeyRizTool<EntityBriefPayload> {
  return {
    name: "entity_brief",
    category: "memory",
    description:
      "Pull the captured history of a specific person or company — their emails + meetings on the timeline AND any decisions made with them. Use for 'what's going on with X', 'everything involving X', 'what did I decide with X', 'when did I last hear from X'. Takes a name or email.",
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      const name = payload.name?.trim();
      const email = payload.email?.trim();
      if (!name && !email) {
        return {
          tool: "entity_brief",
          status: "not_implemented",
          message: `Who should I look up, ${context.honorific}?`,
        };
      }
      const entityId = await entities.lookup(userId, { name, email });
      if (!entityId) {
        return {
          tool: "entity_brief",
          status: "ok",
          message: `Nothing captured about ${name ?? email} yet, ${context.honorific} (they may just not have come up in email/calendar I've seen).`,
          data: { events: [], decisions: [] },
        };
      }
      const [timeline, decided] = await Promise.all([
        events.entityTimeline(userId, entityId, 10),
        decisions.decisionsForEntity(userId, entityId),
      ]);
      if (timeline.length === 0 && decided.length === 0) {
        return {
          tool: "entity_brief",
          status: "ok",
          message: `Nothing on record for ${name ?? email} yet, ${context.honorific}.`,
          data: { entityId, events: [], decisions: [] },
        };
      }
      const parts: string[] = [];
      if (decided.length) {
        parts.push("Decisions:\n" + decided.map((d) => `• ${d.content}`).join("\n"));
      }
      if (timeline.length) {
        parts.push(
          "Recent activity:\n" +
            timeline
              .map((e) => `• ${fmtDate(e.timestamp, context.timezone)} [${e.type}] ${e.content}`)
              .join("\n"),
        );
      }
      return {
        tool: "entity_brief",
        status: "ok",
        message: `${cap(context.honorific)}, here's what I've captured on ${name ?? email}:\n${parts.join("\n\n")}`,
        data: { entityId, events: timeline, decisions: decided },
      };
    },
  };
}

function fmtDate(iso: string, timezone: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
