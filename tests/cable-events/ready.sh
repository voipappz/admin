#!/usr/bin/env bash
# Readiness for the cable-events stack — PROVEN, not assumed.
#
# A 200 from each service says the processes are up, and that is all it says:
# the node's /health is a static "OK", and the portal's /health/ready is green
# with a node that will refuse every browser socket. So after the plain probes
# this waits for the two facts the spec actually depends on:
#
#   1. /health reports cable AND api_relay ok — the node CONFIRMED the portal's
#      ApiProxy subscribe, i.e. the Elixir → cable link is real;
#   2. one /ws/events upgrade with a token minted from the stack's secret is
#      answered 101 — the node knows the `verify` action. A node image that
#      predates it answers the unknown-action 400, the portal refuses the
#      upgrade, and every scenario after A1 would fail for a reason that has
#      nothing to do with this repo. Named here instead.
#
# Ports and the secret default to the compose file's; override with the same
# variables it reads.
set -Eeuo pipefail

PORTAL="http://127.0.0.1:${CABLE_EVENTS_PORTAL_PORT:-14001}"
CABLE="http://127.0.0.1:${CABLE_EVENTS_CABLE_PORT:-14100}"
NATS_MON="http://127.0.0.1:${CABLE_EVENTS_NATS_MON_PORT:-18222}"
SECRET="${CABLE_EVENTS_SECRET:-cable-events-test-secret}"
DEADLINE=$(( $(date +%s) + ${CABLE_EVENTS_READY_TIMEOUT:-120} ))

say() { printf '  %s\n' "$*"; }
fail() { printf '!! %s\n' "$*" >&2; exit 1; }
left() { echo $(( DEADLINE - $(date +%s) )); }

wait_for() {  # label, command...
  local label="$1"; shift
  while ! "$@" >/dev/null 2>&1; do
    [ "$(left)" -gt 0 ] || fail "$label: not ready after the deadline"
    sleep 1
  done
  say "✓ $label"
}

wait_for "broker /healthz"        curl -sf "$NATS_MON/healthz"
wait_for "node /health"           curl -sf "$CABLE/health"
wait_for "portal /health/ready"   curl -sf "$PORTAL/health/ready"

# 1. The link, from the portal's own report.
while :; do
  health=$(curl -sf "$PORTAL/health" || true)
  if printf '%s' "$health" | grep -q '"cable":{"status":"ok"}' && \
     printf '%s' "$health" | grep -q '"api_relay":{"status":"ok"}'; then
    say "✓ portal ↔ node: ApiProxy subscribe confirmed"; break
  fi
  [ "$(left)" -gt 0 ] || { printf '%s\n' "$health"; fail "the node never confirmed the portal's ApiProxy subscribe"; }
  sleep 1
done

# 2. verify. HS256 by hand: base64url(header).base64url(payload).base64url(hmac).
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
hdr=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
pl=$(printf '{"user_uuid":"00000000-0000-4000-8000-00000000ready","account_uuid":"00000000-0000-4000-8000-0000000acc00","environment_uuids":["00000000-0000-4000-8000-000000000e00"]}' | b64url)
sig=$(printf '%s.%s' "$hdr" "$pl" | openssl dgst -sha256 -hmac "$SECRET" -binary | b64url)
bearer=$(printf '%s.%s.%s' "$hdr" "$pl" "$sig" | b64url)

status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
  -H "Sec-WebSocket-Key: $(head -c 16 /dev/urandom | openssl base64 -A)" \
  -H "Sec-WebSocket-Protocol: voipappz-bearer.$bearer" \
  "$PORTAL/ws/events" || true)
case "$status" in
  101) say "✓ /ws/events upgrade: the node verifies tokens" ;;
  401) fail "the node refused to verify a token minted with the stack's secret: this node image predates the ApiProxy \`verify\` action — set VA_CRYSTAL_IMAGE to an image built from va-crystal that has it (the portal log says: 'the node predates the verify action')" ;;
  *)   fail "/ws/events upgrade answered $status (expected 101)" ;;
esac
say "ready: portal $PORTAL · node $CABLE · broker monitor $NATS_MON"
