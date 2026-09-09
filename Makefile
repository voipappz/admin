# Make checks only the LAST command of a recipe line, so a failure in the middle
# of one is silently ignored and the target reports success. `-e` makes every
# command count; `-o pipefail` makes every stage of a pipe count.
#
# It creates failure shapes worth knowing: `x=$(cmd)` where cmd may legitimately
# fail (a probe, `docker compose port`) needs `|| true`, and `cmd && continue`
# in a loop kills the recipe in exactly the case the loop exists for.
# `-u` is deliberately NOT set — .env-derived variables are legitimately unset
# and recipes test for that.
SHELL := bash
.SHELLFLAGS := -e -o pipefail -c

# Every name here needs a rule. A .PHONY name without one is not an error: make
# prints "Nothing to be done" and exits 0, so a deleted rule looks like a
# working target. `make check-make` fails on any that is missing.
PHONY_TARGETS := help check-make iex tui tmux tmux-kill mise env dev \
                 up down logs health test ci probe status extension \
                 kamal-config kamal-push deploy deployed

.PHONY: $(PHONY_TARGETS)

# Everything runs in Docker — no host node/npm/ruby required, and none of it is
# needed any more: this is a pure-BEAM app, Elixir only.
ACT ?= act
ACT_PLATFORM ?= catthehacker/ubuntu:act-latest

# ── Config (override on the CLI or in .env) ─────────────────────────────────
# The API the LOCAL Elixir portal forwards to — every backend request the
# LiveView UI or the Chrome extension makes goes through the portal, which
# owns the upstream hop. Keep this resolution identical to docker-compose.yml.
PORTAL_ENGINE_URL ?= $(shell sed -n 's/^PORTAL_ENGINE_URL=//p' .env 2>/dev/null | grep . | head -1 | tr -d '\r"')
PORTAL_ENGINE_URL := $(if $(PORTAL_ENGINE_URL),$(PORTAL_ENGINE_URL),http://127.0.0.1:5000)

# Cable's ApiProxy must belong to the same API as the portal. A separate value
# remains available for the rare remote-node case, but the coherent default is
# the portal engine rather than an unrelated production tenant.
CABLE_API_URL ?= $(shell sed -n 's/^CABLE_API_URL=//p' .env 2>/dev/null | grep . | head -1 | tr -d '\r"')
CABLE_API_URL := $(if $(CABLE_API_URL),$(CABLE_API_URL),$(PORTAL_ENGINE_URL))

# Local stack endpoint. PORTAL is the origin: the LiveView UI, the Chrome
# extension (which lives in ../chrome and builds with `make -C ../chrome build`)
# all point at 4001, and it does not move.
# ASK COMPOSE, never state it. A second app publishing 4001 and answering
# /health/alive is indistinguishable from ours in a printed URL — the skill's
# rule, and the reason `urls` guards its fallback rather than assuming.
PORTAL_ADDR = $(shell docker compose port elixir 4001 2>/dev/null || true)
PORTAL   ?= http://$(if $(PORTAL_ADDR),$(PORTAL_ADDR),localhost:4001)
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

# Production URL for `make status` — set PROD_URL in .env (or on the CLI).
PROD_URL ?= $(shell sed -n 's/^PROD_URL=//p' .env 2>/dev/null | head -1 | tr -d '\r"')

.DEFAULT_GOAL := help

##@ Help

# Generated from the `##` comments and `##@` groups, so it cannot drift from the
# rules the way a hand-written page does. Nothing is hidden: a target a
# developer cannot see is a target they cannot use, and undocumented targets are
# where rot accumulates.
help: ## Show this help
	@printf '\n\033[1mconnectix portal\033[0m  — pure-BEAM: Elixir origin + LiveView UI · TUI · kamal deploy\n'
	@awk 'BEGIN {FS = ":.*## "} \
	     /^##@ / { printf "\n\033[1m%s\033[0m\n", substr($$0, 5); next } \
	     /^[a-zA-Z0-9_-]+:.*## / { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' \
	     $(firstword $(MAKEFILE_LIST))
	@printf '\n  \033[2mtraps and why: CLAUDE.md\033[0m\n\n'

# A .PHONY name with no rule is not an error — make prints "Nothing to be done"
# and exits 0, so deleting a rule leaves a target that appears to work. CI runs
# this.
check-make: ## Every .PHONY name has a rule
	@missing=""; \
	for t in $(PHONY_TARGETS); do \
	  grep -qE "^$$t( [a-z-]+)*:" $(firstword $(MAKEFILE_LIST)) || missing="$$missing $$t"; \
	done; \
	if [ -n "$$missing" ]; then echo "!! .PHONY without a rule:$$missing"; exit 1; fi; \
	echo "all $(words $(PHONY_TARGETS)) .PHONY targets have rules"

##@ Cockpit — what is it doing

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

# Two panes, built with tmux itself — no tmuxinator, and therefore no ruby and
# no gem. That chain is what failed the first time this was run, for a layout
# tmux can express in four commands. Attaches if the session already exists.
tmux: ## Cockpit: portal log · health, on one screen
	@command -v tmux >/dev/null || { echo "tmux not installed: apt install tmux"; exit 1; }
	@if tmux has-session -t connectix 2>/dev/null; then \
	  echo "attaching to the running cockpit (Ctrl-b d detaches)"; \
	else \
	  tmux new-session  -d -s connectix -n main -c "$(PWD)" 'docker compose logs -f elixir'; \
	  tmux split-window -t connectix:main -h -c "$(PWD)" 'watch -n 10 -c make health'; \
	  tmux select-layout -t connectix:main main-vertical; \
	  tmux new-window   -t connectix -n shell -c "$(PWD)"; \
	  tmux select-window -t connectix:main; \
	fi
	@echo "  panes: portal log · health (10s)     window 2: a shell"
	@echo "  Ctrl-b d detaches · make tmux-kill closes it"
	@tmux attach -t connectix

tmux-kill: ## Close the cockpit session (same as Ctrl-b Q inside it)
	@tmux kill-session -t connectix 2>/dev/null && echo "cockpit closed" || echo "no cockpit running"

##@ Setup

mise: ## Install the pinned host toolchain (elixir/erlang — see mise.toml)
	@command -v mise >/dev/null || curl https://mise.run | sh
	mise trust && mise install && mise current

env: ## Create .env (never overwrites an existing one)
	@if [ -f .env ]; then \
	  echo ".env exists — leaving it alone. Local portal engine: $(PORTAL_ENGINE_URL)"; \
	else \
	  cp .env.example .env && echo "wrote .env — set PORTAL_ENGINE_URL if the local API is not on :5000"; \
	fi

##@ Run it

# The engine check is a GATE here, not a report: starting a stack whose upstream
# is unreachable produces failures that read as broken auth. `make health` is
# where you go to SEE it; this is where you are stopped by it.
dev: ## Run the local stack in Docker (portal :4001), attached logs
	@code=$$(curl -s -o /dev/null -w '%{http_code}' "$(PORTAL_ENGINE_URL)/tasks/customer_portal_data" --max-time 5 || true); \
	  case $$code in \
	    [234]*) ;; \
	    *) echo "engine $(PORTAL_ENGINE_URL) unreachable ($$code) — set PORTAL_ENGINE_URL in .env"; exit 1;; \
	  esac
	@$(STACK_UP) elixir
	@echo "portal → $(PORTAL) · cable → $(PORTAL_CABLE_URL) · engine → $(PORTAL_ENGINE_URL)"
	@echo "extension → chrome/angular/dist (make extension, then Load unpacked)"
	@echo "Ctrl-C detaches; stack keeps running"
	docker compose logs -f elixir

