import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ClientProxy, ClientProxyFactory, Transport } from "@nestjs/microservices";
import { Worker } from "bullmq";
import { firstValueFrom } from "rxjs";
import { createRedisConnection } from "@heyriz/shared/queue/connection";
import { queueNames } from "@heyriz/shared/queue/names";
import type { AutomationRunJobData } from "@heyriz/shared/queue/automation-runs";
import type { AutomationFlow, AutomationRunStepResult } from "@heyriz/shared/automations/types";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { captureException } from "@heyriz/shared/sentry";
import { sendSlackSurfaceMessage } from "@heyriz/shared/slack-surface";
import { sendTelegramMessage } from "@heyriz/shared/telegram";
import { enqueueAutomationRun } from "@heyriz/shared/queue/automation-runs";
import { evaluateFilter, type FilterConfig } from "@heyriz/shared/automations/types";

/** `{{field}}` substitution against the trigger payload — no nesting, no logic. */
function interpolate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = payload[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

/** Walks a parsed JSON value, `{{field}}`-interpolating string leaves only — never touches keys or shape. */
function interpolateJsonLeaves(value: unknown, payload: Record<string, unknown>): unknown {
  if (typeof value === "string") return interpolate(value, payload);
  if (Array.isArray(value)) return value.map((v) => interpolateJsonLeaves(v, payload));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, interpolateJsonLeaves(v, payload)]),
    );
  }
  return value;
}

/**
 * Consumes `automation-run` jobs enqueued by SchedulerService.pollAutomations:
 * loads the flow, walks its action steps in order, stops at the first
 * failure (fail-closed), and always persists an automation_runs row so the
 * flow-builder's "Test" tab has something real to show.
 */
