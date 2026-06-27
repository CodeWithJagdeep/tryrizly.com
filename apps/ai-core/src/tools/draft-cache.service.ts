import { Injectable } from "@nestjs/common";

type CachedDraft = {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  threadId?: string;
  inReplyTo?: string;
  at: number;
};

const TTL_MS = 30 * 60 * 1000;

/**
 * Remembers the last draft_email_reply per user so send_email can recover the
 * real threadId/inReplyTo even if the model forgets to copy them — the prompt
 * asks the model to carry them forward, but that's not a guarantee, and a
 * dropped threadId silently turns a reply into a brand-new, unthreaded email.
 */
@Injectable()
export class DraftCacheService {
  private readonly cache = new Map<string, CachedDraft>();

  set(userId: string, draft: Omit<CachedDraft, "at">): void {
    this.cache.set(userId, { ...draft, at: Date.now() });
  }

  /** The last draft for this user, if still fresh and addressed to the same recipient. */
  matchFor(userId: string, to: string): CachedDraft | undefined {
    const cached = this.cache.get(userId);
    if (!cached || Date.now() - cached.at > TTL_MS) return undefined;
    if (extractEmail(cached.to) !== extractEmail(to)) return undefined;
    return cached;
  }
}

function extractEmail(raw: string): string {
  const angled = raw.match(/<([^>]+)>/);
  return (angled ? angled[1] : raw).trim().toLowerCase();
}
