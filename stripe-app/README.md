# Rizly Stripe App release guide

Rizly uses Stripe Apps OAuth. Users approve read-only access in Stripe; they do
not copy an API secret into Rizly.

## What is already implemented

- Signed, expiring, single-use OAuth state for CSRF protection.
- Backend-only authorization-code exchange.
- AES-256-GCM encrypted access and refresh-token storage.
- Automatic refresh before the one-hour access token expires, including refresh-token rotation.
- One Stripe connection per Rizly user, with local credential deletion from the existing Disconnect action.
- Read-only manifest permissions matching the Stripe API resources Rizly currently queries.

## Create and upload the app

Install and authenticate the Stripe CLI, then run these commands from this
directory:

```sh
stripe login
stripe apps upload
```

If Stripe requires the app to be created through the CLI first, preserve the
generated app `id`, then copy the distribution, OAuth, redirect, permissions,
and empty UI-extension settings from `stripe-app.json` before uploading.

The production callback in the manifest is:

```text
https://api.getrizly.com/api/connectors/stripe/callback
```

After upload, open Developers > Apps > Rizly Revenue Briefs. Use External test
to obtain a test OAuth client ID and authorize link. Stripe issues separate
developer keys for test/sandbox and live OAuth links.

## Configure Rizly

Set these only on the gateway/ai-core backend environment:

```text
STRIPE_APP_CLIENT_ID=<client ID from Stripe Apps>
STRIPE_APP_SECRET_KEY=<matching app developer test or live secret key>
STRIPE_APP_AUTHORIZE_URL=https://marketplace.stripe.com/oauth/v2/authorize
STRIPE_APP_REDIRECT_URI=https://api.getrizly.com/api/connectors/stripe/callback
```

Do not put `STRIPE_APP_SECRET_KEY` in `web/next.config.ts` or a
`NEXT_PUBLIC_*` variable. Restart the backend after setting the values.

For local callback testing, add `http://localhost:4000/api/connectors/stripe/callback`
as an allowed redirect only in a development manifest/version and set the local
backend `STRIPE_APP_REDIRECT_URI` to the same exact value. Never submit a
localhost callback for Marketplace review.

## External test checklist

1. Open `/onboarding`, go to Connect your tools, and select Stripe.
2. Confirm the button opens Stripe's install/authorization screen.
3. Install with a Stripe sandbox account that contains sample customers,
   subscriptions, invoices, payment intents, charges, and balance transactions.
4. Confirm Stripe returns to Rizly and the connector reads Connected.
5. Query each supported report, wait beyond an access-token lifetime (or force
   `expiresAt` near expiry), and confirm automatic refresh still returns data.
6. Disconnect in Rizly and confirm the encrypted credentials are deleted.
7. Uninstall Rizly Revenue Briefs in Stripe to revoke the Stripe-side grant.

## Marketplace submission

Use the public OAuth install link from the app Settings tab, not the External
test link. The listing should use:

- Name: Rizly Revenue Briefs
- Website: https://getrizly.com
- Install/onboarding URL: https://getrizly.com/onboarding
- Privacy: https://getrizly.com/privacy
- Terms: https://getrizly.com/terms
- Support: hello@getrizly.com
- Capability: data integration (no Stripe Dashboard UI)

Provide Stripe reviewers with a Rizly test account that does not require 2FA,
a sandbox containing representative billing data, exact onboarding steps, and
a short screen recording of connection, a revenue query, and disconnection.
Stripe's publishing guide currently asks developers to allow about four
business days for approval or feedback; requested changes require resubmission.