up: ## Start the Docker stack (portal)
	@$(STACK_UP) elixir
	@echo "portal → $(PORTAL)"

down: ## Stop all services
	docker compose down --remove-orphans

logs: ## Follow logs for the portal
	docker compose logs -f elixir

# The Chrome extension. It lives HERE now, not in its own repo: it posts to
# this portal and opens its socket on this portal, and the two are only ever
# changed together. Its own package.json and node:20 container stay inside
# chrome/ — nothing about this app becomes a Node app, and the BEAM image
# never sees it.
extension: ## Build the Chrome extension into chrome/angular/dist
	$(MAKE) -C chrome build

##@ Check

health: ## Where it is, whether it answers, and whether events are arriving
	@PORTAL="$(PORTAL)" CABLE_HEALTH="$(CABLE_HEALTH)" \
	  CABLE_URL="$(PORTAL_CABLE_URL)" PORTAL_ENGINE_URL="$(PORTAL_ENGINE_URL)" scripts/health.sh

##@ Test

# ONE command, because "did I break it" is one question. `TEST=` narrows it to
# a file/pattern the way `mix test` itself does.
#
# The Playwright E2E suite (react/e2e-shaped tests, and test-cable — a broker,
# a real va-crystal node and the production portal image) is gone along with
# the React SPA it drove. What you want locally for connectivity is
# `make health`; a LiveView-shaped E2E suite is a future addition, not a
# revival of the old one.
test: ## [TEST=path/pattern] Run the Elixir suite (compile --warnings-as-errors, then exunit)
	docker compose run --rm --no-deps -T -e MIX_ENV=test elixir \
	  sh -lc 'mix compile --warnings-as-errors && mix test $(TEST)'

# Through the PORTAL, not straight at cable: that is the path the browser and
# the extension take, and it covers the two hops that fail most often — token
# verification and the portal's own cable credential. `health` says the socket
# is up; this drives a real session through it with a real token.
probe: ## [AUTH=<localStorage.auth>] Probe /ws/events with a real session
	@docker run --rm --network host \
	  -e AUTH='$(AUTH)' -e TOKEN='$(TOKEN)' -e ID='$(ID)' \
	  -e PORTAL_URL='$(PORTAL)' -e SECONDS='$(SECONDS)' \
	  -v "$(PWD)/scripts:/s:ro" node:22-alpine \
	  node /s/portal-probe.mjs

