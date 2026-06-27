# HeyRiz Product Architecture

HeyRiz is a proactive AI operator that lives in Telegram. It watches Gmail,
Calendar, database signals, and Razorpay, then surfaces what matters and asks
before taking action.

## Core Loop

```text
Watch -> Detect -> Score -> Decide -> Notify -> Wait -> Act
```

- **Watch:** Gmail webhooks, Calendar polling, database cron jobs, Razorpay checks.
- **Detect:** Classify intent such as meeting request, payment issue, follow-up, or digest item.
- **Score:** Use a lightweight model for importance with minimal context.
- **Decide:** Notify now, stay silent, or batch into a digest.
- **Notify:** Send a focused Telegram prompt.
- **Wait:** Persist state with TTL and use BullMQ for delayed transitions.
- **Act:** Draft, create, send, or schedule only after approval where required.

## Principles

- Proactive, not reactive.
- Human-in-the-loop for all irreversible actions.
- Small prompts with tools instead of memory dumps.
- Context is fetched on demand from structured memory, vector memory, or live APIs.
- BullMQ owns time: reminders, delayed actions, retries, and scheduled briefs.
- Sensitive data is fetched live and is not stored in vector memory.

## Current Service Shape

| Layer | Implementation |
| --- | --- |
| Gateway | NestJS HTTP edge on `GATEWAY_PORT` |
| AI Core | NestJS TCP microservice on `AI_CORE_TCP_HOST:AI_CORE_TCP_PORT` |
| Queue | BullMQ + Redis |
| Worker | NestJS application context with BullMQ Worker |
| External UI | Telegram Bot API, later web dashboard |

## AI Providers

HeyRiz has a provider router. Default mode is `rules`, so the app works without
an LLM key. Set `AI_PROVIDER=grok` and `XAI_API_KEY=...` to route chat decisions
through Grok using xAI's `/v1/chat/completions` API.

| Provider | Env | Status |
| --- | --- | --- |
| Rules | `AI_PROVIDER=rules` | Default deterministic router |
| Grok | `AI_PROVIDER=grok`, `XAI_API_KEY`, `GROK_MODEL` | Wired (agent loop + classifier) |
| OpenAI | `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL` | Wired (agent loop + classifier) |

## Current AI Core Contracts

Gateway routes:

| Route | Internal TCP pattern | Purpose |
| --- | --- | --- |
| `POST /api/ai/chat` | `chat.message` | User-initiated Telegram/web message |
| `POST /api/events` | `event.ingest` | Proactive events from Gmail, Calendar, DB, Razorpay, BullMQ |
| `POST /api/proactive/brief` | `proactive.brief` | Compose + enqueue today's schedule brief |
| `POST /api/proactive/sync` | `proactive.sync` | Scan calendar, schedule meeting reminders |
| `POST /api/telegram/webhook` | `chat.message` | Inbound Telegram updates + approval replies |
| `POST /api/telegram/set-webhook` | n/a | Register the Telegram webhook URL |
| `POST /api/tools/execute` | `tool.execute` | Direct tool execution for internal callers |
| `POST /api/tasks/reminders` | `reminder.schedule` | BullMQ reminder scheduling |
| `POST /api/memory` | `memory.remember` | Store non-sensitive memory summaries |
| `GET /api/connectors` | `connector.list` | List connector summaries, never secrets |
| `POST /api/connectors` | `connector.save` | Store manual connector secrets encrypted |
| `DELETE /api/connectors/:provider` | `connector.delete` | Remove connector credentials |
| `GET /api/connectors/google/start` | `connector.oauth.start` | Start Gmail/Calendar OAuth |
| `GET /api/connectors/google/callback` | `connector.oauth.complete` | Store Google OAuth tokens encrypted |

Connector secrets are encrypted with AES-256-GCM before storage. Use
`CONNECTOR_VAULT_KEY` in production. If `DATABASE_URL` is configured, encrypted
records persist in Postgres. Without `DATABASE_URL`, local dev falls back to an
in-memory store.

Current tool registry:

| Tool | Status | Approval |
| --- | --- | --- |
| `schedule_reminder` | Wired to BullMQ | No |
| `gmail_triage` | Live: fetches unread mail, classifies each via the nano classifier | No |
| `draft_email_reply` | Live: drafts via LLM, saves a real Gmail draft, returns a send payload | No |
| `send_email` | Live: sends via Gmail, gated on explicit approval | Yes |
| `calendar_briefing` | Live: reads today's real calendar, summarizes + finds next meeting | No |
| `create_calendar_event` | Live: creates a Google Calendar event, gated on approval | Yes |
| `business_snapshot` | Placeholder for Razorpay/DB read-only | No |
| `memory_recall` | Live: embeddings + time-aware, thresholded recall | No |
| `remember_fact` | Live: saves a non-sensitive text fact to vector memory | No |

