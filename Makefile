.PHONY: help help-all urls iex tui tmux tmux-kill mise ci env dev health check-engine check-mothership up down logs build lint unit portal-compile portal-test test test-cable probe act status module portal-print portal-deploy

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

# EIGHT VERBS, and they are the whole daily loop. Everything else this Makefile
# can do is real and stays documented — in `make help-all`, one keystroke away.
# A first page that lists twenty targets asks the reader to already know which
# ones matter, which is the opposite of what a first page is for.
help: ## Show this help
	@printf '\n\033[1mconnectix portal\033[0m\n\n'
	@printf '  \033[36mmake dev\033[0m        start it — Vite :4200 · portal :4001, attached logs\n'
	@printf '  \033[36mmake tmux\033[0m       cockpit: portal, vite and health on one screen\n'
	@printf '  \033[36mmake health\033[0m     is it RECEIVING EVENTS (cable confirmed + store growing)\n'
	@printf '  \033[36mmake urls\033[0m       where this stack actually is\n'
	@printf '  \033[36mmake iex\033[0m        attach a shell to the RUNNING portal (remsh)\n'
	@printf '  \033[36mmake test\033[0m       Playwright E2E (unit: make unit / make portal-test)\n'
	@printf '  \033[36mmake ci\033[0m         CI locally with act (bare `make ci` lists the jobs)\n'
	@printf '  \033[36mmake down\033[0m       stop\n'
	@printf '\n  \033[2mevery other target:  make help-all        traps and why: CLAUDE.md\033[0m\n\n'

# Generated from the `##` comments, so it cannot drift the way a hand-written
# list does — which is exactly why the page above is the one that is curated.
help-all: ## Every documented target
	@printf '\n\033[1mconnectix portal — every target\033[0m\n\n'
	@grep -hE '^[a-zA-Z0-9_-]+:.*##' $(firstword $(MAKEFILE_LIST)) \
	  | sed 's/:.*## /|/' \
	  | awk -F'|' '{ printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2 }'
	@printf '\n'

# Where this stack actually is — resolved, not assumed. Every port is read from
# compose rather than repeated here, because a Makefile that states a port is a
# Makefile that will one day state the wrong one.
urls: ## Print the URLs this stack actually publishes
	@printf '  portal   %s\n' "$$(docker compose ps --status running --format '{{.Service}}' 2>/dev/null | grep -q elixir && echo '$(PORTAL)' || echo 'not running (make dev)')"
	@printf '  web      %s\n' "$$(docker compose ps --status running --format '{{.Service}}' 2>/dev/null | grep -q react-app && echo '$(WEB_APP)' || echo 'not running (make dev)')"
	@printf '  cable    %s\n' "$(PORTAL_CABLE_URL)"
	@printf '  engine   %s\n' "$(PORTAL_ENGINE_URL)"
	@printf '  events   %s\n' "$$(docker compose ps --status running --format '{{.Service}}' 2>/dev/null | grep -q elixir && echo 'make health' || echo '-')"

# A shell INSIDE the running portal, not a new one beside it. `--remsh` attaches
# to the live node, so `Connectix.Events.timeline("<call-uuid>")` or
# `:sys.get_state(Connectix.Realtime.ApiProxy)` answer for the process actually
# serving traffic. `make health` is three fixed questions; this is the rest.
#
# It works because the node is NAMED — see Connectix.Mnesia on why that survived
# the move to RAM-only storage.
iex: ## Attach a shell to the running portal (remsh)
	@docker compose ps --status running --format '{{.Service}}' | grep -q elixir \
	  || { echo "portal is not running — make up"; exit 1; }
	docker compose exec elixir sh -lc \
	  'iex --name console-$$$$@127.0.0.1 --cookie $$(cat ~/.erlang.cookie) --remsh connectix@127.0.0.1'

