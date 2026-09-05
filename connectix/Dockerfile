# This file is based on these images:
#
#   - https://hub.docker.com/r/hexpm/elixir/tags - for the builder image
#     E.g.: docker.io/hexpm/elixir:1.19.5-erlang-27.3.4-debian-trixie-20260610-slim
#   - https://hub.docker.com/_/debian/tags?name=trixie-20260610-slim - for the runner image
#     E.g.: docker.io/debian:trixie-20260610-slim
#
# Find builder and runner images on Docker Hub or on Hex's Build Server (Bob).
# We recommend using Bob's Web UI to find recent tags:
#
#   - https://bob.hex.pm/docker
#
# We suggest using the same Debian version for both the builder and runner images.
#
# We suggest Debian/Ubuntu instead of Alpine to avoid production compatibility issues
# (such as DNS resolution failures, and dynamically linked NIFs/precompiled binaries).
#
# For finding packages in Debian, search on https://packages.debian.org/.

ARG ELIXIR_VERSION=1.19.5
ARG OTP_VERSION=27.3.4
ARG DEBIAN_VERSION=trixie-20260610-slim

ARG BUILDER_IMAGE="docker.io/hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}"
ARG RUNNER_IMAGE="docker.io/debian:${DEBIAN_VERSION}"

FROM ${BUILDER_IMAGE} AS builder

# install build dependencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential git \
  && rm -rf /var/lib/apt/lists/*

# prepare build dir
WORKDIR /app

# install hex + rebar
RUN mix local.hex --force \
  && mix local.rebar --force

# set build ENV
ENV MIX_ENV="prod"

# install mix dependencies
COPY mix.exs mix.lock ./
RUN mix deps.get --only $MIX_ENV
RUN mkdir config

# copy compile-time config files before we compile dependencies
# to ensure any relevant config change will trigger the dependencies
# to be re-compiled.
COPY config/config.exs config/${MIX_ENV}.exs config/
RUN mix deps.compile

RUN mix assets.setup

COPY priv priv

COPY lib lib

# Compile the release
RUN mix compile

COPY assets assets

# compile assets
RUN mix assets.deploy

# Changes to config/runtime.exs don't require recompiling the code
COPY config/runtime.exs config/

COPY rel rel
RUN mix release

# start a new build stage so that the final image will only contain
# the compiled release and other runtime necessities
FROM ${RUNNER_IMAGE} AS final

RUN apt-get update \
  && apt-get install -y --no-install-recommends libstdc++6 openssl libncurses6 locales ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Set the locale
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
  && locale-gen

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

WORKDIR "/app"
RUN chown nobody /app

# set runner ENV
ENV MIX_ENV="prod"

# Only copy the final release from the build stage
COPY --from=builder --chown=nobody:root /app/_build/${MIX_ENV}/rel/connectix ./

USER nobody

# If using an environment that doesn't automatically reap zombie processes, it is
# advised to add an init process such as tini via `apt-get install`
# above and adding an entrypoint. See https://github.com/krallin/tini for details
# ENTRYPOINT ["/tini", "--"]

CMD ["/app/bin/server"]

# ── Development ────────────────────────────────────────────────────────────
# NOT part of the release path above. `docker compose up elixir` targets this
# stage to get a container that runs `mix phx.server` against the MOUNTED
# source, so a code change reloads instead of requiring an image rebuild.
#
# It deliberately stops after the toolchain: no COPY, no compile. The source
# arrives as a bind mount and `deps`/`_build` as named volumes, which is what
# makes an edit visible without a rebuild — baking the code in here would
# produce an image that goes stale the moment anyone types.
#
# inotify-tools is the one addition over the builder stage: phoenix_live_reload
# watches the filesystem, and without it a container silently never reloads —
# which reads as "my change did nothing" rather than as a missing package.
FROM ${BUILDER_IMAGE} AS dev

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential git inotify-tools \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mix local.hex --force \
  && mix local.rebar --force

ENV MIX_ENV="dev"

# deps.get on every boot: the mounted mix.exs is the source of truth and a
# dependency added on the host must not require rebuilding this image.
#
# `exec` is load-bearing, not style. Without it `sh` stays PID 1 and does not
# forward signals, so `docker compose restart` delivered SIGTERM to the shell
# and never to the BEAM — which then died by SIGKILL when the grace period
# expired. No signal meant no OTP shutdown, no `terminate/2`, and so no Mnesia
# log dump: every conversation written since the last automatic dump was lost
# on each restart, which is how a durable store came to look like a cache.
# With `exec` the VM is PID 1, OTP's signal handler runs `init:stop()`, and
# `Connectix.Drain` gets to flush.
CMD ["sh", "-c", "mix deps.get && exec mix phx.server"]
