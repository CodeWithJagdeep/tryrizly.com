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
      updated="July 18, 2026"
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
                  Telegram, Stripe, Razorpay, PostgreSQL, MongoDB, or another connector, we access
                  the data those connections authorize. For Google connections this includes your
                  Google account identity, Gmail message metadata, Gmail message content and
                  attachments you ask Rizly to process, Gmail drafts and messages Rizly prepares or
                  sends after your approval, contact names and email addresses, and Google Calendar
                  event titles, times, attendees, locations, descriptions, conferencing links, and
                  availability.
                </li>
                <li>
                  <strong>Derived and usage data</strong> — product events, notification history,
                  summaries, classifications, reminders, proposed actions, approval records, and
                  AI-usage metering, so plan limits, billing, support, and security monitoring work.
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
                <li>triaging, classifying, searching, and summarizing your Gmail messages;</li>
                <li>drafting Gmail replies and sending them only after your approval;</li>
                <li>finding contacts so drafted messages can be addressed correctly;</li>
                <li>building your morning brief, reminders, and follow-ups;</li>
                <li>reading Google Calendar events to prepare meeting context and detect conflicts;</li>
                <li>creating or updating Google Calendar events only after your approval;</li>
                <li>delivering notifications on Telegram (or email, if Telegram isn&apos;t linked);</li>
                <li>metering AI usage against your plan and processing billing;</li>
                <li>keeping the Service secure and debugging failures.</li>
              </ul>
              <p>
                <strong>We do not sell your data. We do not use your content to train AI models.</strong>{" "}
                We don&apos;t show ads, run targeted advertising, or use Google user data to
                determine creditworthiness or for lending.
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
              <p>
                Raw, aggregated, anonymized, and derived Google Workspace API data is not used to
                develop, improve, or train generalized AI or ML models. Rizly may use your data only
                to provide or improve the product features visible to you in your own account, such
                as personalized summaries, drafts, reminders, and recommendations.
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
              <p>
                The use of raw or derived user data received from Google Workspace APIs will adhere
                to the Google API Services User Data Policy, including the Limited Use requirements.
              </p>
              <ul>
                <li>
                  <strong>Google identity data:</strong> we access your basic Google profile and
                  email address to identify which account completed the OAuth flow and to label the
                  connected account in your dashboard.
                </li>
                <li>
                  <strong>Gmail data:</strong> we access message headers, senders, recipients,
                  snippets, labels, message bodies, and attachments needed for inbox triage,
                  summaries, meeting detection, draft replies, approved sending, and contact lookup.
                </li>
                <li>
                  <strong>Google Calendar data:</strong> we access event details and availability
                  to show your schedule, prepare meeting context, detect conflicts, send reminders,
                  and create or update events after your approval.
                </li>
                <li>
                  <strong>Google Contacts data:</strong> we access contact names and email
                  addresses to find the right recipient for user-requested or user-approved drafts.
                </li>
                <li>
                  Gmail and Calendar OAuth tokens are stored <strong>encrypted at rest</strong> and
                  used only server-side to make the API calls you authorized.
                </li>
                <li>
                  Google user data is used only to provide user-facing features (triage, briefs,
                  scheduling, drafts, and reminders) — never for advertising, never sold, and never
                  transferred to third parties except as necessary to provide those features with
                  your consent, for security, to comply with law, or as part of a merger or
                  acquisition after required notice or consent.
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
                <li>OAuth tokens and connector secrets are encrypted at rest with AES-256-GCM.</li>
                <li>All data moves over TLS-encrypted connections.</li>
                <li>
                  Production access is limited to infrastructure and authorized personnel who need
                  it to operate, secure, debug, or support the Service.
                </li>
                <li>
                  Processed summaries and task history are stored in our databases to power your
                  dashboard; raw email bodies are fetched live rather than parked in queues.
                </li>
                <li>
                  Humans do not review Google message or calendar content unless you ask us to
                  support a specific issue, it is necessary for security or abuse investigation, or
                  we are legally required to do so.
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
                we stop accessing that service immediately and delete its stored credentials. We may
                retain previously created summaries, reminders, task history, and approval logs so
                your dashboard and audit history continue to work unless you delete them or request
                deletion. You can permanently delete your account from Dashboard Settings. The
                deletion flow cancels active billing, disconnects integrations, removes queued
                work and active product data, and invalidates all sessions. We delete or anonymize
                personal data within 30 days, except records we must keep for legal, security,
                fraud-prevention, or accounting reasons (e.g., invoices); retained accounting
                records are detached from your account and pseudonymized.
              </p>
              <p>
                You can also request deletion or an export of your data anytime at{" "}
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
                  <strong>Connected services</strong> when you ask Rizly to take an action, such as
                  creating a Google Calendar event or sending an approved Gmail message;
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
          id: "cookies-analytics",
          title: "Cookies & Analytics",
          body: (
            <>
              <p>
                Rizly sets one essential cookie: the session that keeps you signed in. It&apos;s
                required for the product to work and carries no tracking.
              </p>
              <p>
                If you choose &ldquo;Accept all&rdquo; in the cookie banner, we additionally load
                Google Analytics (aggregate usage and traffic statistics) and Microsoft Clarity
                (interaction analytics such as heatmaps and session recordings) to understand how
                Rizly is used and improve it. Neither loads if you choose &ldquo;Reject
                all&rdquo;, and you can change your mind at any time by clearing this site&apos;s
                data in your browser, which brings the banner back.
              </p>
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
