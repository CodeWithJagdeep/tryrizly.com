import type { HeldAwayEmail } from "../preferences/user-preferences.repository";
import { UserPreferencesRepository } from "../preferences/user-preferences.repository";
import type { HeyRizTool } from "./tool.types";

// ── Away / Vacation mode ──────────────────────────────────────────────────────

const URGENCY_RANK: Record<string, number> = { urgent: 0, soon: 1, normal: 2, low: 3 };
const PRIORITY_CATEGORIES = new Set(["payment_due", "investor", "customer", "account_alert", "meeting_request"]);

/** Rank held emails so the most time-sensitive land at the top of the return digest. */
function rankHeld(a: HeldAwayEmail, b: HeldAwayEmail): number {
  const pa = PRIORITY_CATEGORIES.has(a.category) ? 0 : 1;
  const pb = PRIORITY_CATEGORIES.has(b.category) ? 0 : 1;
  if (pa !== pb) return pa - pb;
  const ua = URGENCY_RANK[a.urgency ?? "normal"] ?? 2;
  const ub = URGENCY_RANK[b.urgency ?? "normal"] ?? 2;
  if (ua !== ub) return ua - ub;
  return a.at.localeCompare(b.at);
}

export function formatAwayDigest(items: HeldAwayEmail[], honorific: string): string {
  if (items.length === 0) {
    return `Welcome back, ${honorific} — nothing important came in while you were away.`;
  }
  const sorted = [...items].sort(rankHeld);
  const lines = sorted.slice(0, 20).map((it, i) => {
    const extras = [
      it.amount ? `amount ${it.amount}` : "",
      it.dueDate ? `due ${new Date(it.dueDate).toLocaleDateString()}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    return `${i + 1}. ${it.summary || it.subject} — from ${it.from}${extras ? ` (${extras})` : ""}`;
  });
  const more = sorted.length > 20 ? `\n…and ${sorted.length - 20} more.` : "";
  return `Welcome back, ${honorific}. Here's the priority list I held while you were away (${items.length} item${items.length === 1 ? "" : "s"}):\n\n${lines.join("\n")}${more}`;
}

type SetAwayModePayload = {
  /** Number of days from now the principal is away (e.g. "vacation for 7 days" -> 7). */
  days?: number;
  /** Explicit return date/datetime as ISO or a parseable string (resolve "Monday" to a date yourself). */
  untilDate?: string;
};

export function createSetAwayModeTool(
  preferences: UserPreferencesRepository,
): HeyRizTool<SetAwayModePayload> {
  return {
    name: "set_away_mode",
    category: "memory",
    description:
      'Turn on Away/Vacation mode: while away, Riz stops pinging the principal about new emails and instead quietly collects the important ones into a priority list, handed back as a digest on return. Call this when the principal says they\'re away/on vacation/OOO (e.g. "I\'m on vacation for 7 days", "I\'m away until Monday, don\'t bother me"). Pass either `days` (relative) or `untilDate` (resolve any day name to an actual date yourself).',
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      let untilIso: string | undefined;
      if (typeof payload.days === "number" && payload.days > 0) {
        untilIso = new Date(Date.now() + Math.min(payload.days, 365) * 86_400_000).toISOString();
      } else if (payload.untilDate?.trim()) {
        const parsed = new Date(payload.untilDate.trim());
        if (!Number.isNaN(parsed.getTime())) {
          // Date-only (midnight) → treat as end of that day so "until Monday" covers Monday.
          if (/^\d{4}-\d{2}-\d{2}$/.test(payload.untilDate.trim())) parsed.setHours(23, 59, 59, 0);
          untilIso = parsed.toISOString();
        }
      }
      if (!untilIso || new Date(untilIso) <= new Date()) {
        return {
          tool: "set_away_mode",
          status: "invalid_input",
          message: `How long will you be away, ${context.honorific}? Tell me a number of days or a return date.`,
        };
      }
      await preferences.setAwayUntil(userId, untilIso);
      const back = new Date(untilIso).toLocaleDateString();
      return {
        tool: "set_away_mode",
        status: "ok",
        message: `Enjoy your time off, ${context.honorific} — I won't bother you until ${back}. I'll hold anything important and give you the priority list when you're back. Say "I'm back" anytime to get it early.`,
      };
    },
  };
}

export function createEndAwayModeTool(
  preferences: UserPreferencesRepository,
): HeyRizTool<Record<string, never>> {
  return {
    name: "end_away_mode",
    category: "memory",
    description:
      'End Away/Vacation mode and get the priority list of everything Riz held while away. Call this when the principal signals they\'re back (e.g. "I\'m back", "I\'ve returned", "back from vacation", or confirms yes to a welcome-back prompt).',
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, context }) {
      const held = await preferences.getHeldAwayEmails(userId);
      await preferences.clearAway(userId);
      return {
        tool: "end_away_mode",
        status: "ok",
        message: formatAwayDigest(held, context.honorific),
        data: { count: held.length },
      };
    },
  };
}

