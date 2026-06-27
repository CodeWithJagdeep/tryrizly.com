# Build context = repo root. This is an npm-workspace build: the shared package
# is built and linked alongside the billing app.

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
COPY apps/billing ./apps/billing

RUN npm run build -w shared \
 && npm run build -w apps/billing

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
COPY --from=builder /app/apps/billing/dist ./apps/billing/dist

EXPOSE 4200

CMD ["node", "apps/billing/dist/main"]
