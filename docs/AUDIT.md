# HeyRiz Codebase Audit

Date: 2026-07-11

## Executive Summary

- The core architecture is coherent: Next web -> Nest gateway -> Nest TCP ai-core/billing, with Redis/BullMQ workers for scheduled and durable background work.
- The largest security issue was hardcoded production secrets in `web/next.config.ts`; I removed those fallbacks, but the exposed values must be rotated because they were already in source and git history.
- Approval-first is not globally enforced. The agent gate works for most Telegram paths, but web/API/internal paths can still execute writes with `approved: true`; I blocked direct web email send/schedule routes, but calendar/tool-execute paths still need a central write guard.
- Connector secrets are encrypted with AES-256-GCM when persisted, but app data, memory summaries, notification bodies, billing webhooks, and Mongo auth records are not encrypted at the application layer.
- Production readiness is mid-stage: real queues/retries/Sentry hooks exist, but CI currently masks failures, tests are sparse, and several god-files should be split before the system grows.

## Phase 1 - Codebase Map

| Area | Files / modules | Role | Boundary / communication |
| --- | --- | --- | --- |
| Web app | `web/app/**`, `web/lib/api.ts` | Marketing site, dashboard, auth proxy, connector UI, approval UI | Calls gateway over HTTP using `AUTH_INTERNAL_SECRET` from server routes. |
| Gateway | `apps/gateway/src/**` | Public HTTP edge for Telegram, web proxy APIs, auth, approvals, billing proxy | HTTP in; Nest TCP client to `ai-core` and `billing`; Telegram webhook/long polling. |
| AI core | `apps/ai-core/src/**` | Agent loop, tools, connector clients, context, memory, spine | Nest TCP message patterns; direct external API calls; Postgres/Mongo app persistence. |
| Worker | `apps/worker/src/**` | BullMQ consumers, scheduler, notifications, outbound email, spine ingest | Redis queues; TCP to ai-core; HTTP to gateway for notification/admin/billing tasks. |
| Billing | `apps/billing/src/**` | Plans, trials, Razorpay checkout/webhook, billing sweep | Nest TCP message patterns from gateway; Postgres persistence. |
| Shared | `shared/src/**` | Env, logger, Sentry, email/Telegram helpers, queue definitions | Imported by all services; Redis/BullMQ helpers. |
| Spine | `apps/ai-core/src/spine/**` | Entity/event/decision graph for people, email, meetings, decisions | Writes to Postgres when `DATABASE_URL` exists; email ingest via BullMQ. |
| Model routing | `apps/ai-core/src/llm/**` | OpenAI, Anthropic, Grok, pricing/usage ledger, router | Direct provider HTTP/SDK calls; spend recorded in Postgres or memory fallback. |
| Billing/credits | `apps/billing/src/**`, `apps/ai-core/src/billing/**`, `shared/src/billing/**` | Plan budgets, trials, subscriptions, AI credit enforcement | Billing owns commerce; ai-core gates AI usage against plan budget. |

### Queues and Scheduled Work

| Queue / scheduler | Producer | Consumer | Payload sensitivity | Notes |
| --- | --- | --- | --- | --- |
| `email-events` | Worker email poll / Gmail event path | `EmailEventWorkerService` -> `email.process` | Message id, sender, subject, snippet | Subject/snippet are persisted in Redis until processed. |
| `spine` | `EmailPipelineService` | `SpineWorkerService` -> `spine.ingestEmail` | Message id, headers, metadata; body fetched live | Retries and dead-letter logging exist. |
| `notifications` | Reminders, billing, proactive engine | `NotificationWorkerService` | Notification message text | Messages may contain PII and are logged/stored in notification log. |
| `outbound-email` | `email.scheduleOutbound` / direct API | `OutboundEmailWorkerService` | Full outbound body and recipient | Worker calls `send_email` with `approved:true`; job creation must be approval-gated. |
| `watch-replies` | Email confirm/watch tools | `WatchReplyWorkerService` | Thread id, fallback text | Polls Gmail thread count. |
| `scheduler` | Worker scheduler setup | `SchedulerService` | User ids, job names | Polls inbox, meeting sync, briefs, billing sweep. |

