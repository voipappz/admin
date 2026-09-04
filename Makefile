.PHONY: help env dev check-engine check-mothership up down logs build lint unit portal-compile portal-test verify test test-cable act-cable probe act act-portal push status module prod prod-down portal-print portal-deploy

# Everything runs in Docker — no host node/npm/ruby required. One-off npm/node
# commands reuse the react-app service (repo mount + cached node_modules volume).
NPM_RUN := docker compose run --rm --no-deps react-app bash -c
ACT ?= act
ACT_PLATFORM ?= catthehacker/ubuntu:act-latest

# ── Config (override on the CLI or in .env) ─────────────────────────────────
# The API the LOCAL Elixir portal forwards to. Vite no longer talks to the API
# directly: it proxies every backend request to the portal, and the portal owns
# the upstream hop. Keep this resolution identical to docker-compose.yml.
PORTAL_ENGINE_URL ?= $(shell sed -n 's/^PORTAL_ENGINE_URL=//p' .env 2>/dev/null | grep . | head -1 | tr -d '\r"')
PORTAL_ENGINE_URL := $(if $(PORTAL_ENGINE_URL),$(PORTAL_ENGINE_URL),http://127.0.0.1:5000)

# Cable's ApiProxy must belong to the same API as the portal. A separate value
# remains available for the rare remote-node case, but the coherent default is
# the portal engine rather than an unrelated production tenant.
CABLE_API_URL ?= $(shell sed -n 's/^CABLE_API_URL=//p' .env 2>/dev/null | grep . | head -1 | tr -d '\r"')
CABLE_API_URL := $(if $(CABLE_API_URL),$(CABLE_API_URL),$(PORTAL_ENGINE_URL))

# Local stack endpoints. PORTAL is the origin: the SPA, the Chrome extension
# (which lives in ../chrome and builds with `make -C ../chrome build`)
# and Vite's proxy all point at 4001, and it does not move.
PORTAL   ?= http://localhost:4001
# The cable the portal SUBSCRIBES to. There is no cable in this stack any more:
# va-crystal was removed from docker-compose.yml, because what the portal needs
# is one WebSocket endpoint and running a node beside it meant a whole switch on
# the box. The portal dials a real node instead, and the coherent choice is the
# node belonging to PORTAL_ENGINE_URL — a cable on one server and an API on
# another verify with different secrets and fail as "closed before welcome".
PORTAL_CABLE_URL ?= $(shell sed -n 's/^PORTAL_CABLE_URL=//p' .env 2>/dev/null | grep . | head -1 | tr -d '\r"')
PORTAL_CABLE_URL := $(if $(PORTAL_CABLE_URL),$(PORTAL_CABLE_URL),ws://127.0.0.1:4100/cable)
# The cable's /health lives on the same host and port over plain HTTP.
CABLE_HEALTH := $(shell printf '%s' '$(PORTAL_CABLE_URL)' | sed -E 's|^wss?://|http://|; s|/cable$$|/health|')
API_CONTAINER ?= va-app

# The portal mints its own cable credential, and SECRET_KEY is what it signs
# with. IT MUST BE THE SIGNING SECRET OF THE SERVER THAT OWNS THE CABLE — the
# node verifies with its own SECRET_KEY, so a token signed with anything else is
# refused at connect time, and cable has no frame for "wrong secret": the socket
# closes before `welcome`, which is indistinguishable from a dead network.
#
# .env WINS OVER THE LOCAL API CONTAINER, and that order is the whole point now
# that the cable is remote. Reading it from a local `va-app` would hand the
# portal the LOCAL API's secret while it dials someone else's node — every
# connection refused, for a reason nothing prints. The container is a last
# resort, for the all-local case where it is the right value.
SECRET_KEY ?= $(shell sed -n 's/^SECRET_KEY=//p' .env 2>/dev/null | grep . | head -1 | tr -d '\r"')

# NATS is deliberately absent: the portal holds no broker connection (it reads
# events off the cable), and the only thing in this stack that ever needed
# credentials was the cable container that no longer exists.
STACK_UP = key="$${SECRET_KEY:-$(SECRET_KEY)}"; \
	  if [ -z "$$key" ]; then key=$$(docker exec $(API_CONTAINER) printenv SECRET_KEY 2>/dev/null); fi; \
	  if [ -z "$$key" ]; then \
	    echo "no SECRET_KEY — the portal cannot mint a cable credential without it,"; \
	    echo "and $(PORTAL_CABLE_URL) will close every connection before welcome."; \
	    echo "set it in .env (the signing secret of $(PORTAL_ENGINE_URL)),"; \
	    echo "or pass it yourself:  SECRET_KEY=... make <target>"; \
	    exit 1; \
	  fi; \
	  SECRET_KEY="$$key" \
	    PORTAL_ENGINE_URL="$(PORTAL_ENGINE_URL)" CABLE_API_URL="$(CABLE_API_URL)" \
	    PORTAL_CABLE_URL="$(PORTAL_CABLE_URL)" \
	    docker compose up -d
WEB_APP  ?= http://localhost:4200

# Production URL for `make status` — set PROD_URL in .env (or on the CLI).
PROD_URL ?= $(shell sed -n 's/^PROD_URL=//p' .env 2>/dev/null | head -1 | tr -d '\r"')

.DEFAULT_GOAL := help

help: ## Show this help
	@awk 'BEGIN{FS=":.*## ";printf "\nmake \033[36m<target>\033[0m\n\n"} \
	      /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n",$$1,$$2}' $(MAKEFILE_LIST)

env: ## Create .env (never overwrites an existing one)
	@if [ -f .env ]; then \
	  echo ".env exists — leaving it alone. Local portal engine: $(PORTAL_ENGINE_URL)"; \
	else \
	  cp .env.example .env && echo "wrote .env — set PORTAL_ENGINE_URL if the local API is not on :5000"; \
	fi

dev: check-engine ## Run the whole local stack in Docker (Vite :4200 · portal :4001), attached logs
	@$(STACK_UP) react-app elixir
	@echo "portal → $(PORTAL) · cable → $(PORTAL_CABLE_URL)"
	@echo "Vite → $(WEB_APP) → portal → engine $(PORTAL_ENGINE_URL)"
	@echo "extension → ../chrome (make -C ../chrome build, then Load unpacked)"
	@echo "Ctrl-C detaches; stack keeps running"
	docker compose logs -f react-app elixir

check-engine: ## Verify the local portal's API upstream is reachable
	@echo "==> Portal engine (override: PORTAL_ENGINE_URL=https://<host>)"
	@code=$$(curl -s -o /dev/null -w '%{http_code}' "$(PORTAL_ENGINE_URL)/tasks/customer_portal_data" --max-time 5); \
	  case $$code in \
	    [234]*) printf "  %-11s %-34s OK (%s)\n" "engine" "$(PORTAL_ENGINE_URL)" "$$code";; \
	    *) printf "  %-11s %-34s UNREACHABLE (%s)\n" "engine" "$(PORTAL_ENGINE_URL)" "$$code"; \
	       echo "  start the local API or set PORTAL_ENGINE_URL in .env"; exit 1;; \
	  esac

