# 🚀 Rizly Launch Checklist

**Status**: ✅ **READY FOR LAUNCH** (with final steps below)

---

## ✅ COMPLETED

### Core Product
- [x] Entity spine (Week 1-4) — entities, events, decisions all integrated
- [x] Email triage & drafting — full functionality
- [x] Calendar sync & automation — meeting prep packets
- [x] Telegram bot integration — fully operational
- [x] Memory & context management — cross-channel linking
- [x] All 5 hardening issues shipped (2026-06-25)
  - Silent spine failures → BullMQ durable queue
  - Single approval slot → Redis HASH store
  - Decision coverage → email/chat/calendar
  - SQL injection guards → schema validation
  - Email triage window → starred/important ranking

### Frontend & Branding
- [x] Rebrand from HeyRiz to Rizly ✨
- [x] Professional pricing page with 4 tiers
- [x] Landing page redesign
- [x] Hero component with compelling copy
- [x] Responsive design (mobile, tablet, desktop)

### Infrastructure
- [x] Docker Compose (dev & production)
- [x] PostgreSQL + pgvector + Redis + MongoDB
- [x] Telegram network bypass via GCP VM
- [x] OAuth setup (Google, LinkedIn, Twitter)
- [x] Email integration (Zoho + Resend)
- [x] BullMQ queue system for async work

### CI/CD & DevOps
- [x] GitHub Actions testing pipeline
- [x] Deployment automation
- [x] Smoke tests configured
- [x] Security audit in CI
- [x] Sentry error tracking setup
- [x] Comprehensive DevOps documentation
- [x] Monitoring setup guide

### Deployment
- [x] Web deployment target (Vercel)
- [x] Backend deployment target (GCP VM)
- [x] Environment configuration (.env.production)
- [x] Production Makefile commands
- [x] Database schema & migrations

---

## 🟡 IMMEDIATE ACTION ITEMS (Before Launch)

### 1. **Configure DNS** (Blocker) 🔴
```
Action: Set up domain DNS to point to production
Domain: getrizly.com
Where: Hostinger DNS settings (currently parked)
What: Add Vercel CNAME/A records from DNS dashboard

Details in: docs/devops.md → DNS Configuration
Timeline: 15 minutes
```

### 2. **Set up Sentry** (Error Tracking)
```
Action: Enable production error monitoring
Steps:
1. Create account at https://sentry.io (free tier available)
2. Create project → get DSN
3. Add SENTRY_DSN to .env.production on GCP VM
4. Restart services: ssh heyriz-vm && make prod-restart
5. Verify errors appear in Sentry dashboard

Timeline: 10 minutes
Docs: docs/monitoring-setup.md
```

### 3. **Verify Production Deployment**
```bash
# SSH to VM
ssh heyriz-vm

# Check services are running
docker compose -f docker/docker-compose.prod.yml ps

# Test API
curl http://localhost:4000/health

# Check logs
docker compose -f docker/docker-compose.prod.yml logs -f

# If any issues, see troubleshooting in docs/devops.md
```

### 4. **Enable CI/CD Checks**
```
What: GitHub Actions will auto-run on every push
Status: Already configured in .github/workflows/
Actions: test.yml (testing) + deploy.yml (deployment)
Dashboard: GitHub → Actions tab → see all runs
```

### 5. **Post Launch Monitoring**
```
Action: Watch error tracking and health metrics
Tools: 
- Sentry dashboard: https://sentry.io
- Logs: make prod-logs (from VM)
- GitHub: Actions tab for deployment status
On-call: Set up Sentry alerts → Slack for critical errors
```

---

## 📋 FINAL VERIFICATION CHECKLIST

Before clicking "launch":

- [ ] **Domain configured**: getrizly.com resolves to Vercel
- [ ] **Services healthy**: `docker ps` shows all 4 containers running
- [ ] **Database connected**: Can SSH to VM and query PostgreSQL
- [ ] **OAuth working**: Test Google sign-up on staging
- [ ] **Emails sending**: Test email draft generation
- [ ] **Telegram bot responsive**: Send /start to @tryrizlybot
- [ ] **Sentry receiving errors**: Throw test error, see in dashboard
- [ ] **CI passing**: GitHub Actions green on main branch
- [ ] **No critical security warnings**: npm audit clean
- [ ] **Backup exists**: `.env.production` backed up securely

---

## 🎯 LAUNCH SEQUENCE

### T-30 minutes
```bash
# Final test of full stack
make prod-restart
sleep 10
make prod-logs  # Verify no startup errors
```

### T-15 minutes
```bash
# Announce in Slack
# Post in Discord/Twitter (if public)
# Monitor error rates (should be 0 for first hours)
```

### T-0 minutes
```bash
# Enable monitoring alerts
# Go live with DNS swap to production
# Post launch announcement
```

### T+1 hour
```bash
# Check Sentry for any errors
# Monitor make prod-logs
# Be available for emergency rollback
```

### T+24 hours
```bash
# Review all errors captured
# Check usage metrics
# Gather early user feedback
```

---

## 🔄 Post-Launch Support

### Critical Issues
If services go down:
```bash
ssh heyriz-vm
make prod-down
make prod-restart
# Check logs: make prod-logs
```

### Rollback Plan
If deployment has critical bugs:
```bash
git revert <commit-hash>
git push origin main
# Wait for GitHub Actions to complete
ssh heyriz-vm
make prod  # Redeploy
```

### Team Runbook
- **Alerts**: Sentry → Slack #prod-alerts
- **Logs**: `make prod-logs` from any team member's terminal
- **Database**: SSH to heyriz-vm, use psql
- **Deployment**: Follow docs/devops.md
- **Rollback**: See section above

---

## 📚 Key Documents

- **Deployment**: `docs/devops.md` — Full DevOps guide
- **Monitoring**: `docs/monitoring-setup.md` — Error tracking & alerts
- **Roadmap**: `memory/hardening_roadmap.md` — What shipped & why
- **Architecture**: `memory/v2_entity_spine.md` — Core data model
- **Infrastructure**: `server.md` — VM details
- **Product**: `docs/product.md` — Product spec & features

---

## 🎉 Launch Status

| Component | Status | Owner | ETA |
|-----------|--------|-------|-----|
| Frontend | ✅ Ready | Deploy to Vercel auto | Immediate |
| Backend | ✅ Ready | Redeploy via `make prod` | 2 min |
| Database | ✅ Ready | Already running | Now |
| DNS | 🟡 **TODO** | Hostinger | ASAP |
| Monitoring | 🟡 **TODO** | Sentry config | 10 min |
| Smoke tests | ✅ Ready | CI/CD | Auto |

**Overall: 90% ready. 2 manual tasks remain (DNS + Sentry).**

---

## Questions?

- Deployment issues? → `docs/devops.md`
- Monitoring setup? → `docs/monitoring-setup.md`
- Product questions? → `docs/product.md`
- Architecture? → `memory/v2_entity_spine.md`

**Good luck with launch! 🚀**
