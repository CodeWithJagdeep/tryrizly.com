# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/ai-core/package.json ./apps/ai-core/
COPY apps/worker/package.json ./apps/worker/
RUN npm ci

FROM deps AS dev
ENV NODE_ENV=development
COPY . .
CMD ["npm", "run", "dev:web"]

FROM deps AS builder
ENV NODE_ENV=production
COPY . .
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000 4000 4100
CMD ["npm", "run", "start:web"]
