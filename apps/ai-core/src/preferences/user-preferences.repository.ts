import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { env } from "@heyriz/shared/env";
import { isValidTimeZone } from "../lib/timezone";

const inMemoryHonorifics = new Map<string, string>();
const inMemoryDisplayNames = new Map<string, { name: string; overridden: boolean }>();
const inMemoryTimezones = new Map<string, string>();
const inMemoryLanguages = new Map<string, string>();
const inMemoryAvatars = new Map<string, string>();
const inMemoryAwayUntil = new Map<string, string>();
const inMemoryAwayHeld = new Map<string, HeldAwayEmail[]>();

/** An email held (not notified) while the principal is in Away/Vacation mode. */
export type HeldAwayEmail = {
  from: string;
  subject: string;
  summary: string;
  category: string;
  urgency?: string;
  amount?: string;
  dueDate?: string;
  messageId?: string;
  at: string;
};

/**
 * The principal can say "call me X" at any point in chat; that overrides the
 * env default (PRINCIPAL_HONORIFIC) from then on, per userId.
 */
@Injectable()
export class UserPreferencesRepository implements OnModuleDestroy {
  private readonly pool?: Pool;

  constructor() {
    if (env.DATABASE_URL) {
      this.pool = new Pool({ connectionString: env.DATABASE_URL });
    }
  }

  /** The name the agent signs emails with, e.g. for "Best regards,". */
  async getDisplayName(userId: string): Promise<string | undefined> {
    if (!this.pool) {
      return inMemoryDisplayNames.get(userId)?.name;
    }

    await this.ensureTable();
    const result = await this.pool.query<{ display_name: string }>(
      "select display_name from user_preferences where user_id = $1 limit 1",
      [userId],
    );
    return result.rows[0]?.display_name ?? undefined;
  }

  /** Explicit override, e.g. the principal says "sign as Alex" — sticks from then on. */
  async setDisplayName(userId: string, name: string): Promise<void> {
    if (!this.pool) {
      inMemoryDisplayNames.set(userId, { name, overridden: true });
      return;
    }

    await this.ensureTable();
    await this.pool.query(
      `
      insert into user_preferences (user_id, honorific, display_name, display_name_overridden, updated_at)
      values ($1, $2, $3, true, $4)
      on conflict (user_id)
      do update set display_name = excluded.display_name, display_name_overridden = true, updated_at = excluded.updated_at
      `,
      [userId, env.PRINCIPAL_HONORIFIC, name, new Date().toISOString()],
    );
  }

  /** Called when gateway syncs the login/signup name; never clobbers an explicit override. */
  async syncDisplayNameFromSignup(userId: string, name: string): Promise<void> {
    if (!this.pool) {
      if (!inMemoryDisplayNames.get(userId)?.overridden) {
        inMemoryDisplayNames.set(userId, { name, overridden: false });
      }
      return;
    }

    await this.ensureTable();
    await this.pool.query(
      `
      insert into user_preferences (user_id, honorific, display_name, display_name_overridden, updated_at)
      values ($1, $2, $3, false, $4)
      on conflict (user_id)
      do update set display_name = excluded.display_name, updated_at = excluded.updated_at
      where user_preferences.display_name_overridden = false
      `,
      [userId, env.PRINCIPAL_HONORIFIC, name, new Date().toISOString()],
    );
  }

  /** The principal's IANA timezone (e.g. "Asia/Kolkata"), used for any reasoning about times. */
  async getTimezone(userId: string): Promise<string> {
    if (!this.pool) {
      return inMemoryTimezones.get(userId) ?? env.DEFAULT_TIMEZONE;
    }

    await this.ensureTable();
    const result = await this.pool.query<{ timezone: string }>(
      "select timezone from user_preferences where user_id = $1 limit 1",
      [userId],
    );
    return result.rows[0]?.timezone ?? env.DEFAULT_TIMEZONE;
  }

  /** False until the principal has explicitly given a timezone (via set_timezone) — distinguishes "never asked" from "really is UTC". */
  async hasExplicitTimezone(userId: string): Promise<boolean> {
    if (!this.pool) {
      return inMemoryTimezones.has(userId);
    }

    await this.ensureTable();
    const result = await this.pool.query<{ timezone: string | null }>(
      "select timezone from user_preferences where user_id = $1 limit 1",
      [userId],
    );
    return result.rows[0]?.timezone != null;
  }

