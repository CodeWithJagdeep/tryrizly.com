# ─────────────────────────────────────────────────────────────────────────────
# heyriz — Development & Production Commands
# Usage: make <target>
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: help \
        dev dev-gateway dev-ai-core dev-worker \
        dev-docker dev-docker-up dev-docker-down dev-docker-restart dev-docker-logs dev-docker-status \
        build build-gateway build-ai-core build-worker \
        prod prod-up prod-down prod-restart prod-status prod-logs \
        logs-gateway logs-ai-core logs-worker \
        install smoke-boot smoke-agent smoke-memory smoke-telegram smoke-automemory \
        clean

SHELL := /bin/bash

# ── Colours ───────────────────────────────────────────────────────────────────
CYAN  := \033[0;36m
RESET := \033[0m

# ─────────────────────────────────────────────────────────────────────────────
# Help
# ─────────────────────────────────────────────────────────────────────────────

help:
	@echo -e ""
	@echo -e "  $(CYAN)heyriz$(RESET)"
	@echo -e ""
	@echo -e "  $(CYAN)Dev (watch mode, runs on the host, all services in parallel)$(RESET)"
	@echo -e "    make dev            Start gateway + ai-core + worker in dev/watch mode"
	@echo -e "    make dev-gateway    Start the gateway (HTTP, :4000) only"
	@echo -e "    make dev-ai-core    Start ai-core (TCP microservice, :4100) only"
	@echo -e "    make dev-worker     Start the notification/scheduler worker only"
	@echo -e ""
	@echo -e "  $(CYAN)Dev Docker (containerised, hot-reload, detached)$(RESET)"
	@echo -e "    make dev-docker         Build dev images and start all containers"
	@echo -e "    make dev-docker-up      Start dev containers without rebuilding"
	@echo -e "    make dev-docker-down    Stop dev containers"
	@echo -e "    make dev-docker-restart Rebuild and restart dev containers"
	@echo -e "    make dev-docker-status  Show dev container status"
	@echo -e "    make dev-docker-logs    Tail logs from all dev containers"
	@echo -e ""
	@echo -e "  $(CYAN)Build$(RESET)"
	@echo -e "    make build          Build gateway + ai-core + worker"
	@echo -e "    make build-gateway  Build gateway"
	@echo -e "    make build-ai-core  Build ai-core"
	@echo -e "    make build-worker   Build worker"
	@echo -e ""
	@echo -e "  $(CYAN)Production (Docker Compose)$(RESET)"
	@echo -e "    make prod           Build images and start all containers"
	@echo -e "    make prod-up        Start containers (no rebuild)"
	@echo -e "    make prod-down      Stop and remove containers"
	@echo -e "    make prod-restart   Rebuild and restart all containers"
	@echo -e "    make prod-status    Show container status"
	@echo -e "    make prod-logs      Tail logs from all containers"
	@echo -e "    make logs-gateway   Tail gateway container logs"
	@echo -e "    make logs-ai-core   Tail ai-core container logs"
	@echo -e "    make logs-worker    Tail worker container logs"
	@echo -e ""
	@echo -e "  $(CYAN)Misc$(RESET)"
	@echo -e "    make install        Install dependencies for all workspaces"
	@echo -e "    make smoke-boot     Run the ai-core boot smoke check"
	@echo -e "    make smoke-agent    Run the ai-core agent smoke check"
	@echo -e "    make smoke-memory   Run the ai-core memory smoke check"
	@echo -e "    make smoke-telegram Run the gateway telegram smoke check"
	@echo -e "    make clean          Remove all dist/ build output"
	@echo -e ""

# ─────────────────────────────────────────────────────────────────────────────
# Dev — watch mode (runs in foreground on the host)
# ─────────────────────────────────────────────────────────────────────────────

dev:
	@echo -e "$(CYAN)Starting gateway, ai-core, worker in dev mode...$(RESET)"
	@$(MAKE) -j3 dev-gateway dev-ai-core dev-worker

dev-gateway:
	@echo -e "$(CYAN)[gateway] Starting in watch mode$(RESET)"
	npm run dev:gateway

dev-ai-core:
	@echo -e "$(CYAN)[ai-core] Starting in watch mode$(RESET)"
	npm run dev:ai-core

dev-worker:
	@echo -e "$(CYAN)[worker] Starting in watch mode$(RESET)"
	npm run dev:worker

# ─────────────────────────────────────────────────────────────────────────────
# Dev Docker — containerised with hot-reload, uses docker/docker-compose.dev.yml
# ─────────────────────────────────────────────────────────────────────────────

DEV_COMPOSE := docker compose -f docker/docker-compose.dev.yml

dev-docker:
	@echo -e "$(CYAN)Building dev images and starting containers (hot-reload)...$(RESET)"
	$(DEV_COMPOSE) down --remove-orphans
	$(DEV_COMPOSE) up -d --build

dev-docker-up:
	@echo -e "$(CYAN)Starting dev containers...$(RESET)"
	$(DEV_COMPOSE) up -d

dev-docker-down:
	@echo -e "$(CYAN)Stopping dev containers...$(RESET)"
	$(DEV_COMPOSE) down

dev-docker-restart:
	@echo -e "$(CYAN)Rebuilding and restarting dev containers...$(RESET)"
	$(DEV_COMPOSE) down --remove-orphans
	$(DEV_COMPOSE) up -d --build

dev-docker-status:
	$(DEV_COMPOSE) ps

dev-docker-logs:
	$(DEV_COMPOSE) logs -f

# ─────────────────────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────────────────────

build: build-gateway build-ai-core build-worker

build-gateway:
	@echo -e "$(CYAN)[gateway] Building...$(RESET)"
	npm run build -w apps/gateway

build-ai-core:
	@echo -e "$(CYAN)[ai-core] Building...$(RESET)"
	npm run build -w apps/ai-core

build-worker:
	@echo -e "$(CYAN)[worker] Building...$(RESET)"
	npm run build -w apps/worker

# ─────────────────────────────────────────────────────────────────────────────
# Production — Docker Compose
# ─────────────────────────────────────────────────────────────────────────────

PROD_COMPOSE := docker compose -f docker/docker-compose.prod.yml --env-file .env.production

prod:
	@echo -e "$(CYAN)Building images (old containers stay up during build)...$(RESET)"
	$(PROD_COMPOSE) build
	@echo -e "$(CYAN)Swapping in new containers...$(RESET)"
	$(PROD_COMPOSE) up -d

prod-up:
	@echo -e "$(CYAN)Starting containers (no rebuild)...$(RESET)"
	$(PROD_COMPOSE) up -d

prod-down:
	@echo -e "$(CYAN)Stopping containers...$(RESET)"
	$(PROD_COMPOSE) down

prod-restart:
	@echo -e "$(CYAN)Rebuilding images (old containers stay up during build)...$(RESET)"
	$(PROD_COMPOSE) build
	@echo -e "$(CYAN)Swapping in new containers...$(RESET)"
	$(PROD_COMPOSE) up -d

prod-status:
	$(PROD_COMPOSE) ps

prod-logs:
	$(PROD_COMPOSE) logs -f

logs-gateway:
	$(PROD_COMPOSE) logs -f gateway

logs-ai-core:
	$(PROD_COMPOSE) logs -f ai-core

logs-worker:
	$(PROD_COMPOSE) logs -f worker

# ─────────────────────────────────────────────────────────────────────────────
# Misc
# ─────────────────────────────────────────────────────────────────────────────

install:
	@echo -e "$(CYAN)Installing dependencies for all workspaces...$(RESET)"
	npm install

smoke-boot:
	npm run smoke:boot

smoke-agent:
	npm run smoke:agent

smoke-memory:
	npm run smoke:memory

smoke-telegram:
	npm run smoke:telegram

smoke-automemory:
	npm run smoke:automemory

clean:
	@echo -e "$(CYAN)Removing dist/ build output...$(RESET)"
	rm -rf apps/gateway/dist apps/ai-core/dist apps/worker/dist shared/dist
