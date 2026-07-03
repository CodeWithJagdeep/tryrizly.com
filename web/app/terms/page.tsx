import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of Rizly — subscriptions, acceptable use, AI disclaimers, and your rights.",
  alternates: { canonical: `${SITE_URL}/terms` },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="July 3, 2026"
      intro={
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Rizly — the
          website at getrizly.com, the Rizly dashboard, the Rizly Telegram bot, and any related
          services (together, the &ldquo;Service&rdquo;). By creating an account or using the
          Service, you agree to these Terms. If you don&apos;t agree, please don&apos;t use the
          Service.
        </p>
      }
      sections={[
        {
          id: "the-service",
          title: "The Service",
          body: (
            <>
              <p>
                Rizly is a proactive AI operator. It connects to tools you explicitly authorize —
                such as Gmail, Google Calendar, Telegram, and payment or database providers — and
                monitors them to surface what needs your attention: email triage, reminders,
                morning briefs, meeting preparation, and follow-ups.
              </p>
              <p>
                <strong>Approval-first by design.</strong> Actions that affect the outside world
                (sending an email, creating a calendar event) wait for your explicit approval,
                unless you have deliberately enabled automatic behavior for a category. You are
                responsible for the actions you approve.
              </p>
            </>
          ),
        },
        {
          id: "accounts",
          title: "Accounts & Eligibility",
          body: (
            <>
              <p>
                You must be at least 18 years old and able to form a binding contract to use the
                Service. You agree to provide accurate account information and to keep it current.
              </p>
              <p>
                You are responsible for safeguarding your account credentials and for all activity
                that occurs under your account, including messages sent to the Rizly bot from your
                linked Telegram account. Notify us immediately at{" "}
                <a href="mailto:hello@getrizly.com">hello@getrizly.com</a> if you suspect
                unauthorized access.
              </p>
            </>
          ),
        },
        {
          id: "subscriptions",
          title: "Trials, Subscriptions & Billing",
          body: (
            <>
              <p>
                New accounts start with a free trial with full access to paid features. When the
                trial ends, your account moves to the Free plan with reduced functionality unless
                you subscribe.
              </p>
              <ul>
                <li>
                  <strong>Billing.</strong> Paid plans are billed in advance on a recurring basis
                  through our payment processor, Razorpay. By subscribing you authorize recurring
                  charges until you cancel.
                </li>
                <li>
                  <strong>Cancellation.</strong> You can cancel anytime from the dashboard.
                  Cancellation takes effect at the end of the current billing period; you keep
                  access until then.
                </li>
                <li>
                  <strong>Refunds.</strong> Except where required by law, payments are
                  non-refundable. If you believe you were charged in error, contact us and
                  we&apos;ll make it right.
                </li>
                <li>
                  <strong>Price changes.</strong> We may change plan pricing with at least 30
                  days&apos; notice; changes apply from your next billing cycle.
                </li>
                <li>
                  <strong>Fair use.</strong> Each plan includes a monthly AI-usage allowance. If
                  you exceed it, the Service may reduce or pause background AI features until the
                  next cycle.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "acceptable-use",
          title: "Acceptable Use",
          body: (
            <>
              <p>You agree not to use the Service to:</p>
              <ul>
                <li>violate any law, or infringe anyone&apos;s rights;</li>
                <li>send spam, phishing, or otherwise deceptive or harmful communications;</li>
                <li>
                  probe, disrupt, or gain unauthorized access to the Service or anyone else&apos;s
                  data;
                </li>
                <li>
                  resell, sublicense, or provide the Service to third parties without our written
                  consent;
                </li>
                <li>
                  reverse-engineer the Service or use it to build a directly competing product.
                </li>
              </ul>
              <p>
                We may suspend or terminate accounts that violate these rules, with notice where
                practicable.
              </p>
            </>
          ),
        },
        {
          id: "third-party",
          title: "Third-Party Services & Connectors",
          body: (
            <>
              <p>
                The Service works by connecting to third-party services you authorize (for example
                Google, Telegram, Stripe, or Razorpay). Your use of those services is governed by
                their own terms and privacy policies. You can revoke Rizly&apos;s access at any
                time from the dashboard or from the third party&apos;s own security settings.
              </p>
              <p>
                We are not responsible for the availability or behavior of third-party services,
                and an outage or change on their side may limit what Rizly can do.
              </p>
            </>
          ),
        },
        {
          id: "ai-disclaimer",
          title: "AI Outputs",
          body: (
            <>
              <p>
                Rizly uses large language models to summarize, classify, draft, and recommend.{" "}
                <strong>AI outputs can be wrong.</strong> Summaries may omit context, drafts may
                contain errors, and classifications may be inaccurate. The Service is a productivity
                aid — not a substitute for your own judgment, and not legal, financial, or
                professional advice.
              </p>
              <p>
                Always review AI-generated content before acting on it or approving an action based
                on it. You are responsible for anything sent or done with your approval.
              </p>
            </>
          ),
        },
        {
          id: "your-content",
          title: "Your Content & Our IP",
          body: (
            <>
              <p>
                <strong>Your content stays yours.</strong> You retain all rights to the emails,
                calendar data, messages, and business data the Service processes on your behalf.
                You grant us a limited license to process that content solely to operate the
                Service for you. We do not use your content to train AI models.
              </p>
              <p>
                The Service itself — including its software, design, and branding — is owned by
                Rizly and protected by intellectual-property laws. These Terms don&apos;t grant you
                any rights to it beyond the right to use the Service.
              </p>
            </>
          ),
        },
        {
          id: "privacy",
          title: "Privacy",
          body: (
            <p>
              How we collect, use, and protect your data is described in our{" "}
              <a href="/privacy">Privacy Policy</a>, which forms part of these Terms.
            </p>
          ),
        },
        {
          id: "termination",
          title: "Termination",
          body: (
            <>
              <p>
                You may stop using the Service and delete your account at any time. We may suspend
                or terminate your access if you materially breach these Terms, if required by law,
                or if we discontinue the Service (with reasonable advance notice where possible).
              </p>
              <p>
                On termination, your right to use the Service ends and we will delete or anonymize
                your data as described in the Privacy Policy.
              </p>
            </>
          ),
        },
        {
          id: "disclaimers",
          title: "Disclaimers & Limitation of Liability",
          body: (
            <>
              <p>
                The Service is provided <strong>&ldquo;as is&rdquo;</strong> and{" "}
                <strong>&ldquo;as available&rdquo;</strong>, without warranties of any kind, express
                or implied — including fitness for a particular purpose, non-infringement, and
                uninterrupted or error-free operation.
              </p>
              <p>
                To the maximum extent permitted by law, Rizly will not be liable for indirect,
                incidental, special, consequential, or punitive damages, or for lost profits, data,
                or business opportunities. Our total liability for any claim relating to the
                Service is limited to the amount you paid us in the twelve months before the event
                giving rise to the claim.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          title: "Changes to These Terms",
          body: (
            <p>
              We may update these Terms as the Service evolves. If a change is material, we will
              notify you by email or in the product at least 14 days before it takes effect.
              Continuing to use the Service after a change takes effect means you accept the
              updated Terms.
            </p>
          ),
        },
        {
          id: "governing-law",
          title: "Governing Law & Contact",
          body: (
            <>
              <p>
                These Terms are governed by the laws of India, and any dispute will be subject to
                the exclusive jurisdiction of the courts located in India, unless the law of your
                place of residence requires otherwise.
              </p>
              <p>
                Contact: <a href="mailto:hello@getrizly.com">hello@getrizly.com</a>
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
