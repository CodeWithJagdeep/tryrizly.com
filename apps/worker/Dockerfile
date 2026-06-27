# Build context = repo root (see docker/docker-compose.prod.yml: context: ., dockerfile: apps/worker/Dockerfile).
# This is an npm-workspace build: the shared @heyriz/shared package is built and linked
# alongside the worker app.

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/billing/package.json ./apps/billing/
COPY apps/ai-core/package.json ./apps/ai-core/
COPY apps/worker/package.json ./apps/worker/
RUN npm ci

COPY shared ./shared
COPY apps/worker ./apps/worker

RUN npm run build -w shared \
 && npm run build -w apps/worker

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:22-bookworm-slim AS production
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/billing/package.json ./apps/billing/
COPY apps/ai-core/package.json ./apps/ai-core/
COPY apps/worker/package.json ./apps/worker/
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

CMD ["node", "apps/worker/dist/main"]
