import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getrizly.com";

export const metadata: Metadata = {
  title: "Security Policy",
  description:
    "Rizly's security policy and responsible disclosure program — how to report a vulnerability, what's in scope, and what to expect from us.",
  alternates: { canonical: `${SITE_URL}/security-policy` },
  openGraph: {
    title: "Security Policy",
    description: "Rizly's security policy and responsible disclosure program.",
    url: `${SITE_URL}/security-policy`,
    type: "website",
  },
};

export default function SecurityPolicyPage() {
  return (
    <LegalPage
      eyebrow="Security"
      title="Security Policy & Responsible Disclosure"
      updated="July 3, 2026"
      intro={
        <p>
          Rizly connects to inboxes, calendars, and payment data — security isn&apos;t optional
          for us. If you&apos;ve found a vulnerability, we genuinely want to hear about it, and
          we&apos;ll work with you to fix it fast. This page explains how to report, what&apos;s
          in scope, and what you can expect from us in return.
        </p>
      }
      sections={[
        {
          id: "reporting",
          title: "Report a Vulnerability",
          body: (
            <>
              <p>
                Email <a href="mailto:security@getrizly.com">security@getrizly.com</a> with the
                details. Please keep the report confidential until we&apos;ve confirmed and shipped
                a fix — coordinated disclosure protects the users whose data is at stake.
              </p>
              <p>
                If the issue involves account data, include only the minimum needed to demonstrate
                it. Never access, modify, or retain another user&apos;s data.
              </p>
            </>
          ),
        },
        {
          id: "scope",
          title: "Scope",
          body: (
            <>
              <p>The following are in scope for this program:</p>
              <ul>
                <li>
                  <strong>getrizly.com</strong> — the marketing site and web dashboard;
                </li>
                <li>
                  <strong>Rizly APIs</strong> — the gateway and service endpoints backing the
                  dashboard;
                </li>
                <li>
                  <strong>The Rizly Telegram bot</strong> — linking flow, message handling, and
                  approval actions;
                </li>
                <li>
                  <strong>OAuth and connector flows</strong> — Google, Telegram, and payment
                  integrations.
                </li>
              </ul>
              <p>
                Third-party services we build on (Google, Telegram, Razorpay, our cloud and AI
                providers) are governed by their own programs — please report issues in those
                platforms to them directly.
              </p>
            </>
          ),
        },
        {
          id: "what-to-include",
          title: "What to Include",
          body: (
            <ul>
              <li>A clear description of the vulnerability and where it lives;</li>
              <li>Step-by-step reproduction instructions (a proof of concept helps a lot);</li>
              <li>The impact you believe it has, and on whom;</li>
              <li>Any suggested remediation, if you have one;</li>
              <li>Your contact details for follow-up (and credit, if you&apos;d like it).</li>
            </ul>
          ),
        },
        {
          id: "our-commitment",
          title: "Our Commitment",
          body: (
            <>
              <p>When you report in good faith, we commit to:</p>
              <ul>
                <li>
                  <strong>Acknowledging your report within 24 hours;</strong>
                </li>
                <li>Triaging and confirming the issue, keeping you updated as we go;</li>
                <li>Sharing a remediation timeline once the issue is confirmed;</li>
                <li>Letting you know when the fix ships;</li>
                <li>Crediting you publicly for the find, if you want the recognition.</li>
              </ul>
              <p>
                We don&apos;t currently run a paid bounty program, but meaningful reports have our
                real gratitude — and we&apos;re happy to say so publicly.
              </p>
            </>
          ),
        },
        {
          id: "rules",
          title: "Rules of Engagement & Safe Harbor",
          body: (
            <>
              <p>While researching, please:</p>
              <ul>
                <li>Test only against accounts you own or created for testing;</li>
                <li>Don&apos;t run denial-of-service, spam, or volumetric attacks;</li>
                <li>Don&apos;t access, exfiltrate, or destroy data that isn&apos;t yours;</li>
                <li>Don&apos;t use social engineering, phishing, or physical attacks;</li>
                <li>Stop and report immediately if you encounter someone else&apos;s data.</li>
              </ul>
              <p>
                <strong>Safe harbor:</strong> we will not pursue legal action against researchers
                who follow these rules and report in good faith. Security research conducted under
                this policy is considered authorized.
              </p>
            </>
          ),
        },
        {
          id: "out-of-scope",
          title: "Out of Scope",
          body: (
            <>
              <p>These are generally not accepted as vulnerabilities on their own:</p>
              <ul>
                <li>Reports from automated scanners without a demonstrated impact;</li>
                <li>Missing security headers or SPF/DKIM/DMARC nitpicks with no exploit path;</li>
                <li>Clickjacking on pages with no sensitive actions;</li>
                <li>Rate-limiting observations without a concrete abuse scenario;</li>
                <li>Outdated-dependency reports without a proven vulnerable code path;</li>
                <li>Issues requiring a compromised device or physical access.</li>
              </ul>
            </>
          ),
        },
        {
          id: "how-we-protect",
          title: "How We Protect Your Data",
          body: (
            <p>
              OAuth tokens are encrypted at rest, all traffic moves over TLS, actions that touch
              the outside world are approval-gated, and sessions can be revoked globally if a
              credential is compromised. For the full picture of how Rizly handles your data, see
              the <a href="/privacy">Privacy Policy</a> and our <a href="/trust">Trust Center</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
