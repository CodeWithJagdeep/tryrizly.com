# HeyRiz Codebase Audit

Date: 2026-07-18

## Executive summary

HeyRiz is now a functional, approval-first agent with durable task plans, hybrid
long-term memory, cross-source update reconciliation, and guarded tool execution.
It can decompose a multi-step request, checkpoint progress, pause for approval,
resume the same plan, and distinguish new connector evidence from information it
already surfaced. It is not an unrestricted always-running agent: background
work remains scheduler/event driven and external writes remain approval gated.

## Baseline

- 442 repository files inventoried.
- NestJS services: gateway, AI core, billing, and worker.
- Next.js application: authentication, onboarding, dashboard, approvals,
  connectors, inbox, calendar, meetings, people, notifications, settings, usage,
  and billing.
- Core tools cover Gmail, Google Calendar, Cal.com, reminders, tasks, contacts,
  Postgres, MongoDB, Razorpay, Stripe, PayPal, GitHub, Notion, Slack, Discord, and
  partial M-Pesa support. A source-update tool reconciles Slack, Discord, Notion,
  Gmail, and Calendar evidence into one timestamped response.
- BullMQ provides notification, email event, outbound email, reply watch, and
  memory-spine processing.

## What works

- Password, OTP, OAuth, password reset, JWT revocation, and Telegram linking.
- Multi-step model/tool agent with durable plans, checkpoints, approval resume,
  escalation, stall detection, tool-result verification prompts, and rule fallback.
- AES-256-GCM connector secret vault.
- Verified read-only Postgres/MongoDB credentials, AST-guarded SQL, restricted
  MongoDB find/aggregation execution, bounded queries, and sensitive-field redaction.
- Email classification, reminders, meeting alerts, briefs, and weekly summaries.
- Unified Google Calendar and Cal.com availability checks, enforced immediately
  before create/reschedule writes, with deterministic free-slot alternatives.
- Razorpay signature verification, idempotency, subscriptions, trials, and budgets.
- Backend production builds, Next.js production build, TypeScript, unit tests, and
  SQL guard smoke tests pass at the audit baseline.

## Findings and remediation status

| Priority | Finding | Status |
| --- | --- | --- |
| P0 | Proactive email, budget, and watch notifications use a global Telegram chat | Fixed |
| P0 | Manual connector account updates are not scoped to their owning user/provider | Fixed and tested |
| P0 | Approval state is split between chat IDs and user IDs and can be bypassed by direct write paths | Fixed and tested |
| P0 | Recurring reminder deletion does not verify ownership | Fixed |
| P1 | Structured context contains placeholder empty collections | Partially fixed: real preferences now included |
| P1 | No durable goals, plans, checkpoints, verification, or bounded policy engine | Partially fixed: durable per-request plans and checkpoints are implemented; continuous background goals and a standalone policy engine remain |
| P1 | Memory has no provenance, confidence, retention, review, or deletion controls | Fixed: metadata, expiry, API, and Settings UI |
| P1 | Health checks do not verify dependencies | Fixed for gateway and billing; deeper AI-core repository checks remain |
| P1 | Public forms can report success while dropping submissions | Fixed |
| P1 | CI suppresses failures and uses a runtime version inconsistent with production | Fixed |
| P1 | Source lint and production dependency audit fail | Fixed |
| P1 | Meeting conflict checks differ by connector, reschedules can bypass checks, and mirrored bookings duplicate reminders | Fixed and tested |
| P1 | Postgres connectors can store write-capable credentials and SQL safety relies on regex | Fixed: save-time privilege verification, read-only transactions, and AST validation |
| P1 | MongoDB model output reaches the driver without a complete operator/stage allowlist | Fixed and adversarially tested |
| P1 | MongoDB digest counts fetch at most 50 documents and undercount larger windows | Fixed with validated `countDocuments` queries |
| P1 | Multiple source accounts can interrupt another provider's query, select an arbitrary payment account, or silently fall back after deletion | Fixed and tested |
| P1 | Raw database credential fields and provider errors can appear in agent/Telegram output | Fixed with recursive redaction and stable public errors |
| P1 | Business database smoke checks exit successfully after the first unavailable source | Fixed: providers run independently and unavailability fails unless explicitly skipped |
| P2 | Runtime schema creation replaces versioned migrations | Open |
| P2 | Polling is used where provider push/event streams should be used | Open |
| P2 | M-Pesa transaction callbacks remain incomplete | Open |
| P2 | Test coverage is insufficient for tenant isolation, approvals, queues, OAuth, and billing | Improved for agent plans, prompt injection, connector reads, account deletion, source receipts, and exactly-once writes; provider sandbox E2E coverage remains open |

