#!/bin/sh
# What the deploy files SET against what the app READS:
#
#     config/deploy*.yml   env.clear:        CONNECTIX_DATA_DIR, ENGINE_URL, ...
#     connectix/lib        Connectix.Config: env("ENGINE_URL"), ...
#
# Rename a variable on one side and nothing fails until a deploy goes green and
# serves a blank page, or silently drops the event store on every container
# swap. This script catches that: assertions over files, counted, named when
# they fail.
#
# It lived in the mothership until 2026-09-09, when the deploy policy moved
# here — it existed BECAUSE the two halves were in different repos, and it
# needed a skip path for when the sibling clone was absent. Both are gone: one
# repo, no skip, so a broken contract cannot pass by being unreachable.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CONF="$ROOT/config"
DESTS="$CONF/portal-destinations.tsv"
SRC="$ROOT"

N=0
FAIL=0
WARN=0

# A deploy that BREAKS is a failure. Config that is merely dead — set but never
# read — is drift worth naming, not a reason to block a deploy; it warns.
fail() { echo "  ✗  $1"; FAIL=1; }
warn() { echo "  !  $1"; WARN=$((WARN + 1)); }
ok()   { N=$((N + 1)); }

# --- destinations catalog <-> deploy files ----------------------------------
# A row with no deploy file deploys the DEFAULT config to a tenant host. A
# deploy file with no row gets no stop_first and no healthcheck, silently.
awk -F'\t' '/^[^#]/ && NF > 1 { print $1 }' "$DESTS" | while read -r dest; do
  if [ "$dest" = "(default)" ]; then f="$CONF/deploy.yml"; else f="$CONF/deploy.$dest.yml"; fi
  [ -f "$f" ] || echo "MISSING_FILE $dest"
done | grep '^MISSING_FILE' > /tmp/portal-missing.$$ 2>/dev/null || true
while read -r _ dest; do
  fail "destination '$dest' is in portal-destinations.tsv but config/portal/deploy.$dest.yml does not exist"
done < /tmp/portal-missing.$$
rm -f /tmp/portal-missing.$$
ok

for f in "$CONF"/deploy.*.yml; do
  [ -e "$f" ] || continue
  dest=$(basename "$f" .yml); dest=${dest#deploy.}
  if ! awk -F'\t' -v d="$dest" '/^[^#]/ && $1 == d { found = 1 } END { exit !found }' "$DESTS"; then
    fail "config/portal/deploy.$dest.yml has no row in portal-destinations.tsv — it would deploy with no stop_first and no healthcheck"
  fi
done
ok

# --- every env.clear key must still be READ by the app ----------------------
# The failure this catches: someone renames the variable in the app, the deploy
# keeps setting the old name, and the app silently falls back to its default.
#
# WHERE THE APP READS ENV MOVED. It was api/*.ts — `Deno.env.get("X")` — and
# that BFF is deleted; the Elixir portal is the server now and reads
# `System.get_env("X")` in connectix/, with a few in Dockerfile/compose. A
# check still looking in api/ finds nothing anywhere and reports EVERY key as
# dead config, which is 13 warnings that are all false and train you to ignore
# the one that is not.
#
# api/ is not searched as a fallback: it is deleted, and a check that still
# accepts the old spelling would go green again the day someone restores a
# stray file there.
for f in "$CONF"/deploy.yml "$CONF"/deploy.*.yml; do
  [ -e "$f" ] || continue
  awk '/^env:/ { in_env = 1; next }
       in_env && /^[a-z]/ { in_env = 0 }
       in_env && /^ +clear:/ { in_clear = 1; next }
       in_clear && /^ {4}[A-Z_]+:/ { gsub(/[ :]/, "", $1); print $1 }
       in_clear && /^ {0,3}[a-z]/ { in_clear = 0 }' "$f" | while read -r key; do
    [ -n "$key" ] || continue
    # RELEASE_* is read by the BEAM's own boot script, not by application code,
    # so it will never appear in connectix/. Flagging it as dead config is a
    # false positive that would sit in this output forever.
    case "$key" in RELEASE_*|PORT|PHX_SERVER) continue ;; esac
    # BOTH IDIOMS. connectix/CLAUDE.md is explicit that application code reads
    # env through `Connectix.Config` — `env("X")` / `int_env("X", ...)` — and
    # never `System.get_env/1` directly. A check looking only for the latter
    # finds nothing anywhere and reports EVERY key as dead config: fifteen
    # warnings that are all false, which trains you to ignore the one that is
    # not. `System.get_env` is still searched for the handful of places that
    # legitimately predate Config (runtime.exs, and Config itself).
    if ! grep -rqE "(System\.get_env|\bint_env|\benv)\(\"$key\"" \
         "$SRC/connectix/lib" "$SRC/connectix/config" "$SRC/Dockerfile.production" 2>/dev/null; then
      echo "UNREAD $(basename "$f") $key"
    fi
  done
done | sort -u > /tmp/portal-unread.$$ 2>/dev/null || true
while read -r _ file key; do
  warn "$file sets $key but nothing in the portal reads it — dead config, or a rename that lost its other half"
done < /tmp/portal-unread.$$
rm -f /tmp/portal-unread.$$
ok

# --- durable state must have somewhere to live -------------------------------
# THE FAILURE THIS GUARDS COST A PRODUCTION DATABASE. A destination can mount a
# volume and never tell the app to use it, or tell the app to use a path it has
# not mounted. Either way Mnesia starts perfectly happily on an empty schema
# and DuckDB creates a fresh file, so the app boots, answers /health, and has
# lost every conversation, bot and message. Nothing errors.
#
# That was nimbus for its whole life: the base deploy.yml mounts
# `voipappz-events:/data` for every destination, and until 2026-09-07 nothing
# set MNESIA_DIR, so it ran ram_copies beside an empty mount.
#
# The rule: if a destination names a data directory, some volume must contain
# it; if it names none, it is ephemeral and must say so by naming neither.
for f in "$CONF"/deploy.*.yml; do
  [ -e "$f" ] || continue
  name=$(basename "$f")
  data=$(sed -n 's/^ *CONNECTIX_DATA_DIR: *//p' "$f" | head -1 | tr -d '"\r')
  mnesia=$(sed -n 's/^ *MNESIA_DIR: *//p' "$f" | head -1 | tr -d '"\r')

  # Volumes are inherited from deploy.yml unless the destination sets its own.
  vols=$(sed -n 's/^ *- *"\?\([^"]*:[^"]*\)"\?/\1/p' "$f" "$CONF/deploy.yml" 2>/dev/null | grep ':' || true)

  if [ -n "$mnesia" ] && [ -z "$data" ]; then
    fail "$name sets MNESIA_DIR but no CONNECTIX_DATA_DIR — the event store still writes inside the container"
  fi

  if [ -n "$data" ]; then
    if ! echo "$vols" | grep -q ":${data}\(/\|$\)"; then
      fail "$name sets CONNECTIX_DATA_DIR=$data but no volume is mounted there — every restart starts empty, silently"
    fi
  fi
done
ok

# The event-store volume assertion was here. It went with EVENT_STORE_PATH:
# the DuckDB projection was the Deno BFF's, and nothing in the Elixir portal
# writes one, so there is no longer a path that could be lost on a deploy.

if [ "$FAIL" = "1" ]; then
  echo
  echo "portal contract: FAILED — config/ and the app have drifted."
  exit 1
fi

if [ "$WARN" != "0" ]; then
  echo "portal contract: $N assertion groups, $WARN warning(s), nothing broken ✔"
else
  echo "portal contract: $N assertion groups, config/ agrees with the app ✔"
fi
