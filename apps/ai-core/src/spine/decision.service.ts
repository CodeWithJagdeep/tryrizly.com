import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { BudgetGateService } from "../billing/budget-gate.service";
import { LlmRouterService, extractJson } from "../llm/llm-router.service";
import { DecisionRepository, type DecisionRow } from "./decision.repository";
import { EntityResolverService } from "./entity-resolver.service";
import { EventRepository } from "./event.repository";

// Cheap deterministic pre-gate for CHAT only — emails are gated upstream by
// classification, so we don't burn an LLM call on "hi".
const DECISION_SIGNAL =
  /\b(decide[ds]?|let'?s|go(ing)? with|go ahead|confirm(ed)?|lock(ed)?( in)?|finali[sz]e|agree[ds]?|i'?ll|we'?ll|choos[ei]|chose|pick(ed)?|settl|approv|book(ed|ing)?|schedul|sign(ed)?|\bdeal\b|final(i[sz]e|ize)?|pay(ing)?|sounds good|works for me|fine by me|ship it|good to go|will do|sgtm|lgtm)\b/i;

type Extracted = { content: string; topic: string; who: string[] };

@Injectable()
export class DecisionService {
  constructor(
    @Inject(LlmRouterService)
    private readonly llm: LlmRouterService,
    @Inject(DecisionRepository)
    private readonly decisions: DecisionRepository,
    @Inject(EventRepository)
    private readonly events: EventRepository,
    @Inject(EntityResolverService)
    private readonly entities: EntityResolverService,
    @Inject(BudgetGateService)
    private readonly budgetGate: BudgetGateService,
  ) {}

  /** Decisions the principal stated in a chat message. */
  async extractFromChat(userId: string, text: string): Promise<DecisionRow[]> {
    if (!this.ready() || !DECISION_SIGNAL.test(text) || (await this.overBudget(userId))) return [];
    const found = await this.runExtraction(userId, text);
    if (found.length === 0) return [];
    // Provenance event only once a decision exists — keeps the timeline signal-rich.
    const recorded = await this.events
      .recordEvent({ userId, type: "message", source: "chat", timestamp: new Date(), content: text.slice(0, 500) })
      .catch(() => undefined);
    return this.store(userId, found, { eventId: recorded?.id, baseEntityIds: [] });
  }

  /**
   * Decisions/agreements made in an email thread — the richest source, previously
   * ignored. Body is read live (already fetched by the pipeline) and never stored;
   * decisions link to the sender entity so "what did I decide with X" works.
   */
  async extractFromEmail(
    userId: string,
    input: { from: string; subject: string; body: string },
  ): Promise<DecisionRow[]> {
    if (!this.ready() || (await this.overBudget(userId))) return [];
    const text = `From: ${input.from}\nSubject: ${input.subject}\n\n${input.body.slice(0, 3000)}`;
    const found = await this.runExtraction(userId, text);
    if (found.length === 0) return [];
    const sender = await this.entities
      .resolveFromHeader(userId, input.from, "gmail")
      .catch(() => undefined);
    return this.store(userId, found, {
      baseEntityIds: sender ? [sender.entityId] : [],
    });
  }

  /**
   * Decisions/agreements written into a meeting's description (e.g. "agenda:
   * confirmed scope X, $Y/mo") — previously never mined at all. Links to
   * attendee entities the same way an email links to its sender.
   */
  async extractFromMeeting(
    userId: string,
    input: { title: string; description: string; attendees: string[] },
  ): Promise<DecisionRow[]> {
    if (!this.ready() || !input.description.trim() || (await this.overBudget(userId))) return [];
    const text = `Meeting: ${input.title}\nAttendees: ${input.attendees.join(", ")}\n\n${input.description.slice(0, 3000)}`;
    const found = await this.runExtraction(userId, text);
    if (found.length === 0) return [];
    const ids = new Set<string>();
    for (const email of input.attendees) {
      const id = await this.entities.resolveFromHeader(userId, email, "calendar").catch(() => undefined);
      if (id) ids.add(id.entityId);
    }
    return this.store(userId, found, { baseEntityIds: [...ids] });
  }

  recall(userId: string, topic?: string): Promise<DecisionRow[]> {
    return this.decisions.activeDecisions(userId, topic);
  }

  decisionsForEntity(userId: string, entityId: string): Promise<DecisionRow[]> {
    return this.decisions.decisionsForEntity(userId, entityId);
  }

  private ready(): boolean {
    return this.decisions.hasDb() && this.llm.hasProvider();
  }

  /** "decide" is background AI — stop spending on it once the user's cycle budget is gone. */
  private async overBudget(userId: string): Promise<boolean> {
    const budget = await this.budgetGate.check(userId);
    return budget.state === "exceeded";
  }

  private async runExtraction(userId: string, text: string): Promise<Extracted[]> {
    let raw: string | undefined;
    try {
      raw = await this.llm.complete({
        task: "decide",
        userId,
        temperature: 0,
        maxTokens: 500,
        messages: [
          {
            role: "system",
            content: [
              "You extract DECISIONS from text: explicit choices, agreements, or commitments that are now SETTLED — made by the principal or mutually agreed with a counterparty.",
              "ONLY extract real, settled commitments. REJECT and skip: proposals not yet accepted, options still being weighed, questions, FYIs, vague discussion, hypotheticals, or one side merely suggesting something.",
              "A casual 'sounds good' / 'ok' / 'approved' / 'works for me' is a decision ONLY when it clearly accepts a SPECIFIC concrete proposal already on the table (a named time, price, vendor, scope, or plan) — then capture WHAT was accepted, not the word 'ok'. Plain agreement, thanks, or pleasantries with no concrete object are NOT decisions.",
              'For each real decision output {"content":"<one concise line of what was decided>","topic":"<2-4 word lowercase grouping key, e.g. \'pricing tier\', \'oximon meeting time\'>","who":["<names or companies involved, if any>"]}.',
              "Be conservative: when in doubt, output nothing.",
              'Reply ONLY with compact JSON: {"decisions":[...]} — empty array if there is no real decision.',
            ].join("\n"),
          },
          { role: "user", content: text.slice(0, 4000) },
        ],
      });
    } catch (error) {
      logger.warn("decision extract llm failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }

    const parsed = extractJson<{
      decisions?: Array<{ content?: string; topic?: string; who?: string[] }>;
    }>(raw ?? "");
    return (parsed?.decisions ?? [])
      .filter((d) => d.content?.trim())
      .map((d) => ({
        content: d.content!.trim(),
        topic: normalizeTopic(d.topic) || d.content!.trim().toLowerCase().slice(0, 40),
        who: Array.isArray(d.who) ? d.who.filter((w) => typeof w === "string" && w.trim()) : [],
      }));
  }

  private async store(
    userId: string,
    found: Extracted[],
    opts: { eventId?: string; baseEntityIds: string[] },
  ): Promise<DecisionRow[]> {
    const stored: DecisionRow[] = [];
    for (const d of found) {
      // Link the base entities (e.g. email sender) plus anyone named in the decision.
      const ids = new Set(opts.baseEntityIds);
      for (const who of d.who) {
        const id = await this.entities.lookup(userId, { name: who }).catch(() => undefined);
        if (id) ids.add(id);
      }
      const decisionId = await this.decisions
        .insertDecision({
          userId,
          content: d.content,
          topic: d.topic,
          eventId: opts.eventId,
          entityIds: [...ids],
        })
        .catch(() => undefined);
      if (!decisionId) continue;
      await this.decisions.supersedeTopic(userId, d.topic, decisionId).catch(() => undefined);
      stored.push({
        id: decisionId,
        content: d.content,
        topic: d.topic,
        status: "confirmed",
        createdAt: new Date().toISOString(),
      });
    }
    if (stored.length) logger.info("spine: decisions captured", { userId, count: stored.length });
    return stored;
  }
}

function normalizeTopic(topic?: string): string {
  return (topic ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
