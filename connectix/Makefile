.PHONY: help setup dev test precommit act tunnel tunnel-url

# ── Config (override on the CLI or in .env) ─────────────────────────────────
# NO DATABASE TARGETS. There is no server to start, wait for, reset or open a
# shell on: Mnesia is in the BEAM and the event store is a DuckDB file, both
# under CONNECTIX_DATA_DIR. `up`, `down`, `reset` and `psql` are gone with the
# Postgres that 39c92198 dropped, and every target below runs directly.
#
# Phoenix HTTP port. Override when something else already owns 4000.
PHX_PORT ?= $(shell sed -n 's/^PHX_PORT=//p' .env 2>/dev/null | grep . | head -1 | tr -d '\r"')
PHX_PORT := $(if $(PHX_PORT),$(PHX_PORT),4000)

# Not exported for mix: config/runtime.exs reads PHX_PORT itself after Dotenvy
# loads `.env`. Exporting it is only so a CLI override
# (`PHX_PORT=4001 make dev`) reaches runtime.exs as well.
export PHX_PORT

.DEFAULT_GOAL := help

help: ## Show this help
	@awk 'BEGIN{FS=":.*## ";printf "\nmake \033[36m<target>\033[0m\n\n"} \
	      /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-12s\033[0m %s\n",$$1,$$2}' $(MAKEFILE_LIST)
	@printf "\n  phoenix :%s\n\n" "$(PHX_PORT)"

setup: ## First run: deps and assets
	@test -f .env || cp .envrc.example .env
	mix setup

dev: ## Run the server (the usual loop)
	mix phx.server

test: ## Run the test suite
	mix test

precommit: ## Everything CI checks, plus the tests
	mix precommit

act: ## Run the CI job locally
	@command -v $(ACT) >/dev/null 2>&1 || { echo "act is not installed; see https://nektosact.com/installation"; exit 1; }
	$(ACT) push -W .github/workflows/elixir.yml -j test $(ACT_ARGS)

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
