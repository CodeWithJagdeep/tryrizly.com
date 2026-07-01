# DevOps & Deployment Guide

## Architecture Overview

```
┌─────────────────────┐
│  GitHub Repository  │
│  (main branch)      │
└──────────┬──────────┘
           │
           ├─→ GitHub Actions (test.yml)
           │   └─→ Run tests, lint, smoke tests
           │
           └─→ GitHub Actions (deploy.yml)
               ├─→ Build backend services
               ├─→ Web (auto-deployed to Vercel)
               └─→ Backend (manual SSH to GCP VM)

┌──────────────────────────────────────┐
│        Deployment Targets             │
├──────────────────────────────────────┤
│ Web: Vercel (Next.js)                │
│ API: GCP VM (Docker Compose)         │
│ Queue: Redis on GCP VM               │
│ Database: PostgreSQL on GCP VM       │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│        Monitoring & Errors            │
├──────────────────────────────────────┤
│ Error Tracking: Sentry               │
│ Logs: Docker container logs (VM)     │
│ Metrics: Custom dashboards (TBD)     │
└──────────────────────────────────────┘
```

## Continuous Integration

### Testing Pipeline (test.yml)

Runs on **every push to main/develop and all PRs**:
- Type checking (TypeScript)
- Linting (ESLint)
- Backend build
- Smoke tests (bootstrap, memory, telegram)
- Dependency audit
- Security checks

**Command to run locally:**
```bash
npm run build:server
npm run smoke:boot
npm run smoke:memory
```

### Deployment Pipeline (deploy.yml)

Runs on **merge to main**:
1. Build backend services
2. Verify successful build
3. Web frontend auto-deploys to Vercel
4. Backend ready for manual deployment to GCP VM
5. Post deployment status to GitHub

## Deployment Workflow

### Frontend (Automatic - Vercel)
```bash
# Push to main → Vercel auto-deploys to getrizly.com
# No manual steps required
```

### Backend (Manual - GCP VM)

After merging to main:

```bash
# SSH to VM
ssh heyriz-vm

# Pull latest code
cd ~/heyriz && git pull origin main

# Deploy using make
make prod

# Verify
make prod-status
make prod-logs
```

**Or with Docker directly:**
```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env.production build
docker compose -f docker/docker-compose.prod.yml --env-file .env.production up -d
```

## Monitoring & Error Tracking

### Sentry (Error Reporting)

1. **Setup** (first time):
   ```bash
   # Create Sentry account at sentry.io
   # Create project → get DSN
   # Update .sentryrc.json with your DSN
   ```

2. **Install SDK** (backend):
   ```bash
   npm install @sentry/node @sentry/tracing
   ```

3. **Initialize** (apps/gateway/main.ts):
   ```typescript
   import * as Sentry from "@sentry/node";
   
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 0.1,
   });
   ```

4. **Usage in code**:
   ```typescript
   try {
     await riskyOperation();
   } catch (error) {
     Sentry.captureException(error);
     throw error;
   }
   ```

### Logs

**View real-time logs from production:**
```bash
# All services
make prod-logs

# Specific service
make logs-gateway
make logs-ai-core
make logs-worker
```

**Connect to production database:**
```bash
# SSH to VM
ssh heyriz-vm

# Connect to PostgreSQL
psql postgresql://heyriz:$POSTGRES_PASSWORD@localhost:5432/heyriz

# Basic health check
SELECT version();
\dt  -- list tables
```

## Pre-Launch Checklist

- [ ] Sentry DSN configured in `.env.production`
- [ ] Domain DNS configured (getrizly.com → Vercel)
- [ ] All smoke tests passing
- [ ] No critical security issues in audit
- [ ] Backup of production `.env.production` exists
- [ ] Team trained on deployment process
- [ ] Runbook documented (this file!)

## Common Tasks

### Emergency Rollback
```bash
ssh heyriz-vm
cd ~/heyriz
git checkout <previous-commit>
make prod-restart
```

### Scale Services
Edit `.env.production` and restart:
```bash
make prod-restart
```

### Database Migrations
```bash
ssh heyriz-vm
cd ~/heyriz
docker exec -it <postgres-container> psql -U heyriz -d heyriz -f migration.sql
```

## Troubleshooting

**Build fails with "workStore" error:**
- This is a Next.js 16 issue with static generation
- Check that `export const dynamic = 'force-dynamic'` is in root layout
- Run: `rm -rf web/.next && npm run build`

**Services won't start:**
```bash
make prod-down
make prod-up --build
```

**Out of disk space:**
```bash
docker system prune -a --volumes
docker image prune -a
```

**Memory issues:**
```bash
docker stats  # check container memory usage
# Increase `docker-compose.prod.yml` service memory limits if needed
```
