This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Project Layout

```text
apps/
  ai-core/     - NestJS TCP microservice: agent loop, tools, memory, Google client.
  gateway/     - NestJS public HTTP gateway for Telegram, web, and webhooks.
  worker/      - NestJS application context running the BullMQ worker + scheduler.
shared/        - env/logger/telegram helpers and the BullMQ queue setup, used by every app.
web/           - the Next.js app (App Router) and its static assets.
docker/        - Dockerfile and docker-compose files.
kubernetes/    - reserved for manifests if/when this moves off Compose.
docs/          - product and architecture notes.
```

- `apps/gateway/server.ts` - NestJS public HTTP gateway for clients such as Telegram or web.
- `apps/ai-core/server.ts` - NestJS TCP microservice and tool boundary.
- `apps/worker/notification.worker.ts` - NestJS application context that runs the BullMQ worker.
- `shared/queue/*` - Redis/BullMQ queue setup, shared by ai-core and worker.
- `web/app/dashboard/connectors` - connector setup UI for OAuth and manual secrets.
- `docs/product.md` - product and architecture notes.

Copy `.env.example` to `.env`, then run Redis locally before starting the services.

AI provider defaults to deterministic rules. To use Grok, set:

```bash
AI_PROVIDER=grok
XAI_API_KEY=your_xai_key
GROK_MODEL=grok-4.3
```

Connector vault setup:

```bash
DATABASE_URL=postgres://...
CONNECTOR_VAULT_KEY=use-a-long-random-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:4000/api/connectors/google/callback
```

## Docker

Development uses bind mounts and hot reload:

```bash
cp .env.example .env
docker compose -f docker/docker-compose.dev.yml up --build
```

Development services:

- Web: `http://localhost:3000`
- Gateway: `http://localhost:4000`
- AI Core TCP: `localhost:4100`
- Redis: `localhost:6379`
- Postgres: `localhost:5432`

Production builds one image and runs separate processes from it:

```bash
cp .env.production.example .env.production
# edit .env.production, especially POSTGRES_PASSWORD and CONNECTOR_VAULT_KEY
docker compose -f docker/docker-compose.prod.yml up --build -d
```

Production services:

- `web` runs `npm run start:web`
- `gateway` runs `npm run start:gateway`
- `ai-core` runs `npm run start:ai-core`
- `worker` runs `npm run start:worker`

For real production, put a reverse proxy such as nginx/Caddy/Traefik in front of
the web and gateway containers, and terminate TLS there.

```bash
npm run dev:ai-core
npm run dev:gateway
npm run dev:worker
```

Useful endpoints:

```bash
curl http://localhost:4000/health
curl -X POST http://localhost:4000/api/ai/chat \
  -H 'content-type: application/json' \
  -d '{"message":"yo jervis"}'
curl -X POST http://localhost:4000/api/events \
  -H 'content-type: application/json' \
  -d '{"userId":"default","source":"gmail","message":"Naman wants to meet Tuesday 3 PM","contactName":"Naman"}'
curl -X POST http://localhost:4000/api/tasks/reminders \
  -H 'content-type: application/json' \
  -d '{"message":"Meeting with Naman in 30 minutes","runAt":"2026-06-21T18:00:00.000Z"}'
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `web/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
