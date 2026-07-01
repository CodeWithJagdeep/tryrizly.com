# Monitoring Setup Guide

## Quick Start: Sentry Error Tracking

### 1. Create Sentry Project (5 minutes)

```bash
# Go to https://sentry.io and sign up (free tier available)
# Create new organization → new project
# Platform: Select "Next.js"
# Get your DSN (looks like: https://abc123@o1234567.ingest.sentry.io/5678901)
```

### 2. Configure Environment Variables

**`.env.production`** - Add:
```bash
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_DSN_HERE@sentry.io/PROJECT_ID
```

**`.env.local`** (development) - Add same DSN or leave empty to disable in dev

### 3. Enable Sentry in Next.js

The sentry config is already in place. Just uncomment/enable in your `next.config.ts`:

```typescript
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig = {
  // ... your existing config
};

export default withSentryConfig(nextConfig, {
  org: "your-sentry-org",
  project: "rizly-web",
  authToken: process.env.SENTRY_AUTH_TOKEN, // Optional CI/CD integration
});
```

### 4. Test Error Tracking

```typescript
// Add to any component to test:
import * as Sentry from "@sentry/nextjs";

function TestError() {
  return (
    <button onClick={() => {
      throw new Error("Test error!");
    }}>
      Throw test error
    </button>
  );
}
```

Click the button, then check your Sentry dashboard—error should appear in ~5 seconds.

### 5. Enable Source Maps (Optional but Recommended)

For production builds, upload source maps to Sentry so errors show actual code lines:

```bash
npm install @sentry/cli --save-dev
```

Then in GitHub Actions or deployment:
```bash
sentry-cli releases files upload-sourcemaps ./web/.next
```

## Backend Monitoring (Node.js)

### 1. Install Sentry in Backend

```bash
npm install @sentry/node @sentry/tracing -w apps/gateway
npm install @sentry/node @sentry/tracing -w apps/ai-core
npm install @sentry/node @sentry/tracing -w apps/worker
```

### 2. Initialize in Each Service

**apps/gateway/src/main.ts:**
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Create Express middleware
app.use(Sentry.Handlers.requestHandler());

// Add error handler (must be last)
app.use(Sentry.Handlers.errorHandler());
```

### 3. Capture Errors Manually

```typescript
try {
  await riskyAsyncOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      section: "email_processing",
    },
  });
  // Re-throw or handle gracefully
  throw error;
}
```

## Log Aggregation (Production VM)

### Docker Logs

```bash
# All containers
docker compose -f docker/docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker/docker-compose.prod.yml logs -f gateway

# Last 100 lines
docker compose -f docker/docker-compose.prod.yml logs --tail 100 gateway
```

### Structured Logging (Optional Enhancement)

Install Winston or Pino for structured JSON logs:

```bash
npm install pino -w shared
```

Then use in services:
```typescript
import pino from "pino";
const logger = pino();

logger.info({ msg: "Email processed", userId, time: Date.now() });
```

This makes searching/filtering logs much easier in Sentry or other tools.

## Alerts & Notifications

### Sentry Alerts (Free Tier)

1. Go to Sentry project settings → Alerts
2. Create alert: "When > 10 errors occur in an hour"
3. Action: "Send to Slack" or "Send email"
4. Save

### Slack Integration

1. In Sentry: Settings → Integrations → Find Slack
2. "Install" and authorize your Slack workspace
3. Select channel for alerts (e.g., #prod-alerts)

### GitHub Integration

Already enabled! Sentry will auto-create issues on GitHub for new errors.

## Monitoring Checklist

- [ ] Sentry account created (https://sentry.io)
- [ ] DSN added to `.env.production`
- [ ] Sentry configured in web `next.config.ts`
- [ ] Sentry initialized in backend services
- [ ] Test error thrown and appears in Sentry dashboard
- [ ] Slack integration enabled
- [ ] Alert rule created for high error rate
- [ ] Source maps uploaded (optional)

## Useful Sentry Links

- **Dashboard**: https://sentry.io/organizations/YOUR_ORG/issues/
- **Settings**: https://sentry.io/settings/organizations/YOUR_ORG/
- **Docs**: https://docs.sentry.io/platforms/node/
- **Performance**: https://sentry.io/organizations/YOUR_ORG/performance/

## Cost

- **Free tier**: 5K errors/month (more than enough for initial launch)
- **Pro**: $29/mo (unlimited errors + more features)
- **Scale**: Pay-as-you-go beyond free tier limits