### Dependency and Artifact Findings

| Finding | Evidence | Risk | Recommended action |
| --- | --- | --- | --- |
| `npm audit` reports high/moderate CVEs | Root audit: `@nestjs/platform-express` -> `multer` high DoS (`GHSA-72gw-mp4g-v24j`) and moderate cleanup issue (`GHSA-3p4h-7m6x-2hcm`); `next` -> `postcss` moderate XSS (`GHSA-qx2v-qp2m-jg93`). Web audit repeats `next`/`postcss`. | Availability and XSS risk depending exposed upload/CSS stringify paths. | Upgrade to `@nestjs/platform-express@11.1.28` and `next@16.2.10` or a fixed Next/PostCSS chain after reading bundled Next docs. |
| Several packages are one patch behind | `npm outdated`: Nest 11.1.27 -> 11.1.28, Next 16.2.9 -> 16.2.10, MongoDB 7.3.0 -> 7.5.0, BullMQ 5.79.0 -> 5.80.1, Sentry 10.63.0 -> 10.65.0, Anthropic SDK 0.105.0 -> 0.111.0. | Patch releases likely contain bug/security fixes. | Batch patch upgrades with build/test verification. Do not jump TypeScript 5 -> 7 or ESLint 9 -> 10 without a migration PR. |
| Generated/vendor artifacts are tracked | `git ls-files` shows `apps/*/node_modules/globals/*`; `dist` files are present in working tree. | Repo noise, stale generated output, review confusion. | Remove tracked `node_modules` artifacts from git; keep build outputs ignored. |
| God-files | `agent.service.ts` 898 lines, `connector.service.ts` 940, `ai-core.service.ts` 961, `billing.service.ts` 844, web dashboard clients over 1,000 lines. | Hard to test approval/security invariants and reason about side effects. | Split by domain: approval executor, OAuth provider adapters, controller facades, UI panels. |
| Python audit not applicable | No `requirements.txt`, `pyproject.toml`, or Pipfile found outside dependencies. | None. | No `pip-audit` run. |

## Phase 2 - Connector Audit