## Agent architecture after remediation

### Planning and execution

- Multi-step requests produce a two-to-eight-step outcome plan rather than a prose
  checklist. Plans are stored in Postgres with an in-memory development fallback.
- Every tool call can identify the active plan step. Completed steps are
  checkpointed, approval waits are persisted, and `continue` or an approval resumes
  the active plan instead of starting over.
- Tool payloads pass a central JSON safety validator before execution. Invalid,
  forbidden, transient, and unimplemented failures are reported distinctly so the
  model can repair a call instead of inventing success.
- Approved writes carry an opaque execution ID through gateway, Telegram, AI core,
  and workers. Redis claims that ID before execution and returns a cached result on
  retry, preventing duplicate sends after queue or network retries.

### Memory and RAG

- Long-term memory uses pgvector embeddings plus PostgreSQL full-text search over
  the full tenant corpus. It no longer limits semantic candidates to the newest 500
  rows, which previously hid older relevant facts.
- Exact semantic duplicates are merged by a normalized content hash. Memory records
  include provenance, confidence, embedding model, and last-confirmed metadata.
- Only meaningful principal-authored facts and verified summaries are promoted to
  durable memory. Short acknowledgements, greetings, raw assistant replies, and
  credential-like text are excluded.
- Retrieval is bounded and relevance ranked. "Large memory" means durable indexed
  recall, not sending the entire history to the model or retaining data forever.

### Cross-source truth

- `source_updates` searches connected Slack, Discord, Notion, Gmail, and Calendar
  sources in parallel, normalizes timestamps, and reports per-source coverage gaps.
- Results are labeled `NEW`, `UPDATED`, or `ALREADY REPORTED` using content hashes
  and source keys. Receipt storage contains identifiers and hashes, not copied
  connector message bodies.
- Ambiguous requests such as "what is going on with the announcement?" are routed
  to source reconciliation first. The agent must compare timestamps, state what is
  newest, and disclose unavailable or disconnected sources.
- Connector observations are wrapped as untrusted external data. Messages and pages
  may provide evidence but cannot override policy, request secrets, approve actions,
  or issue new instructions to the agent.

## Safe autonomy target

Autonomy should be an event-driven `observe -> plan -> authorize -> execute ->
verify -> learn` loop, not unrestricted background action.

1. Centralize tenant-safe notifications and single-use approvals.
2. Add a policy engine with action risk, budgets, quiet hours, and autonomy levels.
3. Extend persisted request plans into user-configured background goals, work items,
   attempts, outcomes, and routines with explicit budgets and stop conditions.
4. Normalize Gmail, Calendar, payment, Slack, and GitHub events into one stream.
5. Verify every external action by reading the provider state after execution.
6. Learn only bounded, reviewable preferences from explicit decisions.
7. Roll out through replay and shadow mode before enabling automatic writes.

## Validation checklist

- [x] Tenant-safe notification routing
- [x] User-scoped connector updates and reminder cancellation
- [x] Central approval enforcement for exposed external-write paths
- [x] Hashed append-only action audit stream
- [x] Shared production rate limiting and honest form delivery responses
- [x] Clean source lint, typecheck, backend build, Next build, tests, audit, and SQL guard
- [x] CI fails on regressions and uses Node 22
- [x] Focused multi-tenant and approval unit tests
- [x] Durable agent-plan and approval-resume regression tests
- [x] Cross-source ordering and already-reported receipt tests
- [x] Prompt-injection boundary and exactly-once write retry tests
- [x] Cross-provider meeting conflicts, reschedule enforcement, deterministic alternatives, and mirrored reminder deduplication
- [x] Postgres read-only credential verification and parsed single-SELECT enforcement
- [x] MongoDB find/aggregate/count validation, timeouts, result bounds, schema cache, and client eviction
- [x] Database output redaction, deterministic multi-account routing, and no silent account fallback
- [x] 96 unit/regression tests, lint, TypeScript, Next production build, and all server builds
- [x] Unified npm workspace prevents duplicate Next.js request stores in production builds
- [ ] Live business-source smoke: port `5434` is another project's Postgres and
  rejects the configured credentials; no MongoDB is listening on port `27019`