  async setTimezone(userId: string, timezone: string): Promise<void> {
    if (!isValidTimeZone(timezone)) {
      throw new Error(`invalid_timezone:${timezone}`);
    }

    if (!this.pool) {
      inMemoryTimezones.set(userId, timezone);
      return;
    }

    await this.ensureTable();
    await this.pool.query(
      `
      insert into user_preferences (user_id, honorific, timezone, updated_at)
      values ($1, $2, $3, $4)
      on conflict (user_id)
      do update set timezone = excluded.timezone, updated_at = excluded.updated_at
      `,
      [userId, env.PRINCIPAL_HONORIFIC, timezone, new Date().toISOString()],
    );
  }

  async getHonorific(userId: string): Promise<string> {
    if (!this.pool) {
      return inMemoryHonorifics.get(userId) ?? env.PRINCIPAL_HONORIFIC;
    }

    await this.ensureTable();
    const result = await this.pool.query<{ honorific: string }>(
      "select honorific from user_preferences where user_id = $1 limit 1",
      [userId],
    );
    return result.rows[0]?.honorific ?? env.PRINCIPAL_HONORIFIC;
  }

  async setHonorific(userId: string, honorific: string): Promise<void> {
    if (!this.pool) {
      inMemoryHonorifics.set(userId, honorific);
      return;
    }

    await this.ensureTable();
    await this.pool.query(
      `
      insert into user_preferences (user_id, honorific, updated_at)
      values ($1, $2, $3)
      on conflict (user_id)
      do update set honorific = excluded.honorific, updated_at = excluded.updated_at
      `,
      [userId, honorific, new Date().toISOString()],
    );
  }

  /** The language/style the agent should reply in (e.g. "Hinglish", "Hindi"), or undefined for default. */
  async getLanguage(userId: string): Promise<string | undefined> {
    if (!this.pool) {
      return inMemoryLanguages.get(userId);
    }

    await this.ensureTable();
    const result = await this.pool.query<{ language: string }>(
      "select language from user_preferences where user_id = $1 limit 1",
      [userId],
    );
    return result.rows[0]?.language ?? undefined;
  }

  /** The principal switched language mid-chat (e.g. wrote in Hinglish) — sticks from then on. */
  async setLanguage(userId: string, language: string): Promise<void> {
    if (!this.pool) {
      inMemoryLanguages.set(userId, language);
      return;
    }

    await this.ensureTable();
    await this.pool.query(
      `
      insert into user_preferences (user_id, honorific, language, updated_at)
      values ($1, $2, $3, $4)
      on conflict (user_id)
      do update set language = excluded.language, updated_at = excluded.updated_at
      `,
      [userId, env.PRINCIPAL_HONORIFIC, language, new Date().toISOString()],
    );
  }

  async getAvatarUrl(userId: string): Promise<string | undefined> {
    if (!this.pool) return inMemoryAvatars.get(userId);
    await this.ensureTable();
    const result = await this.pool.query<{ avatar_url: string }>(
      "select avatar_url from user_preferences where user_id = $1 limit 1",
      [userId],
    );
    return result.rows[0]?.avatar_url ?? undefined;
  }

  async setAvatarUrl(userId: string, avatarUrl: string): Promise<void> {
    if (!this.pool) {
      inMemoryAvatars.set(userId, avatarUrl);
      return;
    }
    await this.ensureTable();
    await this.pool.query(
      `
      insert into user_preferences (user_id, honorific, avatar_url, updated_at)
      values ($1, $2, $3, $4)
      on conflict (user_id)
      do update set avatar_url = excluded.avatar_url, updated_at = excluded.updated_at
      `,
      [userId, env.PRINCIPAL_HONORIFIC, avatarUrl, new Date().toISOString()],
    );
  }

  // ── Away / Vacation mode ────────────────────────────────────────────────────