| Connector | Auth flow | Data flow into spine / product | Failure handling | Least privilege | Approval-first status |
| --- | --- | --- | --- | --- | --- |
| Gmail | OAuth scopes: `openid email profile`, `gmail.readonly`, `gmail.send`, `contacts.readonly`. Tokens encrypted through `ConnectorVaultService` into `connected_accounts`; refresh on expiry/401. | Worker polls unread recent Gmail every `EMAIL_POLL_MINUTES`; `email.process` classifies, stores summaries, enqueues `spine.ingestEmail`; full body fetched live for classification/decision mining. | Google API failures throw and queue jobs retry; missing connection returns `needs_connection`; spine enqueue failure logs warning and does not block email flow. | Narrowed for verification: `gmail.readonly` supports inbox context, `gmail.send` supports approval-gated sends, and `contacts.readonly` supports contact lookup. Real Gmail draft persistence is best-effort only and does not require `gmail.modify`. | Agent `send_email` requires approval, but direct web routes previously bypassed. Fixed: `web/app/api/emails/send/route.ts` now returns 403. Remaining risk: internal `email.sendReply`, `tool.execute`, and outbound queue can still send with `approved:true`. |
| Google Calendar | OAuth scopes: `openid email profile`, `https://www.googleapis.com/auth/calendar.events`. Tokens encrypted and refreshed like Gmail. | Live calendar in prompt context, `calendar_briefing`, proactive meeting reminders, meeting events recorded into spine in `ProactiveService`. | Live context has 3s timeout and degrades; proactive sync logs warnings; tool calls throw into `not_implemented` via agent wrapper. | Scope is narrowed to event read/write because the product lists, creates, and updates calendar events but does not manage calendars or settings. | Tool gate exists, but bypasses remain: `AgentService` allows calendar write after approved `send_email`; `web/app/api/meetings/route.ts` calls `create_calendar_event` with `approved:true`; generic `tool.execute` can do the same. |
| Cal.com | OAuth scopes: `BOOKING_READ`, `BOOKING_WRITE`, `EVENT_TYPE_READ`, `PROFILE_READ`; supports env/custom clients, PKCE, encrypted custom client secret in OAuth state, refresh handling. Manual API key also supported. | `calcom_briefing` reads bookings; proactive sync records Cal.com meetings into spine and schedules reminders. | `getCalComSecret` returns null on missing/failed refresh; booking errors are caught and returned to user. | `BOOKING_WRITE` is necessary only for `calcom_book`; if most users only read bookings, split read-only vs write connection. | `calcom_book` is approval-required in the agent. Generic `tool.execute` can still pass `approved:true`, so central enforcement is incomplete. |
| Postgres | Manual connection URL encrypted in vault. No OAuth. | `business_snapshot` introspects schema, LLM selects SQL, runs read-only query. Not currently normalized into spine by default. | Query rejects unsafe SQL, uses statement timeout, returns `not_implemented` on tool error. | Strong: `BEGIN READ ONLY`, SQL guard, schema validation, row limit. | Read-only; no write action exposed. |
| MongoDB | Manual connection URL encrypted in vault. On save, code verifies read-only privileges or provisions a read-only user from admin creds without persisting admin URL. | `business_snapshot` samples schema and runs `find()` only. Not currently normalized into spine by default. | Unsafe filters reject `$where`/`$function`; query limits to 50 docs. | Stronger than typical: read-only role verification/provisioning. | Read-only; no write action exposed after connector save. Connector save can create a read-only DB user once using supplied admin creds. |
| Razorpay revenue connector | Manual per-user `keyId/keySecret` encrypted; separate platform billing Razorpay env keys also exist. | `business_snapshot` reads payments/orders/settlements/refunds. Billing service handles platform checkout/webhooks. | API errors throw; business tool catches and reports. Billing webhooks are signature-verified and deduped. | Revenue connector is read-only by enum endpoints; actual key privileges depend on Razorpay key. Platform billing keys are write-capable by design. | Revenue connector read-only. Billing writes are not user approval-gated because they are commerce workflows. |
| Stripe | Manual secret key encrypted. | `business_snapshot` reads charges, payment intents, customers, subscriptions, invoices, balance transactions. | API errors throw and are caught by business tool. | Code limits to read endpoints, but a full Stripe secret key may still be broader than needed. Recommend restricted read-only keys. | Read-only; no write action exposed. |
| PayPal | Manual REST app credentials encrypted. Access token fetched with client credentials per request. | PayPal balance/transactions service exists; registry exposes `paypal_snapshot` via tool registry. | 401/403 are surfaced distinctly. | Reporting endpoints only. Requires PayPal reporting product. | Read-only. |
| GitHub | Manual PAT encrypted. | `github_briefing` tool exists; not a spine source by default. | Service-specific errors are surfaced. | Depends on PAT scopes supplied by user; no scope validation found. | Read-only as implemented. |
| M-Pesa | Manual Daraja credentials encrypted. | `mpesa_status` tool exists. | Service-specific errors surfaced. | Depends on supplied credentials/environment. | Read-only/status path found. |
| Slack / Notion / custom API | Types/services exist but no deep workflow found in this pass. | Not a primary product path today. | Incomplete. | Unknown. | Treat as unverified before enabling writes. |
| Telegram | Link token from dashboard, `telegram_links` in Mongo. Telegram bot token from env. | Chat history and approval queue live in Redis; proactive notifications delivered to resolved chat id. | Webhook verifies Telegram secret in production; owner check fails closed on DB error. | One chat per user and one user per chat enforced. | Approval UI path is strong for Telegram yes/no buttons, but it only protects actions routed through the queue. |