@Injectable()
export class AutomationRunWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<AutomationRunJobData>;
  private readonly aiCore: ClientProxy = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: env.AI_CORE_TCP_HOST, port: env.AI_CORE_TCP_PORT },
  });

  onModuleInit() {
    this.worker = new Worker<AutomationRunJobData>(
      queueNames.automationRuns,
      async (job) => this.run(job.data),
      { connection: createRedisConnection(), concurrency: 3 },
    );

    this.worker.on("failed", (job, error) => {
      captureException(error, { job: "automation-run", jobId: job?.id });
      logger.error("automation run job failed", { jobId: job?.id, error: error.message });
    });

    logger.info("automation run worker listening", { queue: queueNames.automationRuns });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.aiCore.close();
  }

  private gatewayHeaders(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {};
    if (hasBody) headers["content-type"] = "application/json";
    if (env.AUTH_INTERNAL_SECRET) headers["x-heyriz-internal-secret"] = env.AUTH_INTERNAL_SECRET;
    return headers;
  }

  private async run(data: AutomationRunJobData) {
    const gatewayUrl = env.NEXT_PUBLIC_GATEWAY_URL;
    if (!gatewayUrl) return;

    const flowRes = await fetch(
      `${gatewayUrl}/api/automations/${encodeURIComponent(data.flowId)}?userId=${encodeURIComponent(data.userId)}`,
      { headers: this.gatewayHeaders(false) },
    );
    const flowData = (await flowRes.json().catch(() => ({}))) as { flow?: AutomationFlow };
    const flow = flowData.flow;
    if (!flow) {
      logger.warn("automation run: flow not found", { flowId: data.flowId });
      return;
    }

    // A "Delay" resume carries the same runId so the flow-builder's Test tab
    // shows one entry for the whole run, not one per delay segment.
    let runId = data.runId;
    if (!runId) {
      const runRes = await fetch(`${gatewayUrl}/api/automations/_internal/runs`, {
        method: "POST",
        headers: this.gatewayHeaders(true),
        body: JSON.stringify({ flowId: flow.id, userId: flow.userId, triggerPayload: data.triggerPayload }),
      });
      const runData = (await runRes.json().catch(() => ({}))) as { run?: { id: string } };
      runId = runData.run?.id;
    }

    const actions = flow.steps.slice(1);
    const results: AutomationRunStepResult[] = [...(data.priorResults ?? [])];
    let outcome: "success" | "failed" = "success";
    // Mutable — an "Extract with AI" step writes its output back in here so
    // later steps can {{interpolate}} it, same as any other trigger field.
    let payload: Record<string, unknown> = { ...data.triggerPayload };

    for (let i = data.resumeFromIndex ?? 0; i < actions.length; i++) {
      const step = actions[i];
      const config = step.config ?? {};

      if (step.app === "delay") {
        const delayMinutes = Number(config.delayMinutes) || 1;
        results.push({ stepId: step.id, app: step.app, status: "success" });
        await enqueueAutomationRun(
          {
            flowId: flow.id,
            userId: flow.userId,
            triggerItemId: data.triggerItemId,
            triggerPayload: payload,
            runId,
            resumeFromIndex: i + 1,
            priorResults: results,
          },
          {
            delayMs: delayMinutes * 60_000,
            jobKey: `${flow.id}:${data.triggerItemId}:resume:${i + 1}`,
          },
        ).catch((error: unknown) => {
          logger.warn("automation run: delay resume enqueue failed", {
            flowId: flow.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
        // Leave the run as "running" — the resumed job appends the rest and finishes it.
        return;
      }

      if (step.app === "filter") {
        const filterConfig: FilterConfig = {
          field: String(config.field ?? ""),
          operator: (config.operator as FilterConfig["operator"]) ?? "contains",
          value: String(config.value ?? ""),
        };
        const passed = evaluateFilter(filterConfig, payload);
        results.push({ stepId: step.id, app: step.app, status: passed ? "success" : "skipped" });
        if (!passed) {
          for (const remaining of actions.slice(i + 1)) {
            results.push({ stepId: remaining.id, app: remaining.app, status: "skipped" });
          }
          break;
        }
        continue;
      }

      if (step.app === "ai") {
        try {
          const output = await this.runAiExtract(flow.userId, config, payload);
          const outputField = String(config.outputField ?? "").trim() || "ai_output";
          payload = { ...payload, [outputField]: output };
          results.push({ stepId: step.id, app: step.app, status: "success" });
        } catch (error) {
          outcome = "failed";
          results.push({
            stepId: step.id,
            app: step.app,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
          for (const remaining of actions.slice(i + 1)) {
            results.push({ stepId: remaining.id, app: remaining.app, status: "skipped" });
          }
          break;
        }
        continue;
      }

      if (step.app === "postgres" || step.app === "mongodb") {
        try {
          const output =
            step.app === "postgres"
              ? await this.runPostgresQuery(flow.userId, config, payload)
              : await this.runMongoFind(flow.userId, config, payload);
          const outputField = String(config.outputField ?? "").trim() || "query_result";
          payload = { ...payload, [`${outputField}_count`]: output.length, [outputField]: JSON.stringify(output).slice(0, 4000) };
          results.push({ stepId: step.id, app: step.app, status: "success" });
        } catch (error) {
          outcome = "failed";
          results.push({
            stepId: step.id,
            app: step.app,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
          for (const remaining of actions.slice(i + 1)) {
            results.push({ stepId: remaining.id, app: remaining.app, status: "skipped" });
          }
          break;
        }
        continue;
      }

      try {
        await this.runAction(flow.userId, step.app, config, payload);
        results.push({ stepId: step.id, app: step.app, status: "success" });
      } catch (error) {
        outcome = "failed";
        results.push({
          stepId: step.id,
          app: step.app,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        logger.warn("automation run: step failed", {
          flowId: flow.id,
          stepId: step.id,
          app: step.app,
          error: error instanceof Error ? error.message : String(error),
        });
        for (const remaining of actions.slice(i + 1)) {
          results.push({ stepId: remaining.id, app: remaining.app, status: "skipped" });
        }
        break;
      }
    }

    if (runId) {
      await fetch(`${gatewayUrl}/api/automations/_internal/runs/${runId}/finish`, {
        method: "POST",
        headers: this.gatewayHeaders(true),
        body: JSON.stringify({ status: outcome, stepResults: results }),
      }).catch(() => undefined);
    }
  }

  /** "Extract with AI" step — budget-gated on the ai-core side; a rejection surfaces as a normal step failure. */
  private async runAiExtract(
    userId: string,
    config: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const prompt = String(config.prompt ?? "").trim();
    if (!prompt) throw new Error("ai_step_missing_prompt");
    const sourceField = String(config.sourceField ?? "").trim();
    const input = sourceField ? String(payload[sourceField] ?? "") : JSON.stringify(payload);
    const quality = config.quality === "advanced" ? "advanced" : "fast";

    const result = await firstValueFrom(
      this.aiCore.send<{ ok: boolean; error?: string; output?: string }>("automation.ai.extract", {
        userId,
        prompt,
        input,
        quality,
      }),
    );
    if (!result?.ok) throw new Error(result?.error ?? "ai_step_failed");
    return result.output ?? "";
  }

  /**
   * Trigger data is only ever bound as `$1,$2,...` query params, never
   * spliced into the SQL text — `config.query` is a fixed string the user
   * wrote in the builder; only the values in `config.paramsCsv` come from
   * the (attacker-influenceable) trigger payload.
   */
  private async runPostgresQuery(
    userId: string,
    config: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): Promise<unknown[]> {
    const query = String(config.query ?? "").trim();
    if (!query) throw new Error("postgres_step_missing_query");
    const params = String(config.paramsCsv ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => interpolate(p, payload));

    const result = await firstValueFrom(
      this.aiCore.send<{ ok: boolean; error?: string; rows?: unknown[] }>("automation.postgres.query", {
        userId,
        query,
        params,
      }),
    );
    if (!result?.ok) throw new Error(result?.error ?? "postgres_query_failed");
    return result.rows ?? [];
  }

  /**
   * `config.filter` is parsed as JSON first, then only its string leaf values
   * are `{{field}}`-interpolated — the trigger payload can never alter the
   * filter's shape (keys, operators, nesting), only fill in leaf values.
   */
  private async runMongoFind(
    userId: string,
    config: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): Promise<unknown[]> {
    const collection = String(config.collection ?? "").trim();
    if (!collection) throw new Error("mongo_step_missing_collection");
    let filter: Record<string, unknown> = {};
    const rawFilter = String(config.filter ?? "").trim();
    if (rawFilter) {
      try {
        filter = interpolateJsonLeaves(JSON.parse(rawFilter), payload) as Record<string, unknown>;
      } catch {
        throw new Error("mongo_step_invalid_filter_json");
      }
    }

    const result = await firstValueFrom(
      this.aiCore.send<{ ok: boolean; error?: string; documents?: unknown[] }>("automation.mongo.find", {
        userId,
        collection,
        filter,
        limit: Number(config.limit) || 20,
      }),
    );
    if (!result?.ok) throw new Error(result?.error ?? "mongo_find_failed");
    return result.documents ?? [];
  }

  private async runAction(
    userId: string,
    app: string,
    config: Record<string, unknown>,
    triggerPayload: Record<string, unknown>,
  ): Promise<void> {
    const gatewayUrl = env.NEXT_PUBLIC_GATEWAY_URL;
    if (!gatewayUrl) throw new Error("gateway_unreachable");

    if (app === "slack") {
      const res = await fetch(`${gatewayUrl}/api/slack/resolve?userId=${encodeURIComponent(userId)}`, {
        headers: this.gatewayHeaders(false),
      });
      const { channel, botToken } = (await res.json().catch(() => ({}))) as {
        channel?: string | null;
        botToken?: string | null;
      };
      if (!channel) throw new Error("slack_not_connected");
      const message = interpolate(String(config.message ?? ""), triggerPayload);
      const ok = await sendSlackSurfaceMessage({ channel, text: message, botToken: botToken ?? undefined });
      if (!ok) throw new Error("slack_send_failed");
      return;
    }

    if (app === "telegram") {
      const res = await fetch(`${gatewayUrl}/api/telegram/resolve?userId=${encodeURIComponent(userId)}`, {
        headers: this.gatewayHeaders(false),
      });
      const { chatId } = (await res.json().catch(() => ({}))) as { chatId?: string | null };
      if (!chatId) throw new Error("telegram_not_connected");
      const message = interpolate(String(config.message ?? ""), triggerPayload);
      const ok = await sendTelegramMessage({ chatId, text: message });
      if (!ok) throw new Error("telegram_send_failed");
      return;
    }

    if (app === "discord") {
      const content = interpolate(String(config.message ?? ""), triggerPayload);
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.discord.postMessage", {
          userId,
          content,
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "discord_send_failed");
      return;
    }

    if (app === "github") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.github.createIssue", {
          userId,
          repo: interpolate(String(config.repo ?? ""), triggerPayload),
          title: interpolate(String(config.title ?? ""), triggerPayload),
          body: interpolate(String(config.body ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "github_create_issue_failed");
      return;
    }

    if (app === "notion") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.notion.createPage", {
          userId,
          parentId: String(config.parentId ?? ""),
          parentType: config.parentType === "page_id" ? "page_id" : "database_id",
          title: interpolate(String(config.title ?? ""), triggerPayload),
          content: interpolate(String(config.content ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "notion_create_page_failed");
      return;
    }

    if (app === "stripe") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.stripe.createCustomer", {
          userId,
          email: interpolate(String(config.email ?? ""), triggerPayload),
          name: interpolate(String(config.name ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "stripe_create_customer_failed");
      return;
    }

    if (app === "google-drive") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.google.uploadFile", {
          userId,
          name: interpolate(String(config.name ?? "automation-file.txt"), triggerPayload),
          mimeType: String(config.mimeType ?? "text/plain"),
          content: interpolate(String(config.content ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "google_drive_upload_failed");
      return;
    }

    if (app === "google-sheets") {
      const values = String(config.values ?? "")
        .split(",")
        .map((v) => interpolate(v.trim(), triggerPayload));
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.google.appendRow", {
          userId,
          spreadsheetId: String(config.spreadsheetId ?? ""),
          range: String(config.range ?? "Sheet1"),
          values,
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "google_sheets_append_failed");
      return;
    }

    if (app === "google-docs") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.google.createDoc", {
          userId,
          title: interpolate(String(config.title ?? ""), triggerPayload),
          content: interpolate(String(config.content ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "google_docs_create_failed");
      return;
    }

    if (app === "google-meet") {
      const startMs = Date.parse(interpolate(String(config.start ?? ""), triggerPayload));
      if (Number.isNaN(startMs)) throw new Error("google_meet_invalid_start");
      const durationMinutes = Number(config.durationMinutes) || 30;
      const attendees = String(config.attendees ?? "")
        .split(",")
        .map((a) => interpolate(a.trim(), triggerPayload))
        .filter(Boolean);
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.google.createMeeting", {
          userId,
          summary: interpolate(String(config.summary ?? ""), triggerPayload),
          start: new Date(startMs).toISOString(),
          end: new Date(startMs + durationMinutes * 60_000).toISOString(),
          attendees,
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "google_meet_create_failed");
      return;
    }

    if (app === "jira") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.jira.createIssue", {
          userId,
          projectKey: String(config.projectKey ?? ""),
          summary: interpolate(String(config.summary ?? ""), triggerPayload),
          description: interpolate(String(config.description ?? ""), triggerPayload),
          issueType: String(config.issueType ?? "Task"),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "jira_create_issue_failed");
      return;
    }

    if (app === "pagerduty") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.pagerduty.createIncident", {
          userId,
          serviceId: String(config.serviceId ?? ""),
          title: interpolate(String(config.title ?? ""), triggerPayload),
          urgency: config.urgency === "low" ? "low" : "high",
          details: interpolate(String(config.details ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "pagerduty_create_incident_failed");
      return;
    }

    if (app === "trello") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.trello.createCard", {
          userId,
          listId: String(config.listId ?? ""),
          name: interpolate(String(config.name ?? ""), triggerPayload),
          description: interpolate(String(config.description ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "trello_create_card_failed");
      return;
    }

    if (app === "airtable") {
      let fields: Record<string, unknown> = {};
      const rawFields = String(config.fields ?? "").trim();
      if (rawFields) {
        try {
          fields = interpolateJsonLeaves(JSON.parse(rawFields), triggerPayload) as Record<string, unknown>;
        } catch {
          throw new Error("airtable_invalid_fields_json");
        }
      }
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.airtable.createRecord", {
          userId,
          baseId: String(config.baseId ?? ""),
          table: String(config.table ?? ""),
          fields,
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "airtable_create_record_failed");
      return;
    }

    if (app === "twilio") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.twilio.sendSms", {
          userId,
          to: interpolate(String(config.to ?? ""), triggerPayload),
          body: interpolate(String(config.body ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "twilio_send_sms_failed");
      return;
    }

    if (app === "calcom") {
      const startMs = Date.parse(String(config.start ?? ""));
      if (Number.isNaN(startMs)) throw new Error("calcom_invalid_start");
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string; uid?: string; meetingUrl?: string }>(
          "automation.calcom.createBooking",
          {
            userId,
            eventTypeId: Number(config.eventTypeId),
            start: new Date(startMs).toISOString(),
            attendeeName: interpolate(String(config.attendeeName ?? ""), triggerPayload),
            attendeeEmail: interpolate(String(config.attendeeEmail ?? ""), triggerPayload),
          },
        ),
      );
      if (!result?.ok) throw new Error(result?.error ?? "calcom_booking_failed");
      return;
    }

    throw new Error(`unsupported_action_app:${app}`);
  }
}
