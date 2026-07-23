import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ClientProxy, ClientProxyFactory, Transport } from "@nestjs/microservices";
import { Worker } from "bullmq";
import { firstValueFrom } from "rxjs";
import { createRedisConnection } from "@heyriz/shared/queue/connection";
import { queueNames } from "@heyriz/shared/queue/names";
import type { AutomationRunJobData } from "@heyriz/shared/queue/automation-runs";
import type {
  AutomationFlow,
  AutomationRunStepResult,
  AutomationStepEvidence,
} from "@heyriz/shared/automations/types";
import {
  validateAutomationFlowForActivation,
  validateAutomationReleasePolicy,
} from "@heyriz/shared/automations/schemas";
import { env } from "@heyriz/shared/env";
import { logger } from "@heyriz/shared/logger";
import { captureException } from "@heyriz/shared/sentry";
import { sendSlackSurfaceMessage } from "@heyriz/shared/slack-surface";
import { sendTelegramMessage } from "@heyriz/shared/telegram";
import { enqueueAutomationRun } from "@heyriz/shared/queue/automation-runs";
import { evaluateFilter, type FilterConfig } from "@heyriz/shared/automations/types";
import {
  claimActionExecution,
  completeActionExecution,
  markActionExecutionUnknown,
} from "@heyriz/shared/action-execution";

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
    const flowValidation = validateAutomationFlowForActivation(flow);
    if (!flowValidation.ok) {
      throw new Error(
        `automation_flow_invalid:${flowValidation.issues
          .slice(0, 3)
          .map((issue) => `${issue.path}:${issue.message}`)
          .join("|")}`,
      );
    }
    const release = validateAutomationReleasePolicy(flow, env.AUTOMATION_RELEASE_TIER);
    if (!release.ok) {
      throw new Error(
        `automation_flow_not_released:${release.issues
          .slice(0, 3)
          .map((issue) => `${issue.stepId ?? "flow"}:${issue.message}`)
          .join("|")}`,
      );
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
    if (!runId) {
      // Never touch an external provider unless there is already a durable run
      // record to receive evidence/failure state.
      throw new Error("automation_run_record_not_created");
    }

    const actions = flow.steps.slice(1);
    if (actions.length > env.AUTOMATION_MAX_STEPS) {
      throw new Error(`automation_step_budget_exceeded:${actions.length}/${env.AUTOMATION_MAX_STEPS}`);
    }
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
        try {
          const queued = await enqueueAutomationRun(
            {
              flowId: flow.id,
              userId: flow.userId,
              triggerItemId: data.triggerItemId,
              triggerPayload: payload,
              runId,
              resumeFromIndex: i + 1,
              priorResults: [
                ...results,
                {
                  stepId: step.id,
                  app: step.app,
                  status: "success",
                  evidence: ack("bullmq", {
                    resourceId: `${flow.id}:${data.triggerItemId}:resume:${i + 1}`,
                    metadata: { delayMinutes },
                  }),
                },
              ],
            },
            {
              delayMs: delayMinutes * 60_000,
              jobKey: `${flow.id}:${data.triggerItemId}:resume:${i + 1}`,
            },
          );
          if (!queued.jobId) throw new Error("delay_resume_missing_job_id");
          // Leave the run as "running" — the resumed job appends the rest and finishes it.
          return;
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
      }

      if (step.app === "filter") {
        const filterConfig: FilterConfig = {
          field: String(config.field ?? ""),
          operator: (config.operator as FilterConfig["operator"]) ?? "contains",
          value: String(config.value ?? ""),
        };
        const passed = evaluateFilter(filterConfig, payload);
        results.push({
          stepId: step.id,
          app: step.app,
          status: passed ? "success" : "skipped",
          ...(passed
            ? { evidence: ack("filter", { metadata: { matched: true } }) }
            : {}),
        });
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
          const { output, evidence } = await this.runAiExtract(flow.userId, config, payload);
          const outputField = String(config.outputField ?? "").trim() || "ai_output";
          payload = { ...payload, [outputField]: output };
          results.push({ stepId: step.id, app: step.app, status: "success", evidence });
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
          results.push({
            stepId: step.id,
            app: step.app,
            status: "success",
            evidence: ack(step.app, {
              kind: "data_result",
              metadata: { rowCount: output.length },
            }),
          });
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
        const evidence = await this.executeExternalOnce({
          userId: flow.userId,
          runId,
          stepId: step.id,
          app: step.app,
          title: step.title,
          config,
          payload,
        });
        results.push({ stepId: step.id, app: step.app, status: "success", evidence });
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

    const finishRes = await fetch(`${gatewayUrl}/api/automations/_internal/runs/${runId}/finish`, {
      method: "POST",
      headers: this.gatewayHeaders(true),
      body: JSON.stringify({ status: outcome, stepResults: results, userId: flow.userId }),
    });
    const finishBody = (await finishRes.json().catch(() => ({}))) as { ok?: boolean };
    if (!finishRes.ok || finishBody.ok !== true) {
      throw new Error(`automation_run_finish_not_persisted:${finishRes.status}`);
    }
    if (outcome === "failed") {
      await this.notifyFailure(flow, results).catch((error: unknown) => {
        logger.warn("automation failure notification failed", {
          flowId: flow.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  /** "Extract with AI" step — budget-gated on the ai-core side; a rejection surfaces as a normal step failure. */
  private async runAiExtract(
    userId: string,
    config: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): Promise<{ output: string; evidence: AutomationStepEvidence }> {
    const prompt = String(config.prompt ?? "").trim();
    if (!prompt) throw new Error("ai_step_missing_prompt");
    const sourceField = String(config.sourceField ?? "").trim();
    const input = sourceField ? String(payload[sourceField] ?? "") : JSON.stringify(payload);
    const quality = config.quality === "advanced" ? "advanced" : "fast";
    const outputType =
      config.outputType === "json" ||
      config.outputType === "boolean" ||
      config.outputType === "number"
        ? config.outputType
        : "text";
    const contextScopes = Array.isArray(config.contextScopes)
      ? config.contextScopes.filter(
          (scope): scope is "preferences" | "memory" | "decisions" =>
            scope === "preferences" || scope === "memory" || scope === "decisions",
        )
      : [];

    const result = await firstValueFrom(
      this.aiCore.send<{
        ok: boolean;
        error?: string;
        output?: string;
        model?: string;
        contextUsed?: string[];
      }>("automation.ai.extract", {
        userId,
        prompt,
        input,
        quality,
        outputType,
        contextScopes,
      }),
    );
    if (!result?.ok) throw new Error(result?.error ?? "ai_step_failed");
    const output = result.output ?? "";
    if (!output.trim()) throw new Error("ai_step_empty_output");
    return {
      output,
      evidence: ack("riz-ai", {
        kind: "ai_result",
        metadata: {
          quality,
          outputType,
          contextScopes: (result.contextUsed ?? []).join(","),
        },
      }),
    };
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
  ): Promise<AutomationStepEvidence> {
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
      const message = requiredInterpolated("slack_message", config.message, triggerPayload);
      const ok = await sendSlackSurfaceMessage({ channel, text: message, botToken: botToken ?? undefined });
      if (!ok) throw new Error("slack_send_failed");
      return ack("slack");
    }

    if (app === "telegram") {
      const res = await fetch(`${gatewayUrl}/api/telegram/resolve?userId=${encodeURIComponent(userId)}`, {
        headers: this.gatewayHeaders(false),
      });
      const { chatId } = (await res.json().catch(() => ({}))) as { chatId?: string | null };
      if (!chatId) throw new Error("telegram_not_connected");
      const message = requiredInterpolated("telegram_message", config.message, triggerPayload);
      const ok = await sendTelegramMessage({ chatId, text: message });
      if (!ok) throw new Error("telegram_send_failed");
      return ack("telegram");
    }

    if (app === "discord") {
      const content = requiredInterpolated("discord_message", config.message, triggerPayload);
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.discord.postMessage", {
          userId,
          content,
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "discord_send_failed");
      return ack("discord");
    }

    if (app === "github") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string; number?: number; url?: string }>("automation.github.createIssue", {
          userId,
          repo: requiredInterpolated("github_repo", config.repo, triggerPayload),
          title: requiredInterpolated("github_title", config.title, triggerPayload),
          body: interpolate(String(config.body ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "github_create_issue_failed");
      return ack("github", {
        resourceId: result.number === undefined ? undefined : String(result.number),
        resourceUrl: result.url,
      });
    }

    if (app === "notion") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string; id?: string; url?: string }>("automation.notion.createPage", {
          userId,
          parentId: requiredInterpolated("notion_parent_id", config.parentId, triggerPayload),
          parentType: config.parentType === "page_id" ? "page_id" : "database_id",
          title: requiredInterpolated("notion_title", config.title, triggerPayload),
          content: interpolate(String(config.content ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "notion_create_page_failed");
      return ack("notion", { resourceId: result.id, resourceUrl: result.url });
    }

    if (app === "stripe") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string; id?: string }>("automation.stripe.createCustomer", {
          userId,
          email: requiredInterpolated("stripe_email", config.email, triggerPayload),
          name: interpolate(String(config.name ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "stripe_create_customer_failed");
      return ack("stripe", { resourceId: result.id });
    }

    if (app === "google-drive") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string; id?: string; url?: string }>("automation.google.uploadFile", {
          userId,
          name: requiredInterpolated("google_drive_file_name", config.name, triggerPayload),
          mimeType: String(config.mimeType ?? "text/plain"),
          content: requiredInterpolated("google_drive_content", config.content, triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "google_drive_upload_failed");
      return ack("google-drive", { resourceId: result.id, resourceUrl: result.url });
    }

    if (app === "google-sheets") {
      const values = String(config.values ?? "")
        .split(",")
        .map((v) => interpolate(v.trim(), triggerPayload));
      if (values.length === 0 || values.every((value) => !value.trim())) {
        throw new Error("google_sheets_values_resolved_empty");
      }
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string }>("automation.google.appendRow", {
          userId,
          spreadsheetId: requiredInterpolated("google_sheets_spreadsheet_id", config.spreadsheetId, triggerPayload),
          range: requiredInterpolated("google_sheets_range", config.range, triggerPayload),
          values,
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "google_sheets_append_failed");
      return ack("google-sheets", { metadata: { valueCount: values.length } });
    }

    if (app === "google-docs") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string; id?: string; url?: string }>("automation.google.createDoc", {
          userId,
          title: requiredInterpolated("google_docs_title", config.title, triggerPayload),
          content: interpolate(String(config.content ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "google_docs_create_failed");
      return ack("google-docs", { resourceId: result.id, resourceUrl: result.url });
    }

    if (app === "google-meet") {
      const startMs = Date.parse(requiredInterpolated("google_meet_start", config.start, triggerPayload));
      if (Number.isNaN(startMs)) throw new Error("google_meet_invalid_start");
      const durationMinutes = Number(config.durationMinutes) || 30;
      const attendees = String(config.attendees ?? "")
        .split(",")
        .map((a) => interpolate(a.trim(), triggerPayload))
        .filter(Boolean);
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string; eventId?: string; meetingUrl?: string }>("automation.google.createMeeting", {
          userId,
          summary: requiredInterpolated("google_meet_summary", config.summary, triggerPayload),
          start: new Date(startMs).toISOString(),
          end: new Date(startMs + durationMinutes * 60_000).toISOString(),
          attendees,
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "google_meet_create_failed");
      return ack("google-meet", {
        resourceId: result.eventId,
        resourceUrl: result.meetingUrl,
      });
    }

    if (app === "jira") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string; key?: string; url?: string }>("automation.jira.createIssue", {
          userId,
          projectKey: requiredInterpolated("jira_project_key", config.projectKey, triggerPayload),
          summary: requiredInterpolated("jira_summary", config.summary, triggerPayload),
          description: interpolate(String(config.description ?? ""), triggerPayload),
          issueType: String(config.issueType ?? "Task"),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "jira_create_issue_failed");
      return ack("jira", { resourceId: result.key, resourceUrl: result.url });
    }

    if (app === "pagerduty") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string; id?: string; url?: string }>("automation.pagerduty.createIncident", {
          userId,
          serviceId: requiredInterpolated("pagerduty_service_id", config.serviceId, triggerPayload),
          title: requiredInterpolated("pagerduty_title", config.title, triggerPayload),
          urgency: config.urgency === "low" ? "low" : "high",
          details: interpolate(String(config.details ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "pagerduty_create_incident_failed");
      return ack("pagerduty", { resourceId: result.id, resourceUrl: result.url });
    }

    if (app === "trello") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string; id?: string; url?: string }>("automation.trello.createCard", {
          userId,
          listId: requiredInterpolated("trello_list_id", config.listId, triggerPayload),
          name: requiredInterpolated("trello_card_name", config.name, triggerPayload),
          description: interpolate(String(config.description ?? ""), triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "trello_create_card_failed");
      return ack("trello", { resourceId: result.id, resourceUrl: result.url });
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
        this.aiCore.send<{ ok: boolean; error?: string; id?: string }>("automation.airtable.createRecord", {
          userId,
          baseId: requiredInterpolated("airtable_base_id", config.baseId, triggerPayload),
          table: requiredInterpolated("airtable_table", config.table, triggerPayload),
          fields,
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "airtable_create_record_failed");
      return ack("airtable", { resourceId: result.id });
    }

    if (app === "twilio") {
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string; sid?: string }>("automation.twilio.sendSms", {
          userId,
          to: requiredInterpolated("twilio_to", config.to, triggerPayload),
          body: requiredInterpolated("twilio_body", config.body, triggerPayload),
        }),
      );
      if (!result?.ok) throw new Error(result?.error ?? "twilio_send_sms_failed");
      return ack("twilio", { resourceId: result.sid });
    }

    if (app === "calcom") {
      const startMs = Date.parse(requiredInterpolated("calcom_start", config.start, triggerPayload));
      if (Number.isNaN(startMs)) throw new Error("calcom_invalid_start");
      const result = await firstValueFrom(
        this.aiCore.send<{ ok: boolean; error?: string; uid?: string; meetingUrl?: string }>(
          "automation.calcom.createBooking",
          {
            userId,
            eventTypeId: Number(config.eventTypeId),
            start: new Date(startMs).toISOString(),
            attendeeName: requiredInterpolated("calcom_attendee_name", config.attendeeName, triggerPayload),
            attendeeEmail: requiredInterpolated("calcom_attendee_email", config.attendeeEmail, triggerPayload),
          },
        ),
      );
      if (!result?.ok) throw new Error(result?.error ?? "calcom_booking_failed");
      return ack("calcom", {
        resourceId: result.uid,
        resourceUrl: result.meetingUrl,
      });
    }

    throw new Error(`unsupported_action_app:${app}`);
  }

  private async executeExternalOnce(input: {
    userId: string;
    runId: string;
    stepId: string;
    app: string;
    title: string;
    config: Record<string, unknown>;
    payload: Record<string, unknown>;
  }): Promise<AutomationStepEvidence> {
    const executionId = `automation:${input.runId}:${input.stepId}`;
    const tool = `automation:${input.app}:${input.title}`;
    const claimPayload = { config: input.config, triggerPayload: input.payload };
    const claim = await claimActionExecution({
      userId: input.userId,
      executionId,
      tool,
      payload: claimPayload,
    });
    if (claim.state === "completed") {
      const evidence = claim.result as AutomationStepEvidence | undefined;
      if (evidence?.acknowledged === true) return evidence;
      throw new Error("automation_cached_execution_missing_evidence");
    }
    if (claim.state !== "claimed") {
      throw new Error(
        claim.state === "in_progress"
          ? "automation_step_already_in_progress"
          : "automation_step_outcome_unknown_manual_review_required",
      );
    }
    try {
      const evidence = await this.runAction(
        input.userId,
        input.app,
        input.config,
        input.payload,
      );
      await completeActionExecution({
        userId: input.userId,
        executionId,
        tool,
        payload: claimPayload,
        result: evidence,
      });
      return evidence;
    } catch (error) {
      // The worker cannot prove whether a network/provider failure happened
      // before or after the provider accepted the write. Mark it unknown so a
      // queue retry fails closed instead of producing a duplicate side effect.
      await markActionExecutionUnknown({
        userId: input.userId,
        executionId,
        tool,
        payload: claimPayload,
        error,
      }).catch(() => undefined);
      throw error;
    }
  }

  /** Best-effort principal notification after the durable failed run is
   * persisted. Telegram is preferred; Slack is the fallback surface. */
  private async notifyFailure(
    flow: AutomationFlow,
    results: AutomationRunStepResult[],
  ): Promise<void> {
    const gatewayUrl = env.NEXT_PUBLIC_GATEWAY_URL;
    if (!gatewayUrl) return;
    const failed = results.find((result) => result.status === "failed");
    const message = [
      `Automation failed: ${flow.name}`,
      failed ? `Step: ${failed.app}` : "",
      failed?.error ? `Reason: ${failed.error.slice(0, 300)}` : "",
      `Review: ${env.WEB_APP_URL}/dashboard/automations/${encodeURIComponent(flow.id)}`,
    ].filter(Boolean).join("\n");

    const telegramRes = await fetch(
      `${gatewayUrl}/api/telegram/resolve?userId=${encodeURIComponent(flow.userId)}`,
      { headers: this.gatewayHeaders(false) },
    ).catch(() => undefined);
    const telegram = telegramRes
      ? ((await telegramRes.json().catch(() => ({}))) as { chatId?: string | null })
      : {};
    if (telegram.chatId && await sendTelegramMessage({ chatId: telegram.chatId, text: message })) {
      return;
    }

    const slackRes = await fetch(
      `${gatewayUrl}/api/slack/resolve?userId=${encodeURIComponent(flow.userId)}`,
      { headers: this.gatewayHeaders(false) },
    ).catch(() => undefined);
    const slack = slackRes
      ? ((await slackRes.json().catch(() => ({}))) as {
          channel?: string | null;
          botToken?: string | null;
        })
      : {};
    if (slack.channel) {
      await sendSlackSurfaceMessage({
        channel: slack.channel,
        text: message,
        botToken: slack.botToken ?? undefined,
      });
    }
  }
}

function requiredInterpolated(
  field: string,
  value: unknown,
  payload: Record<string, unknown>,
): string {
  const resolved = interpolate(String(value ?? ""), payload).trim();
  if (!resolved) throw new Error(`${field}_resolved_empty`);
  return resolved;
}

function ack(
  provider: string,
  input: {
    kind?: AutomationStepEvidence["kind"];
    resourceId?: string;
    resourceUrl?: string;
    metadata?: AutomationStepEvidence["metadata"];
  } = {},
): AutomationStepEvidence {
  return {
    kind: input.kind ?? "provider_ack",
    provider,
    acknowledged: true,
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
    ...(input.resourceUrl ? { resourceUrl: input.resourceUrl } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}
