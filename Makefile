.PHONY: help env dev check-engine check-mothership up down logs build lint unit portal-compile portal-test verify test test-cable act-cable test-chrome chrome-build chrome-serve cable cable-down probe act act-portal push status module prod prod-down

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
# and Vite's proxy all point at 4001, and it does not move.
PORTAL   ?= http://localhost:4001
# The cable's port and where its signing secret comes from. 4100, not 4000: an
# installed node already owns 4000 on a dev box, and `SECRET_KEY ?=` lets the
# environment win so a developer without the API container can still pass one.
CABLE_PORT ?= 4100
API_CONTAINER ?= va-app

# Both the cable and the portal need the API's signing secret and its NATS
# credentials, and NEITHER belongs in this repo — they are read out of the
# running API container at start time and passed as environment, never as
# arguments. The NATS host is rewritten because the containers below use host
# networking, where the API's own `nats:4222` does not resolve. The sed uses
# `|` as its delimiter, not `#`: make strips `#` and everything after it inside
# a VARIABLE definition (not inside a recipe), which truncated the line mid
# quote and failed as "Unterminated quoted string" with nothing pointing here.
#
# Refusing to start without the secret is the point: cable would otherwise come
# up, answer /health, and reject every connection, and the portal would refuse
# every token — both of which look like a broken network from the client.
STACK_UP = key="$${SECRET_KEY:-}"; \
	  if [ -z "$$key" ]; then key=$$(docker exec $(API_CONTAINER) printenv SECRET_KEY 2>/dev/null); fi; \
	  if [ -z "$$key" ]; then \
	    echo "no SECRET_KEY from container '$(API_CONTAINER)' — is the API running?"; \
	    echo "without it cable refuses every connection and the portal refuses every token."; \
	    echo "start the API, or pass it yourself:  SECRET_KEY=... make <target>"; \
	    exit 1; \
	  fi; \
	  nats="$${NATS_URL:-}"; \
	  if [ -z "$$nats" ]; then \
	    nats=$$(docker exec $(API_CONTAINER) printenv NATS_URL 2>/dev/null \
	            | sed -E 's|@[^:/]+:|@127.0.0.1:|'); \
	  fi; \
	  if [ -z "$$nats" ]; then \
	    echo "no NATS_URL from container '$(API_CONTAINER)' — token verification and realtime would be disabled."; \
	    echo "start the API, or pass it yourself:  NATS_URL=... make <target>"; \
	    exit 1; \
	  fi; \
	  SECRET_KEY="$$key" NATS_URL="$$nats" \
	    PORTAL_ENGINE_URL="$(PORTAL_ENGINE_URL)" CABLE_API_URL="$(CABLE_API_URL)" \
	    docker compose --profile cable up -d
WEB_APP  ?= http://localhost:4200
# The Chrome extension's artefact. Chrome loads an extension from a DIRECTORY,
# never over HTTP, so this path — not a port — is what `make dev` hands you.
# `chrome-ext` keeps it rebuilt; you point "Load unpacked" at it once.
EXT_DIST ?= $(PWD)/chrome/angular/dist
# chrome-ext writes into the repo mount, so it runs as you rather than as root
# (compose reads these; a shell does not export UID/GID on its own).
export UID := $(shell id -u)
export GID := $(shell id -g)
TEST_DOMAIN_CHROME ?= $(PORTAL)
# The popup served as a plain page (chrome-web), for iterating on the UI.
EXT_WEB ?= http://localhost:4300

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

dev: check-engine ## Run the whole local stack in Docker (Vite :4200 · portal :4001 · cable :4100 · extension), attached logs
	@$(STACK_UP) react-app elixir cable chrome-ext chrome-web
	@echo "portal → $(PORTAL) · cable → ws://127.0.0.1:$(CABLE_PORT)/cable"
	@echo "Vite → $(WEB_APP) → portal → engine $(PORTAL_ENGINE_URL)"
	@echo "extension → $(EXT_DIST) (chrome://extensions → Load unpacked)"
	@echo "extension UI → $(EXT_WEB) (the popup as a plain page, hot-reloading)"
	@echo "Ctrl-C detaches; stack keeps running"
	docker compose --profile cable logs -f react-app elixir cable chrome-ext chrome-web

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

up: ## Start the full Docker stack (web + portal + cable + extension)
	@$(STACK_UP) react-app elixir cable chrome-ext chrome-web
	@echo "web → $(WEB_APP)   portal → $(PORTAL)   extension → $(EXT_DIST)   UI → $(EXT_WEB)"

down: ## Stop all services
	docker compose --profile cable down --remove-orphans