## Phase 3 - Security Pass

| Area | Finding | Severity | Evidence / notes | Fix status |
| --- | --- | --- | --- | --- |
| Secrets in source | Production `AUTH_INTERNAL_SECRET`, `AUTH_JWT_SECRET`, `RESEND_API_KEY`, and `TELEGRAM_BOT_TOKEN` were hardcoded in `web/next.config.ts`. | Critical | Removed in this audit. Because they were committed, rotate them immediately and invalidate sessions/tokens. | Fixed in code; rotation still required. |
| Local secret files | `.env`, `.env.local`, `.env.production`, and Google `client_secret*.json` exist in working tree but are not tracked; path-specific history did not show them committed. | High | `.gitignore` covers `.env*` and `client_secret*.json`. | No code change; keep out of git. |
| Historical secret scan | Broad git history regex found commits touching secret variable names; it does not prove leaked values except the hardcoded `next.config.ts` values above. | High | `git log -G` returned commits involving auth/env config. | Rotate exposed values. For full assurance, run a dedicated scanner such as Gitleaks/TruffleHog. |
| Token storage | Connector payloads are AES-256-GCM encrypted with `CONNECTOR_VAULT_KEY`; production fails without it. | Good | `ConnectorVaultService`. | Keep. Add key rotation plan/versioning. |
| App data encryption | Email summaries, memory rows, notification logs, billing webhook payloads, Mongo auth records are not application-encrypted. | Medium | Postgres/Mongo only rely on DB/storage-layer security. | Add DB disk encryption requirement and/or app-level encryption for sensitive columns. |
| Approval bypass | Write tools can be invoked with `approved:true` through internal APIs; web meetings route does this for calendar. | Critical | `tool.execute`, `email.sendReply`, `web/app/api/meetings/route.ts`, outbound email worker. | Email web send/schedule blocked. Calendar/tool-execute still need central guard. |
| Telegram rate limiting | Auth endpoints have throttling, but Telegram webhook/long polling message handling is not rate-limited per linked chat beyond owner check. | Medium | `ThrottlerModule` is configured but not globally applied; auth controller uses guards. | Add per-chat command throttling or global guard for gateway routes. |
| Multi-tenant isolation | Most repositories filter by `userId`; Telegram links enforce one-to-one mapping. Internal web routes trust session-derived `userId`, but gateway internal routes trust caller-supplied `userId`. | Medium | Internal secret is the boundary. | Keep internal secret private; add server-side user ownership checks for direct resource routes. |
| Logging hygiene | Email subjects were logged in the email worker; contact/career/newsletter route fallbacks logged PII. | Medium | Removed in this audit. Other logs still include recipient emails and notification messages. | Partially fixed; add redaction helper and log policy. |
| Session revocation | Token version check fails open on gateway error. | Medium | `currentTokenVersion` returns null on error. | Consider fail-closed for sensitive routes or short auth TTL plus refresh. |

## Phase 4 - Production Readiness Scores

| Area | Score | Gap to 5 |
| --- | ---: | --- |
| Test coverage | 2/5 | Only three test files found. Missing integration tests for connector OAuth refresh, approval gate, direct write denial, queue retries, billing webhooks, and multi-tenant access. |
| Error handling and observability | 3/5 | Sentry hooks and structured-ish JSON logger exist; queues retry and dead-letter spine. Gaps: no centralized metrics/alerts for connector failure rate, approval bypass attempts, notification delivery, or stuck queues. |
| Config management | 2/5 | `env` schema exists and production fails on some secrets, but hardcoded secrets existed in web config and docs still refer to `.env.example` that is not present. Need per-env config contract and secret manager. |
| CI/CD | 1/5 | Workflows exist, but typecheck/lint/smoke/audit use `|| true` or truncate output. Deploy workflow comments on `context.issue.number` on push, which may be undefined. Not a merge gate. |
| Documentation | 3/5 | Product architecture docs are useful, but README has stale file paths and no current connector onboarding/security runbook. No architecture diagram. |
| Graceful degradation / fail closed | 3/5 | Missing connectors degrade to `needs_connection`; live context timeouts work; budget failure defaults open; notification preference check fails open; approval enforcement is not centralized. |