# The cockpit as a terminal app rather than as three panes: the store's totals,
# the subscriptions the node confirmed, and the events as they land. It boots
# the app, so it shows THIS process — `make iex` is the one that attaches to a
# portal already running.
tui: ## Live cockpit: what this portal is receiving (q quits)
	docker compose run --rm --no-deps -e MIX_ENV=dev elixir mix connectix.tui

# One screen: the portal's log, Vite's, and `health` on a loop. The third is the
# one that matters — a portal can serve /health/ready while storing nothing, and
# that is invisible in a log.
tmux: ## Dev cockpit: portal, vite and health on one screen
	@command -v tmuxinator >/dev/null || { \
	  echo "tmuxinator not installed:  mise install && gem install tmuxinator"; exit 1; }
	@command -v tmux >/dev/null || { echo "tmux not installed"; exit 1; }
	@echo '  panes: portal log · vite log · health (10s)      window 2: a shell'
	@echo '  exit:  Ctrl-b d detaches (make tmux returns)   Ctrl-b Q quits it'
	@echo
	tmuxinator start -p .tmuxinator.yml

tmux-kill: ## Close the cockpit session (same as Ctrl-b Q inside it)
	@tmux kill-session -t connectix 2>/dev/null && echo "cockpit closed" || echo "no cockpit running"

mise: ## Install the pinned host toolchain (elixir/erlang/node — see mise.toml)
	@command -v mise >/dev/null || curl https://mise.run | sh
	mise trust && mise install && mise current

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

health: ## Services + cable subscriptions confirmed + events arriving
	@scripts/health.sh

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

# One target, not one per job. `all` is the whole workflow; anything else is a
# job id from .github/workflows/ci.yml.
ci act: ## CI locally with act: make ci [JOB=portal|cable-events|all]
	ACT_BIN="$(ACT)" ACT_RUNNER_IMAGE="$(ACT_PLATFORM)" scripts/ci-local.sh $(or $(JOB),all)

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

# DEST IS REQUIRED, and the guard is not pedantry. Without `-d`, kamal uses
# config/portal/deploy.yml — a DIFFERENT live host (212.199.160.156) with a
# DIFFERENT image (nirlevi/bots) from every named destination. A dropped
# `DEST=` therefore does not fail; it deploys, somewhere else, and the first
# sign is a timeout against a host you did not mean to touch.
portal-deploy: ## Build, push and swap the portal container — make portal-deploy DEST=nimbus
	@test -n "$(DEST)" || { 	  echo "!! DEST is required — a bare deploy targets the DEFAULT host, not yours." >&2; 	  echo "   make portal-deploy DEST=<$(shell ls $(VA_MOTHERSHIP)/config/portal/deploy.*.yml 2>/dev/null | sed 's|.*deploy\.||;s|\.yml||' | paste -sd'|')>" >&2; 	  exit 1; }
	$(portal_cli_guard)
	$(PORTAL_CLI) portal deploy -d $(DEST)

# There is no single "production". Kamal has a destination per customer, each
# with its own host and image, which is exactly why a bare `portal-deploy` was
# able to ship to the wrong one. So this lists them rather than pretending one
# PROD_URL speaks for all.
status: ## Local git + the kamal destinations this repo can deploy to
	@echo "=== Local git ==="
	@git log --oneline -1
	@git status -sb
	@echo
	@echo "=== Destinations (mothership config/portal) ==="
	@if [ -d "$(VA_MOTHERSHIP)/config/portal" ]; then \
	  for f in $(VA_MOTHERSHIP)/config/portal/deploy.*.yml; do \
	    d=$$(basename $$f .yml | sed 's/deploy\.//'); \
	    host=$$(grep -A3 'hosts:' $$f | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|[a-z0-9.-]+\.(io|com)' | head -1); \
	    img=$$(grep -m1 '^image:' $$f | sed 's/image: *//'); \
	    printf "  %-8s %-24s %s\n" "$$d" "$$host" "$$img"; \
	  done; \
	  echo "  make portal-deploy DEST=<one of the above>"; \
	else \
	  echo "  no mothership checkout at $(VA_MOTHERSHIP)"; \
	fi
