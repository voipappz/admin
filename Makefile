.PHONY: help env dev check-mothership up down build lint unit verify test test-chrome chrome-build chrome-serve cable cable-down probe act act-portal push status tmux module prod prod-down

# Everything runs in Docker — no host node/npm/ruby required. One-off npm/node
# commands reuse the react-app service (repo mount + cached node_modules volume).
NPM_RUN := docker compose run --rm --no-deps react-app bash -c
ACT ?= act
ACT_PLATFORM ?= catthehacker/ubuntu:act-latest

# ── Config (override on the CLI or in .env) ─────────────────────────────────
# The mothership base, resolved exactly as vite.config.js does so the preflight
# always probes the host Vite actually proxies to: VITE_API_TARGET wins, else
# MOTHERSHIP_URL. Two seds, not one alternation — an alternation matches by line
# order in .env, not by precedence, so it could report OK against the wrong host.
MOTHERSHIP ?= $(shell sed -n 's/^VITE_API_TARGET=//p' .env 2>/dev/null | grep . | head -1 | tr -d '\r"')
MOTHERSHIP := $(if $(MOTHERSHIP),$(MOTHERSHIP),$(shell sed -n 's/^MOTHERSHIP_URL=//p' .env 2>/dev/null | grep . | head -1 | tr -d '\r"'))
MOTHERSHIP := $(if $(MOTHERSHIP),$(MOTHERSHIP),https://cloud.voipappz.io)

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
STACK_UP = key=$$(docker exec $(API_CONTAINER) printenv SECRET_KEY 2>/dev/null); \
	  if [ -z "$$key" ]; then \
	    echo "no SECRET_KEY from container '$(API_CONTAINER)' — is the API running?"; \
	    echo "without it cable refuses every connection and the portal refuses every token."; \
	    echo "start the API, or pass it yourself:  SECRET_KEY=... make <target>"; \
	    exit 1; \
	  fi; \
	  nats=$$(docker exec $(API_CONTAINER) printenv NATS_URL 2>/dev/null \
	          | sed -E 's|@[^:/]+:|@127.0.0.1:|'); \
	  SECRET_KEY="$$key" NATS_URL="$$nats" docker compose --profile cable up -d
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

# Production URL for `make status` — set PROD_URL in .env (or on the CLI).
PROD_URL ?= $(shell sed -n 's/^PROD_URL=//p' .env 2>/dev/null | head -1 | tr -d '\r"')

.DEFAULT_GOAL := help

help: ## Show this help
	@awk 'BEGIN{FS=":.*## ";printf "\nmake \033[36m<target>\033[0m\n\n"} \
	      /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n",$$1,$$2}' $(MAKEFILE_LIST)

env: ## Create .env (never overwrites an existing one)
	@if [ -f .env ]; then \
	  echo ".env exists — leaving it alone. Mothership: $(MOTHERSHIP)"; \
	else \
	  cp .env.example .env && echo "wrote .env — set MOTHERSHIP_URL to point at your tenant"; \
	fi

dev: check-mothership ## Run the whole local stack in Docker (Vite :4200 · portal :4001 · cable :4100 · extension), attached logs
	@$(STACK_UP) react-app elixir cable chrome-ext
	@echo "portal → $(PORTAL) · cable → ws://127.0.0.1:$(CABLE_PORT)/cable"
	@echo "Vite → $(WEB_APP) (proxies /api → mothership $(MOTHERSHIP))"
	@echo "extension → $(EXT_DIST) (chrome://extensions → Load unpacked; sign in with domain $(PORTAL))"
	@echo "Ctrl-C detaches; stack keeps running"
	docker compose logs -f react-app elixir chrome-ext

check-mothership: ## Verify the mothership (MOTHERSHIP_URL) is reachable
	@echo "==> Mothership (override: MOTHERSHIP=https://<host>)"
	@code=$$(curl -s -o /dev/null -w '%{http_code}' "$(MOTHERSHIP)/tasks/customer_portal_data" --max-time 5); \
	  case $$code in [234]*) s="OK ($$code)";; *) s="UNREACHABLE ($$code) — set MOTHERSHIP_URL in .env";; esac; \
	  printf "  %-11s %-34s %s\n" "mothership" "$(MOTHERSHIP)" "$$s"

up: ## Start the full Docker stack (web + portal + cable + extension)
	@$(STACK_UP) react-app elixir cable chrome-ext
	@echo "web → $(WEB_APP)   portal → $(PORTAL)   extension → $(EXT_DIST)"

down: ## Stop all services
	docker compose --profile cable down --remove-orphans

tmux: ## Open the dev cockpit (tmuxinator: stack + logs + shells)
	@command -v tmuxinator >/dev/null || { echo "tmuxinator not installed (gem install tmuxinator)"; exit 1; }
	tmuxinator local

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

prod: ## Deploy via docker compose: build + run the production image (:8000)
	docker compose --profile prod build production
	docker compose --profile prod up -d production
	@echo "waiting for boot..."; for i in $$(seq 1 60); do \
	  curl -sf -o /dev/null localhost:8000/health/alive && break; sleep 1; done
	@curl -s -o /dev/null -w "  /             → %{http_code}\n" localhost:8000/
	@curl -s -o /dev/null -w "  /health/alive → %{http_code}\n" localhost:8000/health/alive
	@curl -s -o /dev/null -w "  /health/ready → %{http_code}\n" localhost:8000/health/ready
	@echo "production → http://localhost:8000  (env from .env; recreate to re-read)"

prod-down: ## Stop the docker compose production container
	docker compose --profile prod down production

verify: ## Health check: the portal's probes and the Vite dev server
	@echo "==> Services"
	@printf "  %-9s %-30s " "portal" "$(PORTAL)/health/alive"; curl -sf -o /dev/null "$(PORTAL)/health/alive" && echo OK || echo DOWN
	@printf "  %-9s %-30s " "ready"  "$(PORTAL)/health/ready"; curl -sf -o /dev/null "$(PORTAL)/health/ready" && echo OK || echo "NOT READY"
	@printf "  %-9s %-30s " "web/vite" "$(WEB_APP)/";          curl -sf -o /dev/null "$(WEB_APP)/"            && echo OK || echo DOWN
	@printf "  %-9s %-30s " "cable" "ws://127.0.0.1:$(CABLE_PORT)"; curl -sf -o /dev/null "http://127.0.0.1:$(CABLE_PORT)/health" && echo OK || echo DOWN

test: ## Playwright E2E in Docker (needs the app running — make up / make dev)
	docker compose --profile test run --rm e2e

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
#     make portal-config DEST=nimbus   # render and verify, read-only
#
# mothership links this repo in at apps/portal and mounts it as the build
# context, so the image is still built from THIS checkout at THIS sha:
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
	  curl -s -o /dev/null -w "GET /      → %{http_code}\n" $(PROD_URL)/; \
	  curl -s -o /dev/null -w "GET /test  → %{http_code}\n" $(PROD_URL)/test; \
	  echo "=== Deployed version ==="; \
	  curl -s $(PROD_URL)/ | grep -oE 'src="/assets/[^"]+\.js"' | head -1 | sed 's/src="//;s/"//' \
	    | xargs -I{} curl -s "$(PROD_URL){}" | grep -oE '2026\.[0-9.]+-[a-f0-9]+' | sort -u | head -1; \
	fi
