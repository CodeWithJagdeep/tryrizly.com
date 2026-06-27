import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { EntityResolverService } from "./entity-resolver.service";
import { EventRepository, type EventType } from "./event.repository";

export type Participant = { name?: string; email?: string; role?: string };

export type RecordEventInput = {
  type: EventType;
  source: string;
  sourceId?: string;
  threadId?: string;
  timestamp: Date;
  content: string;
  metadata?: Record<string, unknown>;
  participants: Participant[];
};

/**
 * The single entry point the ingest hooks (email/calendar/chat) call to drop
 * something onto the timeline. Writes the event, then resolves each participant
 * to a canonical entity and links it. Best-effort per participant — one bad
 * address never loses the event.
 */
@Injectable()
export class EventIngestService {
  constructor(
    @Inject(EventRepository)
    private readonly events: EventRepository,
    @Inject(EntityResolverService)
    private readonly entities: EntityResolverService,
  ) {}

  async recordEvent(
    userId: string,
    input: RecordEventInput,
  ): Promise<{ id: string; inserted: boolean } | undefined> {
    if (!this.events.hasDb()) return undefined;

    const recorded = await this.events.recordEvent({
      userId,
      type: input.type,
      source: input.source,
      sourceId: input.sourceId,
      threadId: input.threadId,
      timestamp: input.timestamp,
      content: input.content,
      metadata: input.metadata,
    });
    if (!recorded) return undefined;
    const eventId = recorded.id;

    for (const p of input.participants) {
      if (!p.name && !p.email) continue;
      try {
        const resolved = await this.entities.resolve(userId, {
          name: p.name,
          email: p.email,
          source: input.source,
        });
        if (resolved) await this.events.linkEntity(eventId, resolved.entityId, p.role);
      } catch (error) {
        logger.warn("event ingest: participant link failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return recorded;
  }
}
