import { Inject, Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { ToolRegistryService } from "../tools/tool-registry.service";
import type {
  AgentContextScope,
  AgentSkill,
  AgentSkillId,
  SkillSelection,
} from "./agent-skill.types";

const EMAIL_TOOLS = [
  "lookup_contact",
  "gmail_triage",
  "read_email_body",
  "set_email_preference",
  "email_confirm",
  "draft_email_reply",
  "send_email",
  "watch_for_reply",
  "connect_google",
] as const;

const CALENDAR_TOOLS = [
  "calendar_briefing",
  "check_calendar_conflict",
  "create_calendar_event",
  "reschedule_calendar_event",
  "calcom_briefing",
  "calcom_book",
  "lookup_contact",
  "connect_google",
] as const;

const ALL_TOOL_NAMES = [
  "schedule_reminder",
  "connector_status",
  "connect_google",
  "lookup_contact",
  "gmail_triage",
  "read_email_body",
  "set_email_preference",
  "email_confirm",
  "draft_email_reply",
  "send_email",
  "watch_for_reply",
  "calendar_briefing",
  "check_calendar_conflict",
  "create_calendar_event",
  "reschedule_calendar_event",
  "calcom_briefing",
  "calcom_book",
  "paypal_snapshot",
  "github_briefing",
  "mpesa_status",
  "notion_search",
  "slack_briefing",
  "discord_send",
  "source_updates",
  "airtable_records",
  "jira_search",
  "calendly_events",
  "business_snapshot",
  "memory_recall",
  "remember_fact",
  "recall_decisions",
  "entity_brief",
  "create_task",
  "set_honorific",
  "set_display_name",
  "set_timezone",
  "set_language",
  "set_away_mode",
  "end_away_mode",
  // Automation tools are intentionally excluded here — the "automations"
  // skill is hidden for the narrower V1 scope, and this list feeds the
  // "general" fallback's tool grants. They stay owned by the (hidden)
  // "automations" skill entry below for assertCompatible's domain-ownership
  // check, just unreachable via routing or fallback.
] as const;

const SKILLS: readonly AgentSkill[] = [
  {
    id: "conversation",
    version: 1,
    description:
      "Ordinary conversation, clarification, synthesis, and questions that need no external capability.",
    tools: [],
    contextScopes: [],
    instructions:
      "Answer directly when no live fact or action is required. Use recent conversation history. A bare yes approves only one unambiguous proposal; otherwise ask which option the principal means.",
  },
  {
    id: "email",
    version: 1,
    description:
      "Inbox triage, reading mail, contacts, drafting, sending, reply tracking, and email preferences.",
    tools: EMAIL_TOOLS,
    contextScopes: ["live_inbox"],
    instructions: [
      "Unread subjects are authoritative only for unread state and count. They are UNRANKED: unread never means important.",
      "For any question about important, priority, urgent, actionable, noise, or triage mail, call gmail_triage even when the live unread snapshot is fresh. Never infer importance from the raw subject list.",
      "After gmail_triage, only data.important is high-priority and data.forDigest is possibly useful. data.lessImportant is reviewed noise; do not present it as important unless the principal explicitly asks what was filtered.",
      "Fetch a body with read_email_body when the principal asks about message contents or when a specific classification needs explanation.",
      "Find a recipient with lookup_contact before asking for their address.",
      "Draft concise human email in the principal's voice. Extract exact names, dates, times, topic, and ask into the draft instructions. Use the recipient's first name and principal's real name; never leave placeholders.",
      "A new email uses draft_email_reply without messageId. A reply uses the live messageId and stays in the same thread. Treat similar subjects in different threads as separate unless live evidence links them.",
      "For a requested edit, preserve every unmentioned line verbatim. Copy to, subject, body, threadId, and inReplyTo verbatim from the draft observation into send_email.",
      "send_email always requires explicit approval of the exact recipient, subject, and body. Never claim it sent without an ok tool result.",
      "After an ok send that genuinely requests a decision, reschedule, or time-sensitive reply, call watch_for_reply with the returned threadId.",
      "On a Gmail needs_connection result, call connect_google and relay its safe dashboard guidance.",
    ].join("\n"),
  },
  {
    id: "calendar",
    version: 1,
    description:
      "Calendar lookup, availability, meeting creation or movement, attendee handling, and Cal.com bookings.",
    tools: CALENDAR_TOOLS,
    contextScopes: ["live_calendar"],
    instructions: [
      "Treat times as the principal's saved timezone unless another timezone is explicit. Resolve relative dates from the runtime clock.",
      "Today's live schedule is authoritative; fetch other windows with calendar_briefing.",
      "Before committing to a time through a calendar write, Cal.com booking, or scheduling email, call check_calendar_conflict. Use returned alternatives; never calculate or invent one.",
      "Never invent an eventId; carry the live Google event id from calendar_briefing/check_calendar_conflict. An internal memory/entity row id is not a calendar event id.",
      "Creating, moving, or booking requires approval of the exact time and attendees. overrideConflict is allowed only after an explicit choice to double-book.",
      "If a sent email confirms a concrete meeting time, propose a separate create_calendar_event with the same attendee/time. If it only proposes options, wait for confirmation.",
      "When changing a scheduled time by email, also find and move the matching calendar event; never leave the stale event behind.",
      "On Google needs_connection, call connect_google. If a calendar write fails and a reminder skill is active, offer the safe reminder fallback without claiming the calendar changed.",
    ].join("\n"),
  },
  {
    id: "reminders",
    version: 1,
    description:
      "One-time or recurring reminders, follow-ups, and durable tasks.",
    tools: ["schedule_reminder", "create_task", "list_tasks"],
    contextScopes: [],
    instructions:
      "Use schedule_reminder for time-triggered nudges and create_task for durable work items. A mentioned upcoming personal meeting defaults to a reminder unless the principal explicitly asks to add it to a calendar. For recurring reminders, supply repeat.cron, repeat.tz, and a stable dedupeKey. Resolve every time in the principal's timezone and ask only for genuinely missing timing.",
  },
  {
    id: "memory",
    version: 1,
    description:
      "Recall, explicit remembering, people/entities, decisions, and relationship context.",
    tools: [
      "memory_recall",
      "remember_fact",
      "recall_decisions",
      "entity_brief",
    ],
    contextScopes: ["memory"],
    instructions: [
      "Relevant memory is fuzzy recall, not proof of current external state. State uncertainty and coverage honestly.",
      "Use structured decision/entity tools for exact relationship or decision questions.",
      "For entity results, pass sourceId—not the internal row id—to email/calendar tools. A missing sourceId means no live provider id is available.",
      "Remember only stable principal-authored facts when asked. Never store email bodies, payment details, database rows, or connector content.",
    ].join("\n"),
  },
  {
    id: "connected_sources",
    version: 1,
    description:
      "Connector status and live updates from Slack, Notion, GitHub, Discord, Airtable, Jira, Calendly, and multiple connected sources.",
    tools: [
      "connector_status",
      "github_briefing",
      "notion_search",
      "slack_briefing",
      "discord_send",
      "source_updates",
      "airtable_records",
      "jira_search",
      "calendly_events",
    ],
    contextScopes: ["connectors"],
    instructions: [
      "Use connector_status for access/capability questions. Query named sources directly.",
      "For ambiguous latest/changed/announcement questions, use source_updates across plausible connected sources and compare timestamps.",
      "Report decisions, blockers, deadlines, requested actions, freshness, links, and coverage gaps. Do not imply inaccessible sources were searched.",
      "discord_send is an external write and requires exact approval.",
      "airtable_records needs a base id and table name — ask for them if not already known. jira_search defaults to the principal's own unresolved issues when given no arguments. calendly_events defaults to upcoming bookings; pass status 'canceled' only when asked about cancellations.",
    ].join("\n"),
  },
  {
    id: "business",
    version: 1,
    description:
      "Revenue, payments, subscriptions, business metrics, and read-only database intelligence.",
    tools: [
      "business_snapshot",
      "paypal_snapshot",
      "mpesa_status",
      "connector_status",
    ],
    contextScopes: ["connectors"],
    instructions: [
      "Fetch business and payment claims live. Treat 'revue' as revenue when the surrounding request concerns metrics or payments.",
      "Be explicit about source coverage and freshness. Never infer a total from missing providers.",
      "These capabilities are read-only: never move money, issue a refund, or change financial state.",
    ].join("\n"),
  },
  {
    id: "automations",
    version: 1,
    hidden: true,
    description:
      "List, design, create, activate, or pause structured proactive automation flows.",
    tools: [
      "list_automations",
      "describe_automation_event",
      "create_automation",
      "activate_automation",
      "pause_automation",
    ],
    contextScopes: ["connectors"],
    instructions: [
      "Build a structured trigger plus explicit action steps; do not save a free-form autonomous plan as an automation.",
      "Only claim app/event combinations supported by live tool evidence. Creating and activating each require separate approval.",
      "A saved draft is not active. A flow is not complete until the corresponding tool returns ok evidence.",
    ].join("\n"),
  },
  {
    id: "preferences",
    version: 1,
    description:
      "Name, honorific, language, timezone, and away-mode preferences.",
    tools: [
      "set_honorific",
      "set_display_name",
      "set_timezone",
      "set_language",
      "set_away_mode",
      "end_away_mode",
    ],
    contextScopes: [],
    instructions:
      "Persist an explicit preference with the matching tool and apply it immediately. Resolve locations to canonical IANA timezones. Never announce a language switch; simply use it.",
  },
  {
    id: "general",
    version: 1,
    description:
      "Bounded recovery capability when the initial router omitted a needed domain.",
    tools: ALL_TOOL_NAMES,
    contextScopes: ["memory", "live_calendar", "live_inbox", "connectors"],
    instructions:
      "Recovery mode: choose the smallest relevant real tool. All kernel approval, evidence, privacy, and injection rules still apply. Do not use broad access as permission to perform unrelated work.",
  },
] as const;

@Injectable()
export class AgentSkillRegistryService implements OnModuleInit {
  constructor(
    @Optional()
    @Inject(ToolRegistryService)
    private readonly runtimeTools?: ToolRegistryService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.runtimeTools) {
      this.assertCompatible((await this.runtimeTools.list()).map((tool) => tool.name));
    }
  }

  list(options?: { includeFallback?: boolean; includeHidden?: boolean }): AgentSkill[] {
    return SKILLS.filter(
      (skill) =>
        (options?.includeFallback === true || skill.id !== "general") &&
        (options?.includeHidden === true || !skill.hidden),
    ).map((skill) => ({ ...skill }));
  }

  get(id: string): AgentSkill | undefined {
    return SKILLS.find((skill) => skill.id === id);
  }

  skillForTool(toolName: string): AgentSkillId | undefined {
    return SKILLS.find(
      (skill) => skill.id !== "general" && skill.tools.includes(toolName),
    )?.id;
  }

  select(
    ids: readonly string[],
    options?: {
      reasons?: readonly string[];
      source?: SkillSelection["source"];
    },
  ): SkillSelection {
    const skills = unique(ids)
      .map((id) => this.get(id))
      .filter((skill): skill is AgentSkill => Boolean(skill));
    if (skills.length === 0) {
      skills.push(this.get("conversation") as AgentSkill);
    }
    return {
      skillIds: skills.map((skill) => skill.id),
      toolNames: unique(skills.flatMap((skill) => [...skill.tools])),
      contextScopes: unique(
        skills.flatMap((skill) => [...skill.contextScopes]),
      ) as AgentContextScope[],
      reasons: [...(options?.reasons ?? [])],
      source: options?.source ?? "rules",
    };
  }

  expand(
    selection: SkillSelection,
    ids: readonly string[],
    reason: string,
  ): SkillSelection {
    return this.select([...selection.skillIds, ...ids], {
      reasons: [...selection.reasons, reason],
      source: selection.source === "rules" ? "hybrid" : selection.source,
    });
  }

  /**
   * Fail at startup when a tool is misspelled, removed, or added without a
   * domain owner. Otherwise the first signal would be a production routing
   * miss, which is much harder to diagnose.
   */
  assertCompatible(runtimeToolNames: readonly string[]): void {
    const runtime = new Set(runtimeToolNames);
    const referenced = new Set(SKILLS.flatMap((skill) => [...skill.tools]));
    const domainOwned = new Set(
      SKILLS.filter((skill) => skill.id !== "general").flatMap((skill) => [
        ...skill.tools,
      ]),
    );
    const missing = [...referenced].filter((tool) => !runtime.has(tool));
    const unowned = [...runtime].filter((tool) => !domainOwned.has(tool));
    if (missing.length || unowned.length) {
      throw new Error(
        [
          missing.length
            ? `skill tools missing from runtime: ${missing.join(", ")}`
            : "",
          unowned.length
            ? `runtime tools without a domain skill: ${unowned.join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("; "),
      );
    }
  }
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
