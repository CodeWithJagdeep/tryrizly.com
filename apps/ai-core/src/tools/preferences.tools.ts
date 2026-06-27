import { UserPreferencesRepository } from "../preferences/user-preferences.repository";
import type { HeyRizTool } from "./tool.types";

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
