export type Role = {
  slug: string;
  title: string;
  tagline: string;
  category: string;
  employmentType: string;
  overview: string;
  responsibilities: string[];
  requirements: string[];
  niceToHaves: string[];
  ninetyDayPlan: { period: string; goal: string }[];
};

export const roles: Role[] = [
  {
    slug: "senior-ai-engineer",
    title: "Senior AI Engineer",
    tagline: "Help us build the reasoning core of a truly proactive AI operator.",
    category: "Core intelligence",
    employmentType: "Full-time",
    overview:
      "We are looking for an engineer who is obsessed with LLM reasoning and agentic workflows. We are in the early days of building the foundation that allows Rizly to triage, decide, and act on a founder's behalf with high precision.",
    responsibilities: [
      "Design and implement advanced reasoning loops for the Rizly engine.",
      "Optimize the agent's ability to reason across inbox, calendar, and revenue signals.",
      "Build specialized tools the agent uses to verify its own suggestions before they reach approval.",
      "Experiment with new model architectures and prompting strategies to push what's possible.",
    ],
    requirements: [
      "5+ years of experience in software engineering.",
      "Deep understanding of LLMs, vector databases, and agentic frameworks.",
      "Expertise in TypeScript, Python, and Rust.",
      "A portfolio of high-impact AI projects or contributions to open-source AI tools.",
    ],
    niceToHaves: [
      "Experience building or fine-tuning classification models for high-volume text.",
      "Prior work on developer tools, copilots, or other agentic products.",
      "Contributions to open-source LLM tooling (LangChain, LlamaIndex, or similar).",
    ],
    ninetyDayPlan: [
      { period: "First 30 days", goal: "Ship your first improvement to the triage or drafting pipeline and understand the full reasoning loop end to end." },
      { period: "First 60 days", goal: "Own a full reasoning subsystem (e.g. calendar conflict detection or revenue anomaly detection)." },
      { period: "First 90 days", goal: "Propose and lead a new capability that measurably improves approval accuracy or reduces founder decision time." },
    ],
  },
  {
    slug: "product-designer",
    title: "Product Designer",
    tagline: "Define the visual language of approval-first automation.",
    category: "UX & brand",
    employmentType: "Full-time",
    overview:
      "We need a designer who can turn a complex, high-trust AI system into an interface that feels effortless. You'll shape how founders experience Rizly's daily briefs, approvals, and every touchpoint in between.",
    responsibilities: [
      "Own end-to-end design for the web app, Telegram experience, and marketing site.",
      "Design approval flows that feel fast, trustworthy, and never overwhelming.",
      "Build and maintain the design system used across every Rizly surface.",
      "Partner directly with engineering to ship polished experiences quickly.",
    ],
    requirements: [
      "4+ years of product design experience, ideally on complex or data-dense products.",
      "A strong portfolio showing systems thinking, not just visuals.",
      "Comfort working directly in code (Tailwind/React) to prototype and ship.",
      "An obsession with reducing cognitive load for busy, high-stakes users.",
    ],
    niceToHaves: [
      "Experience designing for chat or conversational interfaces (Telegram, Slack, etc.).",
      "Background in B2B SaaS or fintech products with dense data.",
      "Motion design skills for micro-interactions and state transitions.",
    ],
    ninetyDayPlan: [
      { period: "First 30 days", goal: "Redesign one high-friction flow (e.g. onboarding or approvals) and ship it." },
      { period: "First 60 days", goal: "Establish a documented design system spanning web, Telegram, and marketing." },
      { period: "First 90 days", goal: "Own the end-to-end design roadmap and run your first user research cycle." },
    ],
  },
  {
    slug: "backend-systems-architect",
    title: "Backend Systems Architect",
    tagline: "Scale the engine to millions of inboxes and calendars.",
    category: "Infrastructure",
    employmentType: "Full-time",
    overview:
      "Rizly ingests high-volume signals from Gmail, Calendar, Stripe, and more, every minute of every day. We need an architect who can design systems that stay fast, reliable, and cheap at scale.",
    responsibilities: [
      "Design the data pipelines that keep every integration in sync in near real time.",
      "Build resilient queuing, retry, and rate-limiting systems for third-party APIs.",
      "Own the reliability and performance of the core gateway and worker services.",
      "Set architecture standards as the team and traffic scale.",
    ],
    requirements: [
      "6+ years building distributed backend systems in production.",
      "Deep experience with queues, event-driven architecture, and horizontal scaling.",
      "Strong track record operating systems under real production load.",
      "Comfort owning infrastructure decisions with minimal oversight.",
    ],
    niceToHaves: [
      "Experience with NestJS, Redis, and multi-tenant SaaS architecture.",
      "Background scaling systems that integrate with OAuth-gated third-party APIs.",
      "Familiarity with cost optimization at scale (compute, storage, third-party API spend).",
    ],
    ninetyDayPlan: [
      { period: "First 30 days", goal: "Deep-dive the gateway and worker architecture, ship a reliability fix in a live integration." },
      { period: "First 60 days", goal: "Own the scaling plan for one integration pipeline (Gmail, Calendar, or Stripe)." },
      { period: "First 90 days", goal: "Define and implement the architecture standard the team uses going forward." },
    ],
  },
  {
    slug: "security-researcher",
    title: "Security Researcher",
    tagline: "Make Rizly the safest AI operator a founder can trust.",
    category: "Security",
    employmentType: "Full-time",
    overview:
      "Rizly touches a founder's most sensitive systems — inbox, calendar, and revenue. We need someone obsessive about closing every gap before it becomes a problem, and about proving our approval-first model is trustworthy by design.",
    responsibilities: [
      "Audit every integration and permission scope Rizly requests.",
      "Design and enforce the encryption, retention, and access-control model.",
      "Run red-team exercises against the agent's decision-making and approval flows.",
      "Own compliance work (SOC2, GDPR, CCPA) as Rizly scales to enterprise customers.",
    ],
    requirements: [
      "5+ years in application or infrastructure security.",
      "Experience securing systems that integrate with third-party OAuth providers.",
      "Familiarity with LLM-specific risks (prompt injection, data exfiltration via agents).",
      "A track record of shipping security fixes, not just finding issues.",
    ],
    niceToHaves: [
      "Prior experience with SOC2 or ISO 27001 audits at an early-stage company.",
      "Bug bounty or CTF background.",
      "Experience securing agentic or LLM-powered products specifically.",
    ],
    ninetyDayPlan: [
      { period: "First 30 days", goal: "Complete a full audit of current integration scopes and data retention practices." },
      { period: "First 60 days", goal: "Ship the first round of hardening fixes and stand up ongoing red-team exercises." },
      { period: "First 90 days", goal: "Have a clear roadmap toward SOC2 readiness in motion." },
    ],
  },
];

export function getRole(slug: string): Role | undefined {
  return roles.find((role) => role.slug === slug);
}
