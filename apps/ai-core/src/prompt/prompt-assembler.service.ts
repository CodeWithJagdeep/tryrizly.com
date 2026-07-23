import { Inject, Injectable } from "@nestjs/common";
import type { AgentPlan } from "../planning/agent-plan.repository";
import type {
  HeyRizRuntimeContext,
  LiveInboxEntry,
  LiveScheduleEntry,
} from "../context/context.types";
import type { HeyRizToolDefinition } from "../tools/tool.types";
import { describeNow } from "../lib/timezone";
import { AgentSkillRegistryService } from "../skills/agent-skill-registry.service";
import type { SkillSelection } from "../skills/agent-skill.types";
import { AGENT_KERNEL_PROMPT } from "./kernel.prompt";

@Injectable()
export class PromptAssemblerService {
  constructor(
    @Inject(AgentSkillRegistryService)
    private readonly skills: AgentSkillRegistryService,
  ) {}

  assemble(input: {
    context: HeyRizRuntimeContext;
    selection: SkillSelection;
    tools: HeyRizToolDefinition[];
    channel?: "web" | "telegram";
    activePlan?: AgentPlan;
  }): string {
    const { context, selection } = input;
    const selected = selection.skillIds
      .map((id) => this.skills.get(id))
      .filter((skill) => Boolean(skill));
    const allowed = new Set(selection.toolNames);
    const toolLines = input.tools
      .filter((tool) => allowed.has(tool.name))
      .map(
        (tool) =>
          `- ${tool.name}${tool.approvalRequired ? " [approval required]" : ""}: ${tool.description}`,
      )
      .join("\n");
    const unloaded = this.skills
      .list()
      .filter((skill) => !selection.skillIds.includes(skill.id) && skill.id !== "conversation")
      .map((skill) => `- ${skill.id}: ${skill.description}`)
      .join("\n");

    return [
      AGENT_KERNEL_PROMPT,
      [
        "RUNTIME PRINCIPAL",
        `Honorific: ${context.honorific}`,
        context.principalName ? `Name: ${context.principalName}` : "Name: unknown",
        `Timezone: ${context.timezone} (${context.timezoneConfirmed ? "confirmed" : "unconfirmed"})`,
        context.language ? `Saved reply language: ${context.language}` : "Saved reply language: mirror the principal",
        `Current local time: ${describeNow(new Date(), context.timezone)}`,
      ].join("\n"),
      formattingFor(input.channel),
      `ACTIVE SKILLS\n${selected
        .map((skill) => `## ${skill?.id}@${skill?.version}\n${skill?.instructions}`)
        .join("\n\n")}`,
      `ACTIVE TOOLS\n${toolLines || "- none; answer or clarify without external action"}`,
      unloaded
        ? `LOADABLE SKILLS\n${unloaded}\nRequest these only through action "load_skill".`
        : "No additional registered skills are loadable.",
      selection.contextScopes.includes("live_calendar")
        ? renderCalendar(context)
        : undefined,
      selection.contextScopes.includes("live_inbox")
        ? renderInbox(context)
        : undefined,
      selection.contextScopes.includes("memory")
        ? renderMemory(context)
        : undefined,
      selection.contextScopes.includes("connectors")
        ? renderConnectors(context)
        : undefined,
      input.activePlan
        ? renderPlan(input.activePlan)
        : "No active multi-step plan is being resumed.",
    ]
      .filter((part): part is string => Boolean(part))
      .join("\n\n");
  }
}

function formattingFor(channel?: "web" | "telegram"): string {
  return channel === "web"
    ? "REPLY FORMAT: Web Markdown is supported. Use a compact table when comparing several exact records or periods."
    : "REPLY FORMAT: Plain text. No Markdown tables, headings, pipes, or asterisks; use short lines and • bullets.";
}

function renderCalendar(context: HeyRizRuntimeContext): string {
  const live = context.live;
  let body: string;
  if (live.calendarStatus === "unavailable") {
    body = "- temporarily unavailable; this does not mean empty or disconnected";
  } else if (!live.calendarConnected) {
    body = "- not connected; do not guess";
  } else if (live.schedule.length === 0) {
    body = "- clear today";
  } else {
    body = live.schedule
      .map((event) => `- ${scheduleLine(event, context.timezone)}`)
      .join("\n");
  }
  return [
    "LIVE CALENDAR — TODAY (AUTHORITATIVE)",
    "Completed entries are historical, not upcoming:",
    body,
    `Checked at: ${live.checkedAt}`,
  ].join("\n");
}

function renderInbox(context: HeyRizRuntimeContext): string {
  const live = context.live;
  let body: string;
  if (live.inboxStatus === "unavailable") {
    body = "- temporarily unavailable; this does not mean empty or disconnected";
  } else if (!live.inboxConnected) {
    body = "- not connected; do not guess";
  } else if (live.unread.length === 0) {
    body = "- nothing unread";
  } else {
    body = live.unread.map((mail) => `- ${mailLine(mail)}`).join("\n");
  }
  return [
    "LIVE UNREAD INBOX (AUTHORITATIVE SUBJECT SNAPSHOT)",
    body,
    "Use read_email_body for message contents.",
    `Checked at: ${live.checkedAt}`,
  ].join("\n");
}

function renderMemory(context: HeyRizRuntimeContext): string {
  const rows = context.semantic.length
    ? context.semantic.map((memory) => {
        const provenance = String(memory.metadata?.provenance ?? memory.source);
        const confidence = String(memory.metadata?.confidence ?? "medium");
        return `- [${memory.createdAt}; provenance=${provenance}; confidence=${confidence}] ${memory.summary}`;
      })
    : ["- no relevant memory; this means not recalled, never proof that something does not exist"];
  return `RELEVANT FUZZY MEMORY\n${rows.join("\n")}`;
}

function renderConnectors(context: HeyRizRuntimeContext): string {
  return context.connectedDataSources.length
    ? `CONNECTED PROVIDER NAMES\n${context.connectedDataSources.join(", ")}\nAvailability and content still require live tool evidence.`
    : "CONNECTED PROVIDER NAMES\nNone listed. Use connector_status for authoritative capability state.";
}

function scheduleLine(event: LiveScheduleEntry, timezone: string): string {
  if (event.allDay) return `all-day ${event.title}`;
  const end = Date.parse(event.end ?? event.start ?? "");
  const completed = !Number.isNaN(end) && end < Date.now() ? " (completed)" : "";
  return `${localTime(event.start, timezone)} ${event.title}${completed}`.trim();
}

function localTime(iso: string | undefined, timezone: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function mailLine(mail: LiveInboxEntry): string {
  const named = mail.from.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  const address = mail.from.match(/<([^>]+)>/)?.[1] ?? mail.from;
  return `${named ?? address.split("@")[0]}: ${mail.subject}`;
}

function renderPlan(plan: AgentPlan): string {
  const rows = plan.steps
    .map(
      (step) =>
        `- ${step.id} [${step.status}] ${step.task}${step.tool ? ` (tool: ${step.tool})` : ""}${step.evidence ? ` — ${step.evidence}` : ""}`,
    )
    .join("\n");
  return [
    `ACTIVE DURABLE PLAN (${plan.id})`,
    `Goal: ${plan.goal}`,
    rows,
    "Resume only for an approval or explicit continue/resume. Tool steps require real tool evidence.",
  ].join("\n");
}