# The whole workflow, or one job. `cable-events` is where the real chain runs —
# it needs a private va-crystal image, which is why it is a CI job and not a
# make target.
ci: ## [JOB=portal|stress|browser|prod-image|all] Run CI locally with act
	ACT_BIN="$(ACT)" ACT_RUNNER_IMAGE="$(ACT_PLATFORM)" scripts/ci-local.sh $(or $(JOB),all)

##@ Deploy — kamal, from this repo

# THE DEPLOY POLICY LIVES HERE NOW. It used to live in the mothership
# (config/portal/) on the reasoning that choosing where the portal lands needs
# the view of every destination at once. In practice that split cost more than
# it bought: two repos to keep in step, a compiled CLI in a third whose only
# job was to mount one into the other, and a `--path`/`VA_PORTAL_DIR` dance
# that broke outright when this app stopped having a package.json.
#
# config/deploy*.yml and .kamal/ are kamal's OWN layout, relative to the
# project root — so kamal needs no mounts of anywhere else and `kamal` run by
# hand from this directory does exactly what these targets do.
#
# SECRETS AND TLS MATERIAL ARE NOT IN GIT. .kamal/secrets*, *.key and *.pem are
# ignored; .kamal/secrets.example says which names each destination needs.

KAMAL_IMAGE ?= ghcr.io/basecamp/kamal:v2.12.0

# `~/.docker` is mounted READ-WRITE on purpose: buildx writes builder activity
# files there, and a read-only mount fails the build with
# "read-only file system" long after the image has been built.
KAMAL = docker run --rm \
	  -v "$(CURDIR):/workdir" -w /workdir \
	  -v "$(HOME)/.ssh:/root/.ssh:ro" \
	  -v "$(HOME)/.docker:/root/.docker" \
	  -v /var/run/docker.sock:/var/run/docker.sock \
	  -e KAMAL_REGISTRY_PASSWORD -e KAMAL_HEALTHCHECK_URL \
	  -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0='*' \
	  $(KAMAL_IMAGE)

# DEST IS REQUIRED, and the guard is not pedantry. Without `-d`, kamal uses
# config/deploy.yml — a DIFFERENT live host with a DIFFERENT image from every
# named destination. A dropped `DEST=` therefore does not fail; it deploys,
# somewhere else, and the first sign is a timeout against a host you did not
# mean to touch.
define require_dest
	@test -n "$(DEST)" || { \
	  echo "!! DEST is required — a bare deploy targets the DEFAULT host, not yours." >&2; \
	  echo "   make $@ DEST=<$$(ls config/deploy.*.yml 2>/dev/null | sed 's|.*deploy\.||;s|\.yml||' | paste -sd'|')>" >&2; \
	  exit 1; }
endef

kamal-config: ## [DEST=x] Render the resolved config and change nothing
	$(require_dest)
	$(KAMAL) config -d $(DEST)

# Separate from deploy because the image push is the step this network fails:
# Docker Hub answers `invalid content range` on an interrupted layer upload,
# and retrying the whole deploy to get past it wastes the container swap too.
# Build layers are cached, so a retry here costs minutes.
kamal-push: ## [DEST=x] Build and push the image only, no container swap
	$(require_dest)
	$(KAMAL) build push -d $(DEST)

deploy: ## [DEST=x] Build, push and swap the container — make deploy DEST=connectix
	$(require_dest)
	$(KAMAL) deploy -d $(DEST)

# There is no single "production". Kamal has a destination per customer, each
# with its own host and image, which is exactly why a bare deploy was able to
# ship to the wrong one. So this lists them rather than pretending one PROD_URL
# speaks for all.
status: ## Local git + the kamal destinations this repo can deploy to
	@echo "=== Local git ==="
	@git log --oneline -1
	@git status -sb
	@echo
	@echo "=== Destinations (config/) ==="
	@for f in config/deploy.*.yml; do \
	  d=$$(basename $$f .yml | sed 's/deploy\.//'); \
	  host=$$(grep -A3 'hosts:' $$f | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|[a-z0-9.-]+\.(io|com)' | head -1 || true); \
	  img=$$(grep -m1 '^image:' $$f | sed 's/image: *//' || true); \
	  img=$${img:-(inherits deploy.yml)}; \
	  printf "  %-10s %-24s %s\n" "$$d" "$$host" "$$img"; \
	done
	@$(M) deployed

# WHAT IS ACTUALLY RUNNING, asked of the nodes themselves rather than inferred
# from a deploy log or from whoever last remembers deploying. Every release
# serves its build commit at /release/info, so drift is a question with an
# answer. Read-only, so it is safe to run on a whim.
deployed: ## Which build each destination is running, and how far behind HEAD
	@bash scripts/deployed-versions.sh