- [ ] Provider integration and end-to-end tests using dedicated sandbox accounts

## Remediation implemented

- Unified Telegram, web, and proactive approval queues under tenant `userId`.
- Replaced global Telegram delivery with the per-user notification router.
- Added server-verified approval enforcement in the tool registry and disabled
  direct email write RPC surfaces.
- Added action proposal flows for dashboard email and calendar writes.
- Added atomic connector ownership updates and recurring reminder ownership checks.
- Added reviewable memory with provenance, confidence, one-year expiry, individual
  deletion, clear-all, authenticated APIs, and a Settings view.
- Added hybrid full-corpus RAG, exact semantic deduplication, meaningful-memory
  filtering, and explicit live-source freshness/unavailability states.
- Added durable request plans, plan-step checkpoints, approval resumption, central
  payload validation, and guarded untrusted connector observations.
- Added cross-source announcement/update reconciliation for Slack, Discord, Notion,
  Gmail, and Calendar with newest/updated/already-reported labels and coverage gaps.
- Added Discord bot-token reads while preserving approval-gated webhook writes.
- Added Redis-backed exactly-once claims for approved and queued external writes.
- Split calendar and inbox live-state authority and removed unsupported attendance claims.
- Added one availability engine for Google Calendar, Cal.com, and email meeting
  requests; write tools re-check immediately before execution and fail closed on
  provider errors. Free alternatives are calculated on the user's local
  half-hour grid rather than invented by the model.
- Added canonical cross-provider meeting identities so mirrored Cal.com/Google
  records appear once in briefs and share reminder job IDs.
- Replaced regex SQL filtering with parsed AST validation, structural row limits,
  safe-function enforcement, CTE-aware schema checks, and multi-schema introspection.
- Added save-time Postgres privilege checks that reject superusers, object creators,
  and table writers before credentials enter the vault. Blank credential fields on
  account edits now preserve the existing encrypted secret and remain tenant scoped.
- Added a runtime MongoDB query compiler with explicit find/aggregate/count shapes,
  operator and pipeline-stage allowlists, Extended JSON date/ObjectId hydration,
  positive limits, timeouts, schema validation, cached sampling, and bounded clients.
- Replaced capped MongoDB digest reads with exact `countDocuments` calls. Ambiguous
  multi-database digests now require one clearly labeled production/primary account
  instead of silently selecting the first account.
- Added credential-column redaction before database results enter model context or
  Telegram output, provider-first account routing, stable public error messages, and
  an independent fail-honest Postgres/MongoDB smoke harness.
- Added Redis-backed public rate limiting, fail-closed session revocation checks,
  truthful form errors, stricter input validation, and upload bounds.
- Added dependency-aware health checks, Compose readiness conditions, required
  production database secrets, bounded scheduler fanout, and billing RPC timeout.
- Upgraded patched Next/Nest dependencies and pinned patched PostCSS; production
  audits now report zero vulnerabilities.
- Corrected lint scope, made CI checks blocking, aligned CI with Node 22, and added
  tenant-isolation and approval-boundary regression tests.
- Registered the web app as an npm workspace and removed its competing lockfile so
  Next build and metadata rendering use one framework runtime locally and in Docker.

## Remaining autonomy limits

- The agent does not invent goals or run continuously without an explicit user rule,
  scheduled job, connector event, or pending-plan resume trigger. This is a safety
  boundary, not an LLM prompt limitation.
- Most sources are still polled or queried on demand. Provider webhooks should feed a
  normalized event stream before time-sensitive unattended monitoring is enabled.
- Discord reads one configured channel. Workspace-wide discovery requires explicit
  channel allowlists and per-channel permission handling.
- Source receipts mean "Rizly surfaced this evidence," not that the human read it or
  acted on it. User read/acknowledgement state should be modeled separately.
- High-impact actions need provider-side read-after-write verification and
  reconciliation jobs in addition to exactly-once execution claims.
- Runtime-created tables should move to versioned migrations before horizontally
  scaled production rollout.
- CASA completion is an external assessment and cannot be satisfied by code alone.
  The technical evidence and submission checklist are in `docs/CASA_READINESS.md`.

## Scope note

The repository contained pre-existing uncommitted connector, gateway, worker, and
web changes when remediation began. They are preserved and treated as the current
baseline.
