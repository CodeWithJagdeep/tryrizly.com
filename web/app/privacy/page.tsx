import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Rizly collects, uses, and protects your data — OAuth tokens, email content, retention, and your rights.",
  alternates: { canonical: `${SITE_URL}/privacy` },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="July 3, 2026"
      intro={
        <p>
          This policy explains what data Rizly collects, why we collect it, how it&apos;s
          protected, and the choices you have. The short version: we only access what you
          explicitly connect, we use it only to run the product for you, we never sell it, and we
          never use it to train AI models.
        </p>
      }
      sections={[
        {
          id: "data-we-collect",
          title: "Data We Collect",
          body: (
            <>
              <ul>
                <li>
                  <strong>Account data</strong> — your email address, name, and login credentials
                  (passwords are stored hashed; OAuth sign-in stores no password at all).
                </li>
                <li>
                  <strong>Connected-service data</strong> — when you link Gmail, Google Calendar,
                  Telegram, Stripe, Razorpay, PostgreSQL, or MongoDB, we access the data those
                  connections authorize: email messages and metadata, calendar events, chat
                  messages you send the bot, and business metrics.
                </li>
                <li>
                  <strong>Usage data</strong> — product events (features used, notifications sent)
                  and AI-usage metering, so plan limits and billing work.
                </li>
                <li>
                  <strong>Payment data</strong> — handled by Razorpay. We never see or store your
                  full card details; we keep only subscription status, plan, and invoice records.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "how-we-use-it",
          title: "How We Use Your Data",
          body: (
            <>
              <p>We use your data solely to operate the Service for you:</p>
              <ul>
                <li>triaging and summarizing your email;</li>
                <li>building your morning brief, reminders, and follow-ups;</li>
                <li>preparing meeting context from your calendar;</li>
                <li>delivering notifications on Telegram (or email, if Telegram isn&apos;t linked);</li>
                <li>metering AI usage against your plan and processing billing;</li>
                <li>keeping the Service secure and debugging failures.</li>
              </ul>
              <p>
                <strong>We do not sell your data. We do not use your content to train AI models.</strong>{" "}
                We don&apos;t show ads.
              </p>
            </>
          ),
        },
        {
          id: "ai-processing",
          title: "AI Processing",
          body: (
            <>
              <p>
                To summarize, classify, and draft, relevant snippets of your content (for example
                the body of an email being triaged) are sent to third-party large-language-model
                providers over encrypted connections. These requests are made under agreements
                that prohibit the provider from using your data to train their models.
              </p>
              <p>
                We route different tasks to different providers for quality and cost; no provider
                receives more than the specific content needed for the task at hand.
              </p>
            </>
          ),
        },
        {
          id: "google-user-data",
          title: "Google User Data",
          body: (
            <>
              <p>
                Rizly&apos;s use of information received from Google APIs adheres to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
              <ul>
                <li>
                  Gmail and Calendar OAuth tokens are stored <strong>encrypted</strong> and used
                  only server-side to make the API calls you authorized.
                </li>
                <li>
                  Google user data is used only to provide user-facing features (triage, briefs,
                  scheduling) — never for advertising, and never transferred to third parties
                  except as necessary to provide those features (e.g., AI processing above), for
                  security, or to comply with law.
                </li>
                <li>
                  You can revoke access at any time from the Rizly dashboard or from your{" "}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Account permissions
                  </a>
                  .
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "storage-security",
          title: "Storage & Security",
          body: (
            <>
              <ul>
                <li>OAuth tokens and secrets are encrypted at rest.</li>
                <li>All data moves over TLS-encrypted connections.</li>
                <li>
                  Production access is limited to infrastructure that needs it; sessions can be
                  revoked globally if a credential is ever compromised.
                </li>
                <li>
                  Processed summaries and task history are stored in our databases to power your
                  dashboard; raw email bodies are fetched live rather than parked in queues.
                </li>
              </ul>
              <p>
                No system is perfectly secure. If we learn of a breach affecting your data, we will
                notify you without undue delay.
              </p>
            </>
          ),
        },
        {
          id: "retention-deletion",
          title: "Retention & Deletion",
          body: (
            <>
              <p>
                We keep your data while your account is active. When you disconnect a connector,
                we stop accessing that service immediately and delete its stored credentials. When
                you delete your account, we delete or anonymize your personal data within 30 days,
                except records we must keep for legal or accounting reasons (e.g., invoices).
              </p>
              <p>
                You can request deletion or an export of your data anytime at{" "}
                <a href="mailto:hello@getrizly.com">hello@getrizly.com</a>.
              </p>
            </>
          ),
        },
        {
          id: "sharing",
          title: "When We Share Data",
          body: (
            <>
              <p>We share data only with:</p>
              <ul>
                <li>
                  <strong>Service providers</strong> that host and power Rizly (cloud
                  infrastructure, AI providers, email delivery, payments) — each bound to process
                  your data only on our instructions;
                </li>
                <li>
                  <strong>Authorities</strong>, when required by a valid legal request;
                </li>
                <li>
                  <strong>A successor</strong>, if Rizly is acquired or merged — your data remains
                  protected under this policy and you&apos;ll be notified.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "your-rights",
          title: "Your Rights",
          body: (
            <>
              <p>
                Depending on where you live, you may have the right to access, correct, export,
                restrict, or delete your personal data, and to object to certain processing. You
                can exercise most of these directly from the dashboard (disconnect connectors,
                delete data) or by emailing{" "}
                <a href="mailto:hello@getrizly.com">hello@getrizly.com</a>. We respond to every
                request within 30 days.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          title: "Changes to This Policy",
          body: (
            <p>
              We&apos;ll update this policy as the product evolves. Material changes are announced
              by email or in the product at least 14 days before they take effect, and the
              &ldquo;Last updated&rdquo; date above always reflects the current version.
            </p>
          ),
        },
      ]}
    />
  );
}
