# CASA Security Assessment Readiness

Last reviewed: 18 July 2026

## Status

- Application remediation: implemented and awaiting production deployment/evidence capture.
- CASA assessment: **open**. Complete the assessor workflow from the Google Trust and Safety email.
- Letter of Validation (LOV): **not yet issued**. OAuth verification is not complete until Google accepts it.

## Google OAuth Scope Inventory

| Scope | Classification | User-facing purpose | Narrower scope rationale |
| --- | --- | --- | --- |
| `openid email profile` | Identity | Identify and label the Google account being connected | Required to bind consent to the correct Rizly account |
| `gmail.readonly` | Restricted | Inbox triage, summaries, search, meeting detection, reply context | Metadata-only access cannot provide message bodies required for user-requested summaries and drafts |
| `gmail.send` | Sensitive | Send a user-approved message or reply | Rizly does not request `gmail.modify`; send-only is the narrowest write scope |
| `contacts.readonly` | Sensitive | Resolve a user-named recipient for drafts and approved sends | Read-only contact lookup; no contact modification scope is requested |
| `calendar.events` | Sensitive | Show events, detect conflicts, and create/update user-approved events | Avoids broader calendar/settings administration scopes |

Source of truth: `apps/ai-core/src/connectors/connector.service.ts`.

## Implemented Controls

- OAuth connector state is signed, expires after 10 minutes, and is bound to the user/provider.
- Connector tokens and secrets use AES-256-GCM encryption at rest and are server-side only.
- External Gmail and Calendar writes require a stored, single-action approval.
- The connector UI presents a Google-data notice before authorization and links to the Google User Data disclosure.
- Disconnecting a connector immediately deletes its stored credentials; full account deletion also revokes stored Google OAuth grants before removing the tokens.
- Account deletion requires retyping the authenticated email.
- Deletion cancels an active subscription before identity removal.
- User-owned PostgreSQL, MongoDB, Redis/BullMQ, connector, memory, and notification data is deleted.
- Retained billing records are pseudonymized and raw matching webhook payloads are redacted.
- All browser sessions fail closed after the identity record is removed.
- The public policy discloses access, use, storage, sharing, AI processing, retention, deletion, revocation, and Limited Use.

## Deletion Verification Runbook

Use a dedicated production-like test account. Never use a real customer's account.

1. Connect Gmail and Calendar, create a reminder, produce a chat summary, and start a billing trial.
2. In Dashboard Settings > Account, type the account email and choose **Permanently delete account**.
3. Confirm the browser returns to the public homepage and the old session cannot access an authenticated API.
4. Confirm the MongoDB `users`, `otp_codes`, `password_reset_tokens`, `telegram_link_tokens`, `telegram_links`, and `push_subscriptions` collections have no matching email/user ID.
5. Confirm the PostgreSQL user tables listed in `AccountDeletionService` have no matching user ID.
6. Confirm `connected_accounts` and `connector_oauth_states` contain no matching user ID.
7. Confirm BullMQ contains no waiting, delayed, completed, or failed payload for the user and no matching reminder scheduler.
8. Confirm billing customer/trial rows are removed; retained subscription/purchase rows use a `deleted:<hash>` identifier and minimal accounting metadata.
9. Confirm the Google connection is no longer used. The user may separately remove Rizly at `myaccount.google.com/permissions`.
10. Save timestamped, redacted screenshots/query counts as assessor evidence. Do not put production data or secrets in this repository.

## Evidence Package

- Public homepage, privacy policy, terms, trust center, and security policy URLs.
- OAuth consent screen recording in English showing the exact requested scopes.
- End-to-end recordings for Gmail read, Gmail approved send, contact lookup, Calendar read, and Calendar approved write.
- Screenshot of the pre-authorization Google-data disclosure.
- Encryption design and key-rotation evidence from the production secret manager.
- CI results for tests, lint, type checking, dependency scanning, and production builds.
- Network/TLS, firewall, access-control, logging, incident-response, backup-retention, and vulnerability-management evidence.
- Completed deletion run with redacted before/after record counts.
- Current data-flow diagram covering Google API -> Rizly -> contracted AI provider -> user-visible result.

## Cloud Console Checklist

- [ ] `getrizly.com` ownership verified by a project Owner/Editor in Search Console.
- [ ] Homepage is exactly `https://getrizly.com` and publicly accessible.
- [ ] Privacy URL is exactly `https://getrizly.com/privacy` everywhere.
- [ ] Terms URL is exactly `https://getrizly.com/terms` everywhere.
- [ ] Authorized domains and production redirect URIs contain no staging or obsolete entries.
- [ ] Published brand name/logo match the production app and demo video.
- [ ] Support and developer contact addresses are monitored.
- [ ] Console scopes exactly match the scope inventory above.
- [ ] Trust and Safety email instructions completed with the assigned CASA assessor.
- [ ] Assessor findings remediated and retested.
- [ ] Letter of Validation submitted to/accepted by Google.
- [ ] Annual reassessment owner and renewal reminder recorded.

## Deployment Gate

Do not describe the app as Google-verified or CASA-compliant until the LOV is issued and accepted. Do not add Google scopes without updating the privacy disclosure, demo, scope justification, data-flow inventory, and verification submission.
