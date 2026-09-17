# voipappz Ionic app — build it, serve it, bundle it into the portal. `make` lists everything.
#
# Everything runs in Docker, so node is not required on the host. The one
# exception is `apk`, which needs the Android SDK image, and `ios-sync`, which
# can only finish on a Mac — see those rules.
#
# THE PORTAL IS THE ORIGIN. This app posts /auth/user_login to the Elixir
# portal, opens its realtime socket there, and reaches /api and /tasks through
# its forwarder. Built with `--base-href /app/` it is served BY that portal out
# of the release image, so the browser has exactly one origin and there is no
# CORS at all. `serve` below is the only shape where the two are separate, and
# it proxies to make them look like one.

.DEFAULT_GOAL := help
.PHONY: help build bundle relock watch serve lint test-e2e sync apk ios-sync clean shell

# NODE 22, per .nvmrc. Angular 21 needs a current node; 20 is below its engines
# floor and npm ci refuses the tree.
IMAGE ?= node:22

# The invoking user, so www/ lands HOST-owned. The bundle is copied into the
# Elixir app's priv/ and read by a docker build; root-owned output makes both
# fail with EACCES inside a directory you appear to own. UID/GID are not
# exported by a shell, so they are passed explicitly.
UID ?= $(shell id -u)
GID ?= $(shell id -g)

# Its own node_modules volume. This app has its OWN package.json and a ~1GB
# tree (Angular 21 + Ionic + Capacitor + sip.js + janus); sharing a cache with
# chrome/'s Angular 11 tree means neither build resolves.
MODULES_VOLUME ?= ionic_node_modules

# CURDIR, never PWD. `make -C ionic build` from the repo root leaves the PWD
# environment variable pointing at the ROOT, so every -v "$(PWD)":/app mounts
# the wrong directory and npm dies with `Could not read package.json` — which
# reads as a corrupt checkout rather than as a wrong mount.
DIST = $(CURDIR)/www

# WHERE THE PORTAL SERVES IT FROM, and therefore what --base-href must be.
#
# priv/app and NOT priv/static/app: `mix phx.digest` walks all of priv/static
# regardless of `static_paths()`, so a bundle placed there gets a second
# content-hashed copy of every Angular chunk and a cache_manifest entry — for
# nothing, since Angular already hashes its own filenames. Outside priv/static
# the question does not arise. Same reasoning as chrome/'s priv/extension.
PORTAL_PRIV = $(CURDIR)/../connectix/priv/app

# The mount point in the portal's endpoint. `index.html` references every asset
# RELATIVELY (`assets/config/main.js`, the hashed bundles), so without a base
# href of /app/ they resolve against / and 404 — a build that is perfect and
# blank, which only shows in front of a user.
BASE_HREF ?= /app/

# Where the dev server sends /auth, /api, /tasks and /ws. The local portal.
PORTAL ?= http://localhost:4001

# `npm ci` only on a cold volume: it deletes node_modules first, so running it
# every time would spend minutes rebuilding an identical tree.
# `.package-lock.json` is written by npm at the END of a successful install, so
# it is the only honest "this tree is complete" marker — a half-populated
# volume satisfies a test for any single binary and then dies mid-build.
#
# --legacy-peer-deps: this tree does not satisfy npm 7+ peer resolution
# (@angular-eslint 19 against Angular 21, protractor against current rxjs).
INSTALL = [ -f node_modules/.package-lock.json ] || npm ci --legacy-peer-deps --no-audit --no-fund
RUN = docker run --rm -u "$(UID):$(GID)" -w /app \
        -v "$(CURDIR)":/app -v $(MODULES_VOLUME):/app/node_modules $(IMAGE) bash -c

# Docker creates a named volume owned by ROOT. Every recipe below runs as the
# invoking user, so on a cold volume the first `npm ci` fails with EACCES on
# /app/node_modules — "The operation was rejected by your operating system",
# which reads as a broken Docker rather than a one-time ownership fix. One root
# container hands the volume over; a no-op afterwards.
OWN = docker run --rm -v $(MODULES_VOLUME):/v $(IMAGE) chown $(UID):$(GID) /v