# Compatibility for scripts and muscle memory from before Vite's upstream
# moved behind the portal. It deliberately does not appear in `make help`.
check-mothership: check-engine

up: ## Start the full Docker stack (web + portal)
	@$(STACK_UP) react-app elixir
	@echo "web → $(WEB_APP)   portal → $(PORTAL)"

down: ## Stop all services
	docker compose down --remove-orphans

logs: ## Follow logs for every service in the local stack
	docker compose logs -f react-app elixir

# --user: the scaffolder writes into the repo mount and the container is root,
# so without it the new files land root-owned and you need sudo to edit or
# delete your own scaffold. Safe here (unlike build/lint/unit) because this
# command only writes source files — it never touches the node_modules volume.
module: ## Scaffold a feature module: make module NAME=Foo [ENDPOINT=/api/foos]
	@test -n "$(NAME)" || { echo "usage: make module NAME=Foo [ENDPOINT=/api/foos]"; exit 1; }
	docker compose run --rm --no-deps --user "$(shell id -u):$(shell id -g)" \
	  react-app node scripts/new-module.mjs "$(NAME)" "$(ENDPOINT)"

build: ## Production build → dist/ (in Docker)
	$(NPM_RUN) 'npm install --loglevel=error --no-audit --no-fund && npm run build'

lint: ## ESLint (in Docker)
	$(NPM_RUN) 'npm install --loglevel=error --no-audit --no-fund && npm run lint'

unit: ## Vitest unit tests, one-shot (in Docker)
	$(NPM_RUN) 'npm install --loglevel=error --no-audit --no-fund && npm run test:run'

portal-compile: ## Compile the Elixir portal with warnings as errors (running stack required)
	docker compose exec -T -e MIX_ENV=test elixir mix compile --warnings-as-errors

