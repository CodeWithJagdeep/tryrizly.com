# DevOps & Deployment Guide

## Architecture Overview

```
┌──────────────────────────────────────┐
│    GitHub Repository (main)          │
│    ↓ Every push triggers CI/CD       │
└──────────────────────────────────────┘
           │
           ├─→ Frontend (web/)
           │   └─→ Vercel (auto-deploy)
           │       ↓
           │   https://getrizly.com
           │
           └─→ Backend (apps/gateway, ai-core, worker)
               └─→ GCP VM (manual deployment)
                   ↓
               https://api.getrizly.com

┌──────────────────────────────────────┐
│     GCP VM Services Only              │
│     (NO web files here)               │
├──────────────────────────────────────┤
│ gateway:4000   — HTTP API/Telegram   │
│ ai-core:4100   — LLM agent engine    │
│ worker         — BullMQ async jobs   │
│ billing:4200   — Billing service     │
│ postgres:5432  — Main database       │
│ redis:6379     — Cache & queues      │
│ mongodb:27017  — Document store      │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│   Vercel (Separate Hosting)          │
│   (NO backend here)                  │
├──────────────────────────────────────┤
│ Next.js web app (getrizly.com)       │
│ Static assets & edge functions       │
│ → calls api.getrizly.com for data    │
└──────────────────────────────────────┘
```

**Key:** Web and backend are completely separated. Never SSH backend code to Vercel. Never push web code to the VM.

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
# Push changes to web/ folder to main
# → Vercel automatically builds and deploys
# → Live at https://getrizly.com in ~60 seconds
# No manual SSH or Docker commands needed
```

**Important:** Web files NEVER go to the GCP VM. Vercel handles all frontend deployment.

### Backend (Manual - GCP VM Only)

Only `apps/gateway`, `apps/ai-core`, `apps/worker`, `apps/billing` + databases run on VM.

After merging backend changes to main:

```bash
# SSH to GCP VM
ssh heyriz-vm

# Pull latest code
cd ~/heyriz && git pull origin main

# Deploy backend services only
make prod

# Verify services running
make prod-status
make prod-logs
```

**Manual Docker deploy:**
```bash
cd ~/heyriz
docker compose -f docker/docker-compose.prod.yml --env-file .env.production build
docker compose -f docker/docker-compose.prod.yml --env-file .env.production up -d
```

**Verify services:**
```bash
# All running?
docker ps

# Health check
curl http://localhost:4000/health

# Logs
docker compose -f docker/docker-compose.prod.yml logs -f
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
