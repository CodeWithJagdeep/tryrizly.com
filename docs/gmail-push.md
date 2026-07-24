# Gmail push production setup

Rizly activates Gmail push only when all four `GMAIL_PUBSUB_*` variables are
configured. Until a mailbox has a healthy watch, the existing three-minute
poller remains active. Watched mailboxes use push for low latency and an hourly
poll for reconciliation.

## Google Cloud prerequisites

Use the same Google Cloud project that owns `GOOGLE_CLIENT_ID`.

1. Create a Pub/Sub topic, for example
   `projects/PROJECT_ID/topics/gmail-inbox`.
2. Grant `gmail-api-push@system.gserviceaccount.com` the Pub/Sub Publisher role
   on that topic.
3. Create a dedicated push-auth service account, for example
   `gmail-push@PROJECT_ID.iam.gserviceaccount.com`.
4. Allow the Pub/Sub service agent to mint identity tokens for that service
   account, and allow the operator creating the subscription to act as it.
5. Create an authenticated push subscription whose endpoint is:

   `https://API_HOST/api/gmail/push?token=LONG_RANDOM_TOKEN`

   Set its OIDC audience to:

   `https://API_HOST/api/gmail/push`

The audience and service-account email must exactly match
`GMAIL_PUBSUB_AUDIENCE` and `GMAIL_PUBSUB_SERVICE_ACCOUNT`. The query token must
exactly match `GMAIL_PUBSUB_VERIFICATION_TOKEN`.

## Runtime behavior

- Completing Gmail OAuth creates the initial inbox watch immediately.
- The worker renews every Gmail watch daily; Gmail requires renewal at least
  every seven days.
- The gateway verifies both the private query token and Google-signed OIDC
  identity before accepting a notification.
- A webhook is acknowledged only after its payload reaches the durable
  `gmail-push` queue.
- History IDs advance atomically and only after all resulting email jobs are
  queued. Duplicate and out-of-order Pub/Sub deliveries are safe.
- A processed push wakes the user’s active Gmail automations immediately.
  Gmail still evaluates each automation’s exact search query, while the flow
  cursor and deterministic queue id prevent duplicate runs.
- Accounts with a healthy watch skip the normal automation polling interval.
  An hourly reconciliation poll catches notifications that Pub/Sub delayed or
  dropped; accounts without a healthy watch retain the regular polling fallback.
- Expired history cursors trigger a bounded unread-inbox reconciliation.
- Rizly never modifies Gmail `READ` or `UNREAD` labels.

Google references:

- <https://developers.google.com/workspace/gmail/api/guides/push>
- <https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch>
- <https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions>