portal-test: ## Run ExUnit in the Elixir container (TEST=path:line for a targeted run)
	docker compose exec -T -e MIX_ENV=test elixir mix test $(TEST)

prod: ## Deploy via docker compose: build + run the production image (:8000)
	docker compose --profile prod build production
	docker compose --profile prod up -d production
	@echo "waiting for readiness..."; ready=0; for i in $$(seq 1 60); do \
	  if curl -sf -o /dev/null localhost:8000/health/ready; then ready=1; break; fi; sleep 1; done; \
	  if [ "$$ready" != 1 ]; then \
	    echo "production did not become ready within 60s"; \
	    docker compose --profile prod logs --tail 80 production; exit 1; \
	  fi
	@failed=0; for path in / /health/alive /health/ready; do \
	  code=$$(curl -s -o /dev/null -w '%{http_code}' "localhost:8000$$path"); \
	  printf "  %-14s → %s\n" "$$path" "$$code"; \
	  [ "$$code" = 200 ] || failed=1; \
	 done; exit $$failed
	@echo "production → http://localhost:8000  (env from .env; recreate to re-read)"

prod-down: ## Stop the docker compose production container
	docker compose --profile prod down production

verify: ## Health check: the portal's probes and the Vite dev server
	@echo "==> Services"
	@failed=0; \
	  probe() { name="$$1"; url="$$2"; label="$$3"; \
	    printf "  %-9s %-30s " "$$name" "$$label"; \
	    if curl -sf -o /dev/null "$$url"; then echo OK; else echo DOWN; failed=1; fi; \
	  }; \
	  probe portal "$(PORTAL)/health/alive" "$(PORTAL)/health/alive"; \
	  probe ready "$(PORTAL)/health/ready" "$(PORTAL)/health/ready"; \
	  probe web/vite "$(WEB_APP)/" "$(WEB_APP)/"; \
	  probe cable "$(CABLE_HEALTH)" "$(PORTAL_CABLE_URL)"; \
	  exit $$failed

test: ## Playwright E2E in Docker (needs the app running — make up / make dev)
	docker compose --profile test run --rm e2e

# The relay direction through the REAL chain — its own stack on 14xxx (a
# broker, a va-crystal node, the production portal image) beside whatever
# `make dev` is running, then the scenarios in tests/cable-events.spec.ts and
# the extension's portal-receive.spec.ts. Contract: docs/cable-events-spec.md.
#
# Runs on the HOST: the restart scenarios drive docker, and the extension half
# needs a real Chrome with the unpacked extension — neither exists inside the
# e2e image. Node < 22 has no global WebSocket, hence the flag. Point
# VA_CRYSTAL_IMAGE at a locally built node when the published one is behind.
CABLE_EVENTS_COMPOSE = docker compose -f tests/cable-events/docker-compose.yml
test-cable: ## The real chain (NATS → node → portal → extension): make test-cable [VA_CRYSTAL_IMAGE=…]
	@trap '$(CABLE_EVENTS_COMPOSE) down -v --remove-orphans >/dev/null 2>&1' EXIT; \
	  $(CABLE_EVENTS_COMPOSE) up -d --build && \
	  tests/cable-events/ready.sh && \
	  CABLE_EVENTS=1 NODE_OPTIONS=--experimental-websocket npx playwright test tests/cable-events.spec.ts --workers=1 --output=/tmp/cable-events-pw
	@echo
	@echo "the extension half lives with the extension:"
	@echo "  make -C ../chrome build && (cd ../chrome && CABLE_EVENTS=1 npx playwright test portal-receive)"

act-cable: ## The cable-events CI job locally with act (VA_CRYSTAL_IMAGE is passed through)
	ACT_BIN="$(ACT)" ACT_RUNNER_IMAGE="$(ACT_PLATFORM)" scripts/ci-local.sh cable-events

# Through the PORTAL, not straight at cable: that is the path the browser and
# the extension take, and it covers the two hops that fail most often — NATS
# token verification and the portal's own cable credential.
probe: ## Probe /ws/events with a real session: make probe AUTH='<localStorage.auth>'
	@docker run --rm --network host \
	  -e AUTH='$(AUTH)' -e TOKEN='$(TOKEN)' -e ID='$(ID)' \
	  -e PORTAL_URL='$(PORTAL)' -e SECONDS='$(SECONDS)' \
	  -v "$(PWD)/scripts:/s:ro" node:22-alpine \
	  node /s/portal-probe.mjs

act-portal: ## Run the Elixir portal CI job locally with act
	ACT_BIN="$(ACT)" ACT_RUNNER_IMAGE="$(ACT_PLATFORM)" scripts/ci-local.sh portal