All Gmail/Calendar tools go through `GoogleService`, which decrypts the stored
OAuth tokens, auto-refreshes them, and degrades to a `needs_connection` status
when Google is not linked. Nothing throws when a connector is missing.

## Agent Loop

`chat.message` runs a real multi-step agent (`AgentService`), not a single tool
call. Each step the active LLM returns one JSON action — call a tool or finish —
and the loop feeds tool observations back until it can answer in the "sir" voice.
Approval-gated tools (`send_email`, `create_calendar_event`) are never executed
inline: the agent returns a `pendingApproval` (tool + payload + preview) and the
client re-sends `chat.message` with `approve: true` and that `pendingApproval` to
run it. With no LLM key, a deterministic rule fallback keeps chat working.

The "nano" path is a separate cheap classifier (`LlmRouterService.classifyPriority`,
`LLM_CLASSIFIER_MODEL`) used for inbox triage, with keyword rules as a fallback.

## Proactive Engine

The worker process owns a cron heartbeat (`SchedulerService`) and asks ai-core to
think on each tick:

- `morning-brief` (daily at `MORNING_BRIEF_HOUR`) -> `proactive.brief` composes the
  day's schedule and enqueues it for delivery.
- `meeting-sync` (every `MEETING_SYNC_MINUTES`) -> `proactive.sync` reads the live
  calendar and, per upcoming meeting, enqueues deduped reminders: a T-30 heads-up,
  a T-5 "starts in 5 minutes", and a post-start "you haven't joined yet" nudge.

## Memory

Vector memory stores text with its embedding and a timestamp. Recall ranks by
semantic similarity (cosine over OpenAI embeddings) blended with recency, and
drops anything below `MEMORY_MIN_SCORE` — so the agent pulls only the few
memories that are actually relevant, never a full dump. It persists to Postgres
when `DATABASE_URL` is set, otherwise stays in-process, and falls back to keyword
overlap when no embeddings key is configured. The agent saves salient facts
itself via `remember_fact`; sensitive data is never stored, only fetched live.

Memory also builds itself: `AutoMemoryService` runs after every chat turn and
proactive event, and when something durable happened — an email was sent, an
event was created, a HIGH-priority item was flagged, or the principal stated a
fact — it distills one non-sensitive line (LLM-composed, or templated offline)
and stores it. Read-only turns and chit-chat are skipped, so memory stays
high-signal. This is fire-and-forget and never blocks the reply.

## Telegram (two-way)

The worker sends proactively; the gateway receives. `POST /api/telegram/webhook`
verifies the secret + owner chat, routes the text to the agent, and holds any
proposed approval-gated action in Redis (per chat, 30-min TTL, so it survives
restarts and spans gateway instances). A follow-up "yes" — or the inline
✅/❌ button — re-invokes chat with `approve: true`, so the gated action (e.g.
`send_email`) runs only on the principal's explicit confirmation. Register the
webhook once via `POST /api/telegram/set-webhook { "url": "https://.../api/telegram/webhook" }`.

## State Machine Examples

| State | User prompt | Next states |
| --- | --- | --- |
| `EMAIL_ARRIVED` | "Naman wants to meet Tuesday 3 PM. Attend?" | `USER_ATTENDING`, `USER_DECLINING` |
| `CHECK_CALENDAR` | "Tuesday 3 PM you're free. Shall I confirm?" | `CONFIRM_EVENT`, `PROPOSE_ALTERNATIVE` |
| `USER_DECLINING` | "Should I reply to Naman, or ignore?" | `DRAFT_REPLY`, `IGNORE` |
| `DRAFT_REPLY` | "Here's the draft. Send?" | `SEND_EMAIL`, `EDIT_DRAFT`, `DISCARD` |

## Approval Policy

| Action | Approval |
| --- | --- |
| Read email | Not required |
| Score importance | Not required |
| Notify user | Not required |
| Draft reply | Not required |
| Send email | Required |
| Create calendar event | Required |
| Payment/refund action | Required, and payments stay read-only by default |
| Schedule reminder | Not required |
| Query database | Not required, read-only enforced |

## Build Order

1. Foundation: Nest gateway, AI core TCP microservice, Telegram receive/send.
2. Gmail: webhook, triage, state machine, draft approval.
3. Calendar: OAuth, free/busy, event creation, BullMQ reminders.
4. Memory: PostgreSQL state, vector recall, context injection.
5. Database + Razorpay: read-only business snapshots.
6. Reliability: audit logs, retries, status page, error recovery.