## Phase 5 - New Capabilities Using Existing Connectors

Ranked by impact / effort for founder retention and daily/weekly Telegram usage.

| Rank | Capability | Combines | Approval-gated action | Size |
| ---: | --- | --- | --- | --- |
| 1 | Daily founder brief with revenue deltas tied to today's meetings | Calendar + Stripe/Razorpay/Postgres + Gmail | Draft pre-read or follow-up email to relevant attendee | M |
| 2 | Investor/customer meeting prep packet | Calendar attendee/company + Gmail thread history + revenue metrics | Send prep email to self/team or draft attendee follow-up | M |
| 3 | Revenue anomaly explainer | Stripe/Razorpay/Postgres + Gmail support/account emails | Draft customer/vendor follow-up or create investigation task | M |
| 4 | "Who needs a reply before EOD?" | Gmail + Calendar availability + spine decisions | Draft replies and propose send times | M |
| 5 | Payment-risk morning nudge | Razorpay/Stripe failed payments + Gmail account alerts + Calendar availability | Draft payment recovery/customer note | M |
| 6 | Weekly relationship intelligence | Gmail + Calendar + spine entities/decisions | Create follow-up tasks or draft reactivation emails | L |
| 7 | Meeting-to-cash attribution | Calendar meetings + revenue connector + spine entity graph | Suggest follow-up with a high-value contact | L |
| 8 | Founder focus block protector | Calendar + Gmail urgency classifier + revenue anomaly status | Create calendar focus block after approval | S |
| 9 | Board/investor update builder | Revenue source + Gmail investor threads + decisions | Draft update email; never send without approval | L |
| 10 | "Did we promise this?" checker | Gmail + Calendar + spine decisions | Create reminder/task or draft clarification email | M |

## Inline Fixes Applied

| Fix | Files |
| --- | --- |
| Removed hardcoded secret fallbacks and secret env passthroughs from Next config. | `web/next.config.ts` |
| Disabled direct authenticated web email send/schedule routes; they now return `403 approval_required`. | `web/app/api/emails/send/route.ts`, `web/app/api/emails/schedule/route.ts` |
| Removed plaintext fallback logs for contact messages, career applications/cover notes, newsletter emails, and email subjects. | `web/app/api/contact/route.ts`, `web/app/api/careers/apply/route.ts`, `web/app/api/newsletter/route.ts`, `apps/worker/src/email-event.worker.service.ts` |

## Top 5 Fixes I Would Do First

| Priority | Fix | Why |
| ---: | --- | --- |
| 1 | Rotate exposed secrets and purge/rewrite history if this repo will ever be shared. | The hardcoded web config values are compromised by definition. This is the highest-risk item. |
| 2 | Build a central write-action executor that refuses `send_email`, calendar writes, Cal.com booking, and any future write unless it consumes a signed, stored approval id. | Tool-level `approved:true` is too easy to bypass; security invariants should live below the agent/web layers. |
| 3 | Replace CI soft-fail steps with real gates: `npm ci`, lint, typecheck, tests, build, `npm audit --audit-level=moderate`. | Current CI can go green while typecheck/lint/audit/smokes fail. |
| 4 | Upgrade vulnerable packages, starting with Nest platform-express/multer and Next/PostCSS. | Known CVEs are present in the audit output. |
| 5 | Add focused tests for approval gate, OAuth refresh/revocation, multi-tenant access, and queue retry/dead-letter behavior. | These are the product's trust boundaries and should be hard to regress. |

## Implementation Offer

I can implement the top fixes next. The safest order is: rotate/remove exposed secret dependencies from deploy config, add the central approval executor, then turn CI into a real gate and upgrade the vulnerable packages in a separate PR.