type SetHonorificPayload = {
  honorific?: string;
};

export function createSetHonorificTool(
  preferences: UserPreferencesRepository,
): HeyRizTool<SetHonorificPayload> {
  return {
    name: "set_honorific",
    category: "memory",
    description:
      "Change how the agent addresses the principal from now on (e.g. the principal says \"call me boss\" or \"call me ma'am\").",
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload }) {
      const honorific = payload.honorific?.trim();
      if (!honorific) {
        return {
          tool: "set_honorific",
          status: "not_implemented",
          message: "I need a word to call you by.",
        };
      }

      await preferences.setHonorific(userId, honorific);

      return {
        tool: "set_honorific",
        status: "ok",
        message: `Got it, ${honorific} — that's what I'll call you from now on.`,
      };
    },
  };
}

type SetDisplayNamePayload = {
  name?: string;
};

export function createSetDisplayNameTool(
  preferences: UserPreferencesRepository,
): HeyRizTool<SetDisplayNamePayload> {
  return {
    name: "set_display_name",
    category: "memory",
    description:
      "Change the name the agent signs outbound emails with (e.g. the principal says \"sign emails as Alex\" or \"use my full name\"). Overrides the login/signup name from now on.",
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      const name = payload.name?.trim();
      if (!name) {
        return {
          tool: "set_display_name",
          status: "not_implemented",
          message: `What name should I sign your emails with, ${context.honorific}?`,
        };
      }

      await preferences.setDisplayName(userId, name);

      return {
        tool: "set_display_name",
        status: "ok",
        message: `Done, ${context.honorific} — I'll sign your emails as "${name}" from now on.`,
      };
    },
  };
}

type SetLanguagePayload = {
  language?: string;
};

export function createSetLanguageTool(
  preferences: UserPreferencesRepository,
): HeyRizTool<SetLanguagePayload> {
  return {
    name: "set_language",
    category: "memory",
    description:
      'Switch the language/style the agent replies in, from now on, to match the principal\'s own (e.g. they write in Hinglish, Hindi, Spanish, French). Pass a short label like "Hinglish", "Hindi", or "Spanish" — not an ISO code.',
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      const language = payload.language?.trim();
      if (!language) {
        return {
          tool: "set_language",
          status: "not_implemented",
          message: `Which language should I switch to, ${context.honorific}?`,
        };
      }

      await preferences.setLanguage(userId, language);

      return {
        tool: "set_language",
        status: "ok",
        message: `Saved silently — do not announce this switch. Just answer the principal's actual message now, written in ${language}.`,
      };
    },
  };
}

type SetTimezonePayload = {
  /** Canonical IANA zone name, e.g. "Asia/Kolkata" — resolve any city/abbreviation to this first. */
  timezone?: string;
};

export function createSetTimezoneTool(
  preferences: UserPreferencesRepository,
): HeyRizTool<SetTimezonePayload> {
  return {
    name: "set_timezone",
    category: "memory",
    description:
      'Set the principal\'s timezone for all time reasoning (current time, reminders, meeting scheduling). Call this when the principal mentions where they are or what time it is for them (e.g. "I\'m in India", "set my timezone to IST", "I\'m in Guatemala"). Resolve to the canonical IANA zone name yourself (e.g. "India"/"IST" -> "Asia/Kolkata", "Guatemala" -> "America/Guatemala") and pass that, not the raw phrase.',
    approvalRequired: false,
    sensitiveDataPolicy: "none",
    async execute({ userId, payload, context }) {
      const timezone = payload.timezone?.trim();
      if (!timezone) {
        return {
          tool: "set_timezone",
          status: "not_implemented",
          message: `What timezone are you in, ${context.honorific}?`,
        };
      }

      try {
        await preferences.setTimezone(userId, timezone);
      } catch {
        return {
          tool: "set_timezone",
          status: "not_implemented",
          message: `"${timezone}" isn't a timezone I recognize, ${context.honorific} — try a region name like "Asia/Kolkata".`,
        };
      }

      return {
        tool: "set_timezone",
        status: "ok",
        message: `Got it, ${context.honorific} — I'll use ${timezone} for times and reminders from now on.`,
      };
    },
  };
}