logs: ## Follow logs for every service in the local stack
	docker compose --profile cable logs -f react-app elixir cable chrome-ext chrome-web

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
	  probe cable "http://127.0.0.1:$(CABLE_PORT)/health" "ws://127.0.0.1:$(CABLE_PORT)"; \
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
	  CABLE_EVENTS=1 NODE_OPTIONS=--experimental-websocket npx playwright test tests/cable-events.spec.ts --workers=1 --output=/tmp/cable-events-pw && \
	  { [ -f chrome/angular/dist/manifest.json ] || { echo 'build the extension first: make chrome-build'; exit 1; }; } && \
	  cd chrome && CABLE_EVENTS=1 npx playwright test portal-receive --workers=1 --output=/tmp/cable-events-chrome-pw

act-cable: ## The cable-events CI job locally with act (VA_CRYSTAL_IMAGE is passed through)
	ACT_BIN="$(ACT)" ACT_RUNNER_IMAGE="$(ACT_PLATFORM)" scripts/ci-local.sh cable-events

# The popup UI as an ORDINARY web page, for iterating on it without the
# rebuild → chrome://extensions → reload loop. `chrome.*` does not exist there,
# so `angular/src/app/providers/chrome-shim.ts` stands in for it — see that file
# for what is faithful and what is not. Sign in with domain $(PORTAL): the
# portal answers CORS for any origin, so :4300 reaches it same as the extension.
#
# NOT a substitute for `make chrome-build`: the background service worker does
# not run here, so screen-pop notifications do not appear (the realtime socket
# itself does open — frames go to the console).
chrome-serve: ## Run the extension's UI as a plain Angular app on :4300
	@echo "extension UI → http://localhost:4300  (sign in with domain $(PORTAL))"
	docker compose run --rm --no-deps -p 4300:4300 chrome-ext bash -c \
	  '[ -x node_modules/.bin/ng ] || npm ci --legacy-peer-deps --no-audit --no-fund; npm run serve'

chrome-build: ## Build the extension once into chrome/angular/dist (in Docker)
	docker compose run --rm --no-deps chrome-ext bash -c \
	  '[ -x node_modules/.bin/ng ] || npm ci --legacy-peer-deps --no-audit --no-fund; npm run build'
	@echo "extension → $(EXT_DIST)"

# The USER front door, which is NOT the portal account's: the extension posts
# /auth/user_login (users table), and an Account password gets a bare 401 that
# reads as a broken extension. `make onboard` in ../mothership prints the
# credential as "Extension login".
#
# TEST_DOMAIN defaults to the local portal, so the run exercises the real hop
# chain — extension → Elixir :4001 → the API — rather than a cloud node.
# Playwright drives a real Chrome with the unpacked extension loaded, so this
# runs on the host (the e2e image has no extension support wired up).
test-chrome: ## Extension login E2E: make test-chrome TEST_USERNAME=... TEST_PASSWORD=...
	@test -n "$(TEST_USERNAME)" -a -n "$(TEST_PASSWORD)" || { \
	  echo "usage: make test-chrome TEST_USERNAME=<user email> TEST_PASSWORD=<its password>"; \
	  echo "  the USER login (users table), not the portal account —"; \
	  echo "  ../mothership's 'make onboard' prints it as \"Extension login\"."; exit 1; }
	cd chrome && TEST_DOMAIN="$(TEST_DOMAIN_CHROME)" \
	  TEST_USERNAME="$(TEST_USERNAME)" TEST_PASSWORD="$(TEST_PASSWORD)" \
	  npx playwright test user-connect login

cable: ## Start va-crystal's cable locally on :4100 (opt-in; needs va-app running)
	@$(STACK_UP) cable
	@echo "cable → ws://127.0.0.1:$(CABLE_PORT)/cable"
	@echo "logs → docker compose --profile cable logs -f cable"

cable-down: ## Stop the local cable
	docker compose --profile cable rm -sf cable

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

# Deploying is NOT done from this repo.
#
# Until 2026-08-31 this Makefile carried the whole Kamal setup, and config/ held
# deploy.yml plus one override per tenant. Both moved to the mothership repo,
# under config/portal/ — deciding WHERE the portal lands needs the view of every
# destination at once, and mothership is the only place that has it.
#
#     cd ../mothership
#     make portal-deploy               # default destination
#     make portal-deploy DEST=nimbus   # a tenant, per config/portal/portal-destinations.tsv
#     make portal-print DEST=nimbus    # print exact Kamal commands, read-only
#
# mothership mounts this sibling checkout as Kamal's build context, so the
# image is still built from THIS checkout at THIS sha:
# `make portal-deploy` stamps VITE_APP_VERSION from the commit you have here.
#
# What stays here: dev, lint, unit, verify, test, status. Building the app is
# this repo's job; choosing where it ships is not.

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
