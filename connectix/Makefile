.PHONY: help setup up down dev test precommit act reset psql tunnel tunnel-url

# ── Config (override on the CLI or in .env) ─────────────────────────────────
# Postgres port. compose publishes it and mix connects to it, so one value
# drives both. Read from .env so `make dev` needs no prefix; falls back to the
# standard 5432, which is what CI and a clean machine use.
PGPORT ?= $(shell sed -n 's/^PGPORT=//p' .env 2>/dev/null | grep . | head -1 | tr -d '\r"')
PGPORT := $(if $(PGPORT),$(PGPORT),5432)

# Phoenix HTTP port. Override when something else already owns 4000.
PHX_PORT ?= $(shell sed -n 's/^PHX_PORT=//p' .env 2>/dev/null | grep . | head -1 | tr -d '\r"')
PHX_PORT := $(if $(PHX_PORT),$(PHX_PORT),4000)

# Neither port is exported for mix: config/runtime.exs reads PGPORT and
# PHX_PORT itself after Dotenvy loads `.env`. Exporting PHX_PORT is only so a
# CLI override (`PHX_PORT=4001 make dev`) reaches runtime.exs as well.
export PHX_PORT

.DEFAULT_GOAL := help

help: ## Show this help
	@awk 'BEGIN{FS=":.*## ";printf "\nmake \033[36m<target>\033[0m\n\n"} \
	      /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-12s\033[0m %s\n",$$1,$$2}' $(MAKEFILE_LIST)
	@printf "\n  postgres :%s   phoenix :%s\n\n" "$(PGPORT)" "$(PHX_PORT)"

setup: up ## First run: deps, database, assets
	@test -f .env || cp .envrc.example .env
	mix setup

dev: up ## Run the server (the usual loop)
	mix phx.server

test: up ## Run the test suite
	mix test

precommit: up ## Everything CI checks, plus the tests
	mix precommit

act: ## Run the CI job locally (needs port 5432 free)
	@command -v $(ACT) >/dev/null 2>&1 || { echo "act is not installed; see https://nektosact.com/installation"; exit 1; }
	$(ACT) push -W .github/workflows/elixir.yml -j test $(ACT_ARGS)

up: ## Start Postgres and wait for it
	@docker compose up -d
	@printf "postgres :$(PGPORT) "
	@for i in $$(seq 1 30); do \
	  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then echo "ready"; exit 0; fi; \
	  printf "."; sleep 1; \
	done; echo "TIMEOUT"; exit 1

down: ## Stop Postgres (the pgdata volume is kept)
	docker compose down

reset: up ## Drop, recreate, migrate and seed the database
	mix ecto.reset

psql: ## Open a psql shell on the dev database
	docker compose exec db psql -U postgres -d connectix_dev

tunnel: ## Start the ngrok tunnel (needs NGROK_AUTHTOKEN in .env)
	PHX_PORT=$(PHX_PORT) docker compose --profile tunnel up -d ngrok
	@sleep 3
	@$(MAKE) --no-print-directory tunnel-url

tunnel-url: ## Print the current public ngrok URL
	@url=$$(curl -s --max-time 3 http://localhost:4040/api/tunnels 2>/dev/null \
	  | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4); \
	if [ -n "$$url" ]; then \
	  echo "$$url"; \
	  echo "webhook: $$url/webhooks/whatsapp"; \
	else \
	  echo "no tunnel running — try: make tunnel"; \
	fi

# Local GitHub Actions runner. `--env-file /dev/null` is deliberate: without it
# act loads .env, which holds real API keys, into the CI container — and the
# workflow sets every key to "invalid" on purpose so the suite stays hermetic.
ACT ?= act
ACT_PLATFORM ?= catthehacker/ubuntu:act-latest
ACT_ARGS = -P ubuntu-latest=$(ACT_PLATFORM) --container-architecture linux/amd64 --pull=false --bind --env-file /dev/null