B = \033[1m
C = \033[36m
D = \033[2m
R = \033[0m

help:
	@printf '$(B)voipappz ionic app$(R)\n\n'
	@awk 'BEGIN { FS = ":.*## " } \
	      /^[a-zA-Z0-9_-]+:.*## / { printf "  $(C)%-10s$(R) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@printf '\n  $(D)bundle → %s$(R)\n' "$(PORTAL_PRIV)"
	@printf '  $(D)portal → %s$(R)\n\n' "$(PORTAL)"

build: ## Production build into www/ (gzipped, base-href $(BASE_HREF))
	@$(OWN) >/dev/null
	$(RUN) '$(INSTALL); npx ng build --configuration=production --base-href $(BASE_HREF)'
	@$(MAKE) --no-print-directory compress
	@$(MAKE) --no-print-directory check
	@printf 'bundle → $(DIST)\n  $(D)make bundle$(R) copies it where the portal serves it\n'

# Plug.Static's `gzip: true` serves foo.js.gz IF THAT FILE EXISTS, and it is
# `mix phx.digest` that normally writes them. This bundle deliberately lives
# outside priv/static so digest never sees it — so the .gz files are ours to
# make, here, or every phone downloads the uncompressed bundle.
#
# -k keeps the original: Plug.Static needs both, and falls back to the plain
# file for a client that sent no accept-encoding.
compress:
	@$(RUN) 'find www -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" \
	  -o -name "*.json" -o -name "*.svg" \) -exec gzip -9 -k -f {} +' >/dev/null
	@printf 'compressed %s files\n' "$$(find www -name '*.gz' | wc -l)"

# A BUILD THAT IS PERFECT AND BLANK is the failure this catches. A wrong
# base-href, or a stale index.html naming a chunk the build no longer emits,
# compiles cleanly and 404s every asset in the browser. Assert it here, where
# it costs nothing, instead of after a deploy.
check:
	@test -f www/index.html || { echo "no www/index.html — the build produced nothing"; exit 1; }
	@grep -q '<base href="$(BASE_HREF)"' www/index.html \
	  || { echo "www/index.html does not carry <base href=\"$(BASE_HREF)\"> — every asset will 404"; exit 1; }
	@main=$$(grep -oE 'src="main[^"]*\.js"' www/index.html | head -1 | sed 's/src="//;s/"//'); \
	  test -n "$$main" || { echo "index.html names no main bundle"; exit 1; }; \
	  test -f "www/$$main" || { echo "index.html names www/$$main, which is not in the build"; exit 1; }; \
	  printf 'ok: %s, base-href $(BASE_HREF)\n' "$$main"

bundle: ## Copy the built bundle to where the portal serves it (priv/app)
	@test -f www/index.html || { echo "build it first: make build"; exit 1; }
	@rm -rf "$(PORTAL_PRIV)"
	@mkdir -p "$(PORTAL_PRIV)"
	@tar -cf - -C www . | tar -xf - -C "$(PORTAL_PRIV)"
	@printf 'bundled → $(PORTAL_PRIV)\n  $(D)the portal serves it at %s/app$(R)\n' "$(PORTAL)"

# `npm ci` REFUSES A LOCK THAT DOES NOT MATCH package.json, and it is right to:
# an out-of-sync lock means the tree it installs is not the tree that was
# tested. It arrived that way — `phoenix` and `@types/phoenix` were added to
# package.json for the old gateway's socket and the lock was never regenerated,
# so the first build here died with `Missing: phoenix@1.8.14 from lock file`.
#
# This is the fix, and it is deliberately a SEPARATE target: `npm install`
# resolves fresh versions and rewrites the lock, which is a change to review,
# not something a build should do silently on the way past.
relock: ## Regenerate package-lock.json from package.json
	@$(OWN) >/dev/null
	$(RUN) 'npm install --legacy-peer-deps --no-audit --no-fund'
	@printf 'lock rewritten — review the diff before committing\n'

watch: ## Keep www/ rebuilt as you edit (use with `make bundle` for the real mount)
	@$(OWN) >/dev/null
	$(RUN) '$(INSTALL); npx ng build --watch --base-href $(BASE_HREF)'

# The app as an ORDINARY dev server, for iterating on the UI without a
# rebuild → bundle → reload loop. proxy.conf.json sends /auth, /api, /tasks and
# /ws to the portal, so the browser sees ONE origin exactly as it does at /app
# — without it every request is cross-origin to :4001 and the login preflight
# is the first thing that fails.
#
# NOT a substitute for `make build`: this serves at / with a dev base href, so
# it cannot catch the base-href mistakes `make check` exists to catch.
#
# --network host, not -p 8100:8100, for the reason the whole local stack uses
# it: the portal is published on the HOST's loopback, and a bridged container
# cannot see 127.0.0.1. host.docker.internal is not the fix either — on WSL it
# resolves to the WINDOWS host and nothing answers, which fails as a timeout
# and so reads as "the portal is down".
serve: ## Run the app on :8100, proxying the portal at $(PORTAL)
	@printf 'app → http://localhost:8100  (api + socket proxied to $(PORTAL))\n'
	@$(OWN) >/dev/null
	docker run --rm -u "$(UID):$(GID)" -w /app --network host -e PORTAL="$(PORTAL)" \
	  -v "$(CURDIR)":/app -v $(MODULES_VOLUME):/app/node_modules $(IMAGE) bash -c \
	  '$(INSTALL); npx ng serve --host 0.0.0.0 --port 8100 --disable-host-check \
	     --proxy-config proxy.conf.js'

lint: ## Run ESLint
	@$(OWN) >/dev/null
	$(RUN) '$(INSTALL); npx ng lint'

# Playwright's own image, not node:22: the browsers need system libraries that
# a plain node image does not carry, and `npx playwright install` would fetch
# them on every run.
test-e2e: ## Playwright specs against a running dev server
	docker run --rm -u "$(UID):$(GID)" -w /app --network host \
	  -v "$(CURDIR)":/app -v $(MODULES_VOLUME):/app/node_modules \
	  mcr.microsoft.com/playwright:v1.57.0-jammy bash -c \
	  '$(INSTALL); npx playwright test --project=chromium'

sync: ## Copy the web build into the android/ios projects (capacitor)
	@test -f www/index.html || { echo "build it first: make build"; exit 1; }
	@$(OWN) >/dev/null
	$(RUN) '$(INSTALL); npx cap sync'

# THE APK. Its own image because the Android SDK and a JDK are ~3GB that
# nothing else here needs, and its own gradle cache volume because a cold
# gradle re-downloads the whole toolchain on every build.
#
# A packed mobile build is CROSS-ORIGIN to the portal: it runs from
# capacitor://localhost, so it needs the forwarder's CORS headers on every
# route it calls — including the portal's own (/api/events, /dashboard/*),
# which do not have them yet. Web at /app never notices; this build does.
ANDROID_IMAGE ?= ghcr.io/cirruslabs/android-sdk:34
GRADLE_VOLUME ?= ionic_gradle_cache

apk: sync ## Build a debug APK (android/, needs the Android SDK image)
	docker run --rm -u "$(UID):$(GID)" -w /app/android \
	  -v "$(CURDIR)":/app -v $(GRADLE_VOLUME):/home/cirrus/.gradle \
	  $(ANDROID_IMAGE) ./gradlew assembleDebug
	@printf 'apk → $(CURDIR)/android/app/build/outputs/apk/debug/app-debug.apk\n'

# iOS CANNOT be containerized — xcodebuild runs on macOS only. This does the
# part that is portable and prints the part that is not, rather than failing
# with a missing-toolchain error that reads as a broken setup.
ios-sync: sync ## Sync ios/ and print the Xcode command for a Mac
	@printf 'ios project synced → $(CURDIR)/ios/App\n'
	@printf '  $(D)on a Mac: cd ios/App && pod install && open App.xcworkspace$(R)\n'

clean: ## Remove www/ and the bundled copy
	$(RUN) 'rm -rf www'
	@rm -rf "$(PORTAL_PRIV)"

shell: ## A shell in the build container
	docker run --rm -it -u "$(UID):$(GID)" -w /app \
	  -v "$(CURDIR)":/app -v $(MODULES_VOLUME):/app/node_modules $(IMAGE) bash
