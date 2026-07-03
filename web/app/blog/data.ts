export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  content: string;
  category: string;
  readTime: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string;
};

export const posts: BlogPost[] = [
  {
    slug: "why-we-built-rizly",
    title: "Why we built rizly",
    excerpt:
      "Founders don't need another dashboard. They need someone watching the business who only speaks up when it matters.",
    date: "2026-05-04",
    content:
      "Founders don't need another dashboard. They need someone watching the business who only speaks up when it matters.\n\nThat's the idea behind rizly: a proactive operator that reads your inbox, calendar, and tools, and turns the noise into a short list of decisions you actually need to make.",
    category: "Company",
    readTime: "3 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "inbox-to-action",
    title: "From inbox noise to action items",
    excerpt:
      "Most email triage tools sort messages. rizly reads them, understands intent, and drafts the next step for you.",
    date: "2026-04-18",
    content:
      "Most email triage tools sort messages. rizly reads them, understands intent, and drafts the next step for you.\n\nInstead of a clean inbox, you get a short brief: who needs a reply, what they want, and a suggested response ready to approve.",
    category: "Guides",
    readTime: "4 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "protecting-the-calendar",
    title: "Protecting the calendar without micromanaging it",
    excerpt:
      "A calendar full of meetings isn't the problem. An unprotected calendar is.",
    date: "2026-03-22",
    content:
      "A calendar full of meetings isn't the problem. An unprotected calendar is.\n\nrizly watches for conflicts, flags meetings that need prep, and holds buffers automatically so the important calls always have room to breathe.",
    category: "Product",
    readTime: "4 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "the-consent-loop",
    title: "The Consent Loop: Why Proactive AI Needs Human Approval",
    excerpt:
      "Automating background actions is high risk. We explore how we built a consensus model in Telegram that never drafts or triggers actions without your permission.",
    date: "2026-06-25",
    content:
      "Automating background actions is high risk. We explore how we built a consensus model in Telegram that never drafts or triggers actions without your permission.\n\nAutonomous agents are powerful, but when they operate directly on your email, customer accounts, or payment gateways, mistake costs are high. The Consent Loop is our answer. Rather than letting the AI execute blindly, rizly constructs drafts, proposes actions, and sends a single, interactive Telegram prompt. With a simple tap on 'Approve' or 'Reject', you maintain complete control without ever having to log into a heavy administration panel.",
    category: "Company",
    readTime: "5 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "database-connections-briefings",
    title: "Connecting PostgreSQL and MongoDB to Your Daily Brief",
    excerpt:
      "Learn how to configure SQL and MongoDB database monitors to feed transactional data, signups, and error rates straight to Riz.",
    date: "2026-06-18",
    content:
      "Learn how to configure SQL and MongoDB database monitors to feed transactional data, signups, and error rates straight to Riz.\n\nBusiness metrics shouldn't require manual querying. By linking database read-only credentials, rizly runs lightweight background queries on signups, high-value payments, or system exceptions. Instead of configuring complex reporting pipelines, Riz interprets query outputs and notes anomalies directly within your daily Telegram summary. You get the pulse of your production databases without the visual clutter.",
    category: "Guides",
    readTime: "5 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "oauth-token-isolation-security",
    title: "Security and OAuth Token Isolation in LLM Agents",
    excerpt:
      "Running AI over workspace data demands absolute key isolation. Here is how we isolate user tokens from the execution runtime.",
    date: "2026-06-12",
    content:
      "Running AI over workspace data demands absolute key isolation. Here is how we isolate user tokens from the execution runtime.\n\nTraditional integrations store tokens alongside execution logs. In the rizly architecture, credentials for Gmail, Stripe, and Slack are encrypted and kept in isolated storage. The LLM agent receives only localized context and does not have access to the credentials. When a tool call is generated, it is validated in an isolated execution sandbox that merges the decrypted token, processes the API request, and immediately wipes the keys from active memory.",
    category: "Product",
    readTime: "6 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "designing-for-zero-distraction",
    title: "Designing for Zero Distraction: The Daily Brief Pattern",
    excerpt:
      "Slack channels and notification alerts cause context switches. We explain the design choices behind sending a single brief once a day.",
    date: "2026-05-28",
    content:
      "Slack channels and notification alerts cause context switches. We explain the design choices behind sending a single brief once a day.\n\nNotification fatigue degrades developer and founder productivity. Modern collaboration tools constantly interrupt your flow. rizly is designed around asynchronous batching. Unless a critical production error occurs, Riz aggregates email drafts, meeting alerts, and business signals into a single daily briefing. This ensures you maintain deep focus blocks throughout the day, dealing with background triages on your own schedule.",
    category: "Product",
    readTime: "4 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "budget-caps-overage-prevention",
    title: "Overage Protection: Safeguarding Your AI API Budgets",
    excerpt:
      "AI budgets can spiral. We detail our overage prevention systems that pause background agents at 100% of your plan limit.",
    date: "2026-05-15",
    content:
      "AI budgets can spiral. We detail our overage prevention systems that pause background agents at 100% of your plan limit.\n\nBackground runs and repetitive indexing loops can easily run up massive API fees. rizly includes native budget containment rules. We track token usage in real-time. When your account hits 80% of its monthly token budget, we alert you via Telegram. If it reaches 100%, background loops pause gracefully to prevent unexpected charges. You never get a surprise bill at the end of the month.",
    category: "Product",
    readTime: "4 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "stripe-razorpay-webhook-integrations",
    title: "Integrating Stripe and Razorpay Webhooks into Proactive Briefs",
    excerpt:
      "A step-by-step walkthrough on linking payment gateways to monitor failed payments, recurring subs, and revenue anomalies.",
    date: "2026-04-29",
    content:
      "A step-by-step walkthrough on linking payment gateways to monitor failed payments, recurring subs, and revenue anomalies.\n\nRevenue events are critical signals. By hooking Stripe or Razorpay endpoints into rizly, our operator scans for billing events. If a recurring subscription fails twice, or a high-tier customer experiences checkout abandonment, Riz drafts an email in Gmail offering support and schedules it for your review. This turns checkout monitoring into automated revenue recovery.",
    category: "Guides",
    readTime: "5 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "vector-memory-vs-relational-state",
    title: "Vector Memory vs Relational State: Context Management in LLMs",
    excerpt:
      "How we store and query context across Telegram conversations and dashboard configurations without causing hallucinations.",
    date: "2026-04-05",
    content:
      "How we store and query context across Telegram conversations and dashboard configurations without causing hallucinations.\n\nContext windows are finite and costly. Storing every Telegram message inside LLM context prompts causes latency and logic degradation. rizly uses a hybrid approach: relational tables manage hard rules, access tokens, and calendars, while a vector database indexes conversation history and email summaries. This allows the agent to execute semantic searches on historical queries without bloating prompts.",
    category: "Company",
    readTime: "5 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "automatic-calendar-buffer-blocking",
    title: "Automatic Calendar Buffer Blocking for Deep Work",
    excerpt:
      "Managing meeting-free zones is tedious. Our calendar agent blocks buffer slots dynamically to preserve deep work windows.",
    date: "2026-03-15",
    content:
      "Managing meeting-free zones is tedious. Our calendar agent blocks buffer slots dynamically to preserve deep work windows.\n\nWhen open slots appear on your calendar, scheduling apps automatically fill them with meetings, leaving no room for execution. Our calendar agent monitors your schedules. When it detects back-to-back calls, it automatically blocks out 15-minute buffers and marks them private. It also locks two-hour execution blocks on days with high meeting density, protecting your productivity.",
    category: "Product",
    readTime: "3 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "resilient-telegram-bot-webhook-handlers",
    title: "Building Resilient Webhook Handlers for Telegram Bots",
    excerpt:
      "How to design bot servers that process user replies, approvals, and commands reliably without dropped requests.",
    date: "2026-03-02",
    content:
      "How to design bot servers that process user replies, approvals, and commands reliably without dropped requests.\n\nWebhook delivery systems are prone to network timeouts and duplicate payloads. When a user approves an action inside Telegram, rizly utilizes a Redis-backed queue to process the response. If the gateway server takes too long to execute, the bot responds with a loading state and handles the execution asynchronously, ensuring the UI remains highly responsive and reliable.",
    category: "Guides",
    readTime: "4 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "fine-tuning-open-source-models-tool-calling",
    title: "Fine-Tuning Open Source LLMs for Accurate Workspace Tool Calling",
    excerpt:
      "General purpose models struggle with formatting tool calls. Here's our workflow for training models on custom workspace schemas.",
    date: "2026-02-20",
    content:
      "General purpose models struggle with formatting tool calls. Here's our workflow for training models on custom workspace schemas.\n\nCommercial models are highly general but frequently fail to output strict JSON schemas for custom tools. We fine-tune smaller models on formatted execution datasets. By training models exclusively on tool calling patterns and API specifications, we achieve faster inference speeds and extremely high execution reliability, keeping user operations error-free.",
    category: "Product",
    readTime: "5 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
  {
    slug: "the-vision-autonomous-workspace-operations",
    title: "The Vision: Autonomous Workspace Operations",
    excerpt:
      "Our roadmap for expanding rizly from a triaging assistant to a fully autonomous background operator.",
    date: "2026-02-01",
    content:
      "Our roadmap for expanding rizly from a triaging assistant to a fully autonomous background operator.\n\nAI is transitioning from text generation to background execution. Today, rizly operates as an assistant verifying drafts. Tomorrow, we envision a future where proactive operators manage integrations autonomously, coordinating tasks and verifying revenue loops on autopilot, with humans acting purely as policy reviewers rather than daily action approvers.",
    category: "Company",
    readTime: "4 min read",
    authorName: "Jagdeep Singh",
    authorRole: "Co-founder, rizly",
    authorAvatar: "JS",
  },
];

export function findPost(slug: string) {
  return posts.find((post) => post.slug === slug);
}
