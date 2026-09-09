# voipappz Chrome extension — build it, serve it, test it.  `make` lists everything.
#
# Everything runs in Docker, so node is not required on the host. The one
# exception is `test-e2e`, which drives a REAL Chrome with the unpacked
# extension loaded and therefore cannot run in a container.
#
# NODE 20, NOT a current one. Angular 11 + webpack 4 need
# --openssl-legacy-provider (already inside package.json's scripts) and do not
# build on newer node even with it.

.DEFAULT_GOAL := help
.PHONY: help build watch serve pack clean test-e2e shell

IMAGE ?= node:20
# The invoking user, so angular/dist lands HOST-owned. Chrome reads that
# directory and you rewrite it by hand; root-owned output makes both fail with
# EACCES inside a directory you appear to own. UID/GID are not exported by a
# shell, so they are passed explicitly; 1000 is what a Linux desktop user has.
UID ?= $(shell id -u)
GID ?= $(shell id -g)

# Its own node_modules volume. The extension has its OWN package.json and a
# ~650MB tree; sharing a cache with anything else means neither build resolves.
MODULES_VOLUME ?= chrome_node_modules

# Chrome loads an extension from a DIRECTORY, never over HTTP. This is the
# artefact: point "Load unpacked" at it once and it stays current.
# CURDIR, never PWD. `make -C chrome build` from the repo root leaves the PWD
# environment variable pointing at the ROOT, so every -v "$(PWD)":/app mounted
# the wrong directory and npm died with `Could not read package.json` — which
# reads as a corrupt checkout rather than as a wrong mount. CURDIR is always
# the directory make is running in.
DIST = $(CURDIR)/angular/dist

# Where the popup signs in. The portal answers CORS for any origin, so the
# plain-page form on :4300 reaches it exactly as the packed extension does.
PORTAL ?= http://localhost:4001

# `npm ci` only on a cold volume: it deletes node_modules first, so running it
# every time would spend two minutes rebuilding an identical tree.
# `.package-lock.json` is written by npm at the END of a successful install, so
# it is the only honest "this tree is complete" marker. The guard used to test
# for node_modules/.bin/ng, which a HALF-populated volume also satisfies: the
# build then got as far as `rimraf` and died with `rimraf: not found`, which
# reads as a missing dependency rather than as an install that never finished.
INSTALL = [ -f node_modules/.package-lock.json ] || npm ci --legacy-peer-deps --no-audit --no-fund
RUN = docker run --rm -u "$(UID):$(GID)" -w /app \
        -v "$(CURDIR)":/app -v $(MODULES_VOLUME):/app/node_modules $(IMAGE) bash -c

# Docker creates a named volume owned by ROOT. Every recipe below runs as the
# invoking user, so on a cold volume the first `npm ci` fails with EACCES on
# /app/node_modules — "The operation was rejected by your operating system",
# which reads as a broken Docker or a broken host rather than as a one-time
# ownership fix. One root container hands the volume over; a no-op afterwards.
OWN = docker run --rm -v $(MODULES_VOLUME):/v $(IMAGE) chown $(UID):$(GID) /v

B = \033[1m
C = \033[36m
D = \033[2m
R = \033[0m

help:
	@printf '$(B)voipappz chrome extension$(R)\n\n'
	@awk 'BEGIN { FS = ":.*## " } \
	      /^[a-zA-Z0-9_-]+:.*## / { printf "  $(C)%-10s$(R) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@printf '\n  $(D)load unpacked: chrome://extensions -> %s$(R)\n\n' "$(DIST)"

build: ## Build the extension once into angular/dist
	@$(OWN) >/dev/null
	$(RUN) '$(INSTALL); npm run build'
	@printf 'extension → $(DIST)\n  chrome://extensions → Load unpacked\n'

watch: ## Keep angular/dist rebuilt as you edit (ng build --watch + webpack -w)
	@printf 'watching → $(DIST)\n'
	@printf '  $(D)a popup edit needs nothing; a background/content-script edit\n'
	@printf '  needs the reload button in chrome://extensions$(R)\n'
	@$(OWN) >/dev/null
	$(RUN) '$(INSTALL); npm run watch'

# The popup as an ORDINARY web page, for iterating on the UI without the
# rebuild → chrome://extensions → reload loop. `chrome.*` does not exist there,
# so `angular/src/app/providers/chrome-shim.ts` stands in for it — see that file
# for what is faithful and what is not.
#
# NOT a substitute for `make build`: the background service worker does not run
# here, so screen-pop notifications never appear. The realtime socket itself
# does open — its frames go to the console.
serve: ## Run the popup UI as a plain Angular app on :4300
	@printf 'extension UI → http://localhost:4300  (sign in with domain $(PORTAL))\n'
	@$(OWN) >/dev/null
	docker run --rm -u "$(UID):$(GID)" -w /app -p 4300:4300 \
	  -v "$(CURDIR)":/app -v $(MODULES_VOLUME):/app/node_modules $(IMAGE) bash -c \
	  '$(INSTALL); npm run serve'

pack: ## Production build, stamped and zipped to extension-build.zip
	@$(OWN) >/dev/null
	$(RUN) '$(INSTALL); npm run build:production'
	@printf 'package → $(CURDIR)/extension-build.zip\n'

clean: ## Remove angular/dist
	$(RUN) 'npm run clean'

# The USER front door, which is NOT the portal account's: the extension posts
# /auth/user_login (users table), and an Account password gets a bare 401 that
# reads as a broken extension. `make onboard` in ../mothership prints the
# credential as "Extension login".
#
# TEST_DOMAIN defaults to the local portal, so the run exercises the real hop
# chain — extension → Elixir :4001 → the API — rather than a cloud node.
#
# Runs on the HOST: Playwright drives a real Chrome with the unpacked extension
# loaded, and a container has no extension support wired up. Needs `make build`
# first, for the same reason — there is nothing to load otherwise.
test-e2e: ## Login E2E: make test-e2e TEST_USERNAME=... TEST_PASSWORD=...
	@test -n "$(TEST_USERNAME)" -a -n "$(TEST_PASSWORD)" || { \
	  echo "usage: make test-e2e TEST_USERNAME=<user email> TEST_PASSWORD=<its password>"; \
	  echo "  the USER login (users table), not the portal account —"; \
	  echo "  ../mothership's 'make onboard' prints it as \"Extension login\"."; exit 1; }
	@[ -f angular/dist/manifest.json ] || { echo "build it first: make build"; exit 1; }
	TEST_DOMAIN="$(PORTAL)" \
	  TEST_USERNAME="$(TEST_USERNAME)" TEST_PASSWORD="$(TEST_PASSWORD)" \
	  npx playwright test user-connect login

shell: ## A shell in the build container
	docker run --rm -it -u "$(UID):$(GID)" -w /app \
	  -v "$(CURDIR)":/app -v $(MODULES_VOLUME):/app/node_modules $(IMAGE) bash