act: ## Run the complete GitHub Actions workflow locally (same pattern as ../cli)
	ACT_BIN="$(ACT)" ACT_RUNNER_IMAGE="$(ACT_PLATFORM)" scripts/ci-local.sh all

# Deploying is INVOKED from here and DECIDED in mothership.
#
# Until 2026-08-31 this Makefile carried the whole Kamal setup, and config/ held
# deploy.yml plus one override per tenant. Both moved to the mothership repo,
# under config/portal/ — deciding WHERE the portal lands needs the view of every
# destination at once, and mothership is the only place that has it. The policy
# stays there for a second reason: config/portal/.kamal holds real secrets (the
# registry PAT, TLS keys), and THIS is the repo a customer forks.
#
# The targets below are wrappers so you do not have to `cd ../mothership` — the
# implementation is `voipappz portal deploy`, and there is exactly one copy of
# it (installer/cli/src/commands/portal.cr). Two things have to be true, and
# both are what made this fail when run by hand from here:
#
#   * VA_PROJECT_DIR — the CLI finds the deploy policy by walking up from $PWD
#     for docker-compose.yaml. THIS repo's file is docker-compose.yml, so the
#     walk finds nothing and conf_dir lands on a config/portal that is not here.
#   * ../mothership/bin/voipappz — NOT the `voipappz` on PATH. That one is an
#     installed node CLI with no `portal` verb at all, so `voipappz portal
#     deploy` silently prints top-level help and exits 0.
#
#     make portal-deploy               # default destination
#     make portal-deploy DEST=nimbus   # a tenant, per config/portal/portal-destinations.tsv
#     make portal-print  DEST=nimbus   # print exact Kamal commands, read-only
#
# Kamal mounts this sibling checkout as its build context, so the image is built
# from THIS checkout at THIS sha: the deploy stamps VITE_APP_VERSION from the
# commit you have here — including uncommitted work, which is the build context.
#
# `make deploy` is deliberately NOT defined: in mothership `deploy` means
# "provision a remote host over SSH", and the names must not collide.

VA_MOTHERSHIP ?= $(abspath $(CURDIR)/../mothership)
PORTAL_CLI     = VA_PROJECT_DIR=$(VA_MOTHERSHIP) $(VA_MOTHERSHIP)/bin/voipappz

# The binary is built by mothership's own `make build`; a fresh clone has none.
define portal_cli_guard
	@test -d "$(VA_MOTHERSHIP)" || { \
	  echo "!! no mothership checkout at $(VA_MOTHERSHIP)" >&2; \
	  echo "   git clone <mothership> $(VA_MOTHERSHIP)   # or set VA_MOTHERSHIP=" >&2; \
	  exit 1; }
	@test -x "$(VA_MOTHERSHIP)/bin/voipappz" || $(MAKE) -C "$(VA_MOTHERSHIP)" build
endef

portal-print: ## Print the exact Kamal commands, change nothing — make portal-print DEST=mtn
	$(portal_cli_guard)
	$(PORTAL_CLI) portal deploy --print $(if $(DEST),-d $(DEST))

portal-deploy: ## Build, push and swap the portal container — make portal-deploy DEST=mtn
	$(portal_cli_guard)
	$(PORTAL_CLI) portal deploy $(if $(DEST),-d $(DEST))

push: ## git push current branch to origin
	git push

status: ## Local git + production health + deployed version
	@echo "=== Local git ==="
	@git log --oneline -1
	@git status -sb
	@echo
	@if [ -z "$(PROD_URL)" ]; then \
	  echo "=== Production: PROD_URL not set (skip) — set PROD_URL in .env ==="; \
	else \
	  echo "=== Production ($(PROD_URL)) ==="; \
	  curl -s -o /dev/null -w "GET /health/alive → %{http_code}\n" "$(PROD_URL)/health/alive"; \
	  curl -s -o /dev/null -w "GET /health/ready → %{http_code}\n" "$(PROD_URL)/health/ready"; \
	  curl -s -o /dev/null -w "GET /             → %{http_code}\n" "$(PROD_URL)/"; \
	  echo "=== Deployed version ==="; \
	  curl -s "$(PROD_URL)/" | grep -oE 'src="/assets/[^"]+\.js"' | head -1 | sed 's/src="//;s/"//' \
	    | xargs -I{} curl -s "$(PROD_URL){}" | grep -oE '2026\.[0-9.]+-[a-f0-9]+' | sort -u | head -1; \
	fi
