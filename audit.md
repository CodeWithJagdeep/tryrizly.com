# HeyRiz Codebase Audit

Date: 2026-07-18

## Executive summary

HeyRiz is a functional multi-service proactive assistant, not yet a safe autonomous
agent. The backend, web application, queues, connectors, billing flows, and core
agent loop build successfully, but tenant isolation, approval enforcement,
reliability, observability, and test coverage must be strengthened before raising
its autonomy level.

## Baseline

- 442 repository files inventoried.
- NestJS services: gateway, AI core, billing, and worker.
- Next.js application: authentication, onboarding, dashboard, approvals,
  connectors, inbox, calendar, meetings, people, notifications, settings, usage,
  and billing.
- Core tools cover Gmail, Google Calendar, Cal.com, reminders, tasks, contacts,
  Postgres, MongoDB, Razorpay, Stripe, PayPal, GitHub, Notion, Slack, Discord, and
  partial M-Pesa support.
- BullMQ provides notification, email event, outbound email, reply watch, and
  memory-spine processing.

## What works

- Password, OTP, OAuth, password reset, JWT revocation, and Telegram linking.
- Multi-step model/tool agent with escalation, stall detection, and rule fallback.
- AES-256-GCM connector secret vault.
- Read-only SQL and MongoDB protections.
- Email classification, reminders, meeting alerts, briefs, and weekly summaries.
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
| P1 | No durable goals, plans, checkpoints, verification, or bounded policy engine | Open |
| P1 | Memory has no provenance, confidence, retention, review, or deletion controls | Fixed: metadata, expiry, API, and Settings UI |
| P1 | Health checks do not verify dependencies | Fixed for gateway and billing; deeper AI-core repository checks remain |
| P1 | Public forms can report success while dropping submissions | Fixed |
| P1 | CI suppresses failures and uses a runtime version inconsistent with production | Fixed |
| P1 | Source lint and production dependency audit fail | Fixed |
| P2 | Runtime schema creation replaces versioned migrations | Open |
| P2 | Polling is used where provider push/event streams should be used | Open |
| P2 | M-Pesa transaction callbacks remain incomplete | Open |
| P2 | Test coverage is insufficient for tenant isolation, approvals, queues, OAuth, and billing | Open |

## Safe autonomy target

Autonomy should be an event-driven `observe -> plan -> authorize -> execute ->
verify -> learn` loop, not unrestricted background action.

1. Centralize tenant-safe notifications and single-use approvals.
2. Add a policy engine with action risk, budgets, quiet hours, and autonomy levels.
3. Persist goals, plans, work items, observations, attempts, outcomes, and routines.
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
- [ ] Local boot smoke: blocked by invalid PostgreSQL credentials in the existing `.env`
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
- Split calendar and inbox live-state authority and removed unsupported attendance claims.
- Added Redis-backed public rate limiting, fail-closed session revocation checks,
  truthful form errors, stricter input validation, and upload bounds.
- Added dependency-aware health checks, Compose readiness conditions, required
  production database secrets, bounded scheduler fanout, and billing RPC timeout.
- Upgraded patched Next/Nest dependencies and pinned patched PostCSS; production
  audits now report zero vulnerabilities.
- Corrected lint scope, made CI checks blocking, aligned CI with Node 22, and added
  tenant-isolation and approval-boundary regression tests.

## Scope note

The repository contained pre-existing uncommitted connector, gateway, worker, and
web changes when remediation began. They are preserved and treated as the current
baseline.
