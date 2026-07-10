# Build context = repo root (see docker/docker-compose.prod.yml: context: ., dockerfile: apps/gateway/Dockerfile).
# This is an npm-workspace build: the shared @heyriz/shared package is built and linked
# alongside the gateway app.

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Workspace manifests first (better install-layer caching). All workspace package.json
# files referenced by the root lockfile must be present for `npm ci`.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/billing/package.json ./apps/billing/
COPY apps/ai-core/package.json ./apps/ai-core/
COPY apps/worker/package.json ./apps/worker/
RUN npm ci

# Sources needed to build this app + the shared package
COPY shared ./shared
COPY apps/gateway ./apps/gateway

# Build the shared package first, then the app
RUN npm run build -w shared \
 && npm run build -w apps/gateway

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:22-bookworm-slim AS production
WORKDIR /app

ENV NODE_ENV=production

# Production deps for the workspace (root lockfile). The shared workspace is symlinked
# into node_modules/@heyriz/shared automatically.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/billing/package.json ./apps/billing/
COPY apps/ai-core/package.json ./apps/ai-core/
COPY apps/worker/package.json ./apps/worker/
RUN npm ci --omit=dev && npm cache clean --force

# Compiled artifacts (shared package + app) + static marketing assets served at runtime
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist
COPY apps/gateway/public ./apps/gateway/public

EXPOSE 4000

CMD ["node", "apps/gateway/dist/main"]