  /** ISO timestamp the principal is away until, or undefined if not away / expired. */
  async getAwayUntil(userId: string): Promise<string | undefined> {
    if (!this.pool) {
      const until = inMemoryAwayUntil.get(userId);
      return until && new Date(until) > new Date() ? until : undefined;
    }
    await this.ensureTable();
    const result = await this.pool.query<{ away_until: Date | null }>(
      "select away_until from user_preferences where user_id = $1 limit 1",
      [userId],
    );
    const until = result.rows[0]?.away_until;
    if (!until) return undefined;
    const iso = new Date(until).toISOString();
    return new Date(iso) > new Date() ? iso : undefined;
  }

  async setAwayUntil(userId: string, untilIso: string): Promise<void> {
    if (!this.pool) {
      inMemoryAwayUntil.set(userId, untilIso);
      inMemoryAwayHeld.set(userId, []); // fresh trip → fresh held list
      return;
    }
    await this.ensureTable();
    await this.pool.query(
      `insert into user_preferences (user_id, honorific, away_until, away_held, updated_at)
       values ($1, $2, $3, '[]'::jsonb, $4)
       on conflict (user_id)
       do update set away_until = excluded.away_until, away_held = '[]'::jsonb, updated_at = excluded.updated_at`,
      [userId, env.PRINCIPAL_HONORIFIC, untilIso, new Date().toISOString()],
    );
  }

  /** Append one held email to the away list (atomic jsonb concat). */
  async holdAwayEmail(userId: string, item: HeldAwayEmail): Promise<void> {
    if (!this.pool) {
      const list = inMemoryAwayHeld.get(userId) ?? [];
      list.push(item);
      inMemoryAwayHeld.set(userId, list);
      return;
    }
    await this.ensureTable();
    await this.pool.query(
      `insert into user_preferences (user_id, honorific, away_held, updated_at)
       values ($1, $2, $3::jsonb, $4)
       on conflict (user_id)
       do update set away_held = coalesce(user_preferences.away_held, '[]'::jsonb) || $3::jsonb, updated_at = excluded.updated_at`,
      [userId, env.PRINCIPAL_HONORIFIC, JSON.stringify([item]), new Date().toISOString()],
    );
  }

  async getHeldAwayEmails(userId: string): Promise<HeldAwayEmail[]> {
    if (!this.pool) return inMemoryAwayHeld.get(userId) ?? [];
    await this.ensureTable();
    const result = await this.pool.query<{ away_held: HeldAwayEmail[] | null }>(
      "select away_held from user_preferences where user_id = $1 limit 1",
      [userId],
    );
    return result.rows[0]?.away_held ?? [];
  }

  /** End away mode and drop the held list (called after the return digest is delivered). */
  async clearAway(userId: string): Promise<void> {
    if (!this.pool) {
      inMemoryAwayUntil.delete(userId);
      inMemoryAwayHeld.delete(userId);
      return;
    }
    await this.ensureTable();
    await this.pool.query(
      `update user_preferences set away_until = null, away_held = '[]'::jsonb, updated_at = $2 where user_id = $1`,
      [userId, new Date().toISOString()],
    );
  }

  /** Users whose away window has elapsed but who still have held emails — for the scheduler's return digest. */
  async listExpiredAwayUsers(): Promise<string[]> {
    if (!this.pool) {
      const now = new Date();
      return [...inMemoryAwayUntil.entries()]
        .filter(([uid, until]) => new Date(until) <= now && (inMemoryAwayHeld.get(uid)?.length ?? 0) > 0)
        .map(([uid]) => uid);
    }
    await this.ensureTable();
    const result = await this.pool.query<{ user_id: string }>(
      `select user_id from user_preferences
        where away_until is not null and away_until <= now()
          and jsonb_array_length(coalesce(away_held, '[]'::jsonb)) > 0`,
    );
    return result.rows.map((r) => r.user_id);
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private async ensureTable() {
    if (!this.pool) return;
    await this.pool.query(`
      create table if not exists user_preferences (
        user_id text primary key,
        honorific text not null,
        updated_at timestamptz not null
      )
    `);
    await this.pool.query(`
      alter table user_preferences
        add column if not exists display_name text,
        add column if not exists display_name_overridden boolean not null default false,
        add column if not exists timezone text,
        add column if not exists language text,
        add column if not exists avatar_url text,
        add column if not exists away_until timestamptz,
        add column if not exists away_held jsonb not null default '[]'::jsonb
    `);
  }
}
