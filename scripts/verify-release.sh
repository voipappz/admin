#!/usr/bin/env bash
# Is this address fit to point the Chrome extension at?
#
#     scripts/verify-release.sh https://nimbus-connectix.voipappz.io:10444
#     scripts/verify-release.sh                # reads CONFIG.API_ENDPOINT from ../chrome
#
# "Are the ports open" is the question people ask, but an open port is not the
# thing that has to be true. The extension needs ONE address to answer four
# different ways, and each failure below looks identical from the outside —
# "it doesn't work" — while having a different cause and a different fix:
#
#   * TLS, with a certificate that actually covers this hostname. kamal-proxy
#     on nimbus serves a certificate supplied from the host at DEPLOY time
#     (Kong owns :80 there, so ACME is unavailable). A new hostname therefore
#     needs a new certificate BEFORE it can be released to — and a renewal on
#     the host does nothing until the next deploy.
#   * /health/ready 200. Not /health/alive: alive answers 200 for as long as
#     the BEAM responds, so a node that booted but cannot host agent sessions
#     passes it. ready is the deploy gate for that reason.
#   * /ws/events answering 401 to an unauthenticated upgrade. 401 is SUCCESS
#     here: it proves the port routes to the portal, the proxy forwards the
#     upgrade, and the socket refused the request on its merits. 404 means the
#     catch-all answered instead; 502 means nothing is behind the proxy; a
#     timeout means the port is filtered. This is the check most worth having,
#     because a proxy that terminates TLS correctly and silently drops the
#     Upgrade header breaks only the realtime feed — logins keep working, and
#     the extension looks connected while receiving nothing.
#   * /chat answering 401. The LiveView UI is behind Basic Auth; a 200 here
#     means the gate is missing.
#
# Read-only: no POST, no credentials, nothing deployed or modified.
set -uo pipefail

BASE="${1:-}"
CHROME_CONFIG="${CHROME_CONFIG:-$(dirname "$0")/../../chrome/angular/src/app/config.ts}"

if [ -z "$BASE" ] && [ -f "$CHROME_CONFIG" ]; then
  BASE=$(grep -oE 'API_ENDPOINT: *"[^"]+"' "$CHROME_CONFIG" | head -1 | cut -d'"' -f2)
  [ -n "$BASE" ] && echo "(no address given — using CONFIG.API_ENDPOINT: $BASE)"
fi

if [ -z "$BASE" ]; then
  echo "usage: $0 <https://host[:port]>" >&2
  exit 2
fi

BASE="${BASE%/}"
HOST_PORT="${BASE#*://}"
HOST="${HOST_PORT%%:*}"
PORT="${HOST_PORT##*:}"
[ "$PORT" = "$HOST_PORT" ] && PORT=443

fail=0
pass() { printf '  \033[32m✓\033[0m %-34s %s\n' "$1" "${2:-}"; }
warn() { printf '  \033[33m!\033[0m %-34s %s\n' "$1" "${2:-}"; }
bad()  { printf '  \033[31m✗\033[0m %-34s %s\n' "$1" "${2:-}"; fail=1; }

echo "==> $BASE"

# ---- DNS ------------------------------------------------------------------
ip=$(getent hosts "$HOST" 2>/dev/null | awk '{print $1}' | head -1)
if [ -n "$ip" ]; then pass "dns" "$HOST → $ip"; else bad "dns" "$HOST does not resolve"; fi

# ---- TCP ------------------------------------------------------------------
if timeout 8 bash -c ">/dev/tcp/$HOST/$PORT" 2>/dev/null; then
  pass "tcp :$PORT" "open"
else
  bad "tcp :$PORT" "closed, filtered, or unreachable from here"
  echo
  echo "  Nothing below can pass while the port does not answer. If this host is"
  echo "  firewalled to an office network, run this from inside it."
  exit 1
fi

# ---- TLS ------------------------------------------------------------------
cert=$(timeout 12 openssl s_client -connect "$HOST:$PORT" -servername "$HOST" </dev/null 2>/dev/null)
if [ -z "$cert" ]; then
  bad "tls" "no handshake"
else
  subject=$(echo "$cert" | openssl x509 -noout -subject 2>/dev/null | sed 's/^subject= *//')
  names=$(echo "$cert" | openssl x509 -noout -ext subjectAltName 2>/dev/null | tr -d ' ' | grep -o 'DNS:[^,]*' | sed 's/DNS://' | tr '\n' ' ')
  enddate=$(echo "$cert" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

  matched=0
  for n in $names; do
    [ "$n" = "$HOST" ] && matched=1
    case "$HOST" in ${n/\*/*}) [ "${n:0:2}" = "*." ] && matched=1 ;; esac
  done
  if [ "$matched" = 1 ]; then pass "tls cert" "covers $HOST"
  else bad "tls cert" "does NOT cover $HOST — serves: ${names:-<none>} ${subject:+($subject)}"; fi

  if [ -n "$enddate" ]; then
    left=$(( ( $(date -d "$enddate" +%s 2>/dev/null || echo 0) - $(date +%s) ) / 86400 ))
    if   [ "$left" -lt 0 ];  then bad  "tls expiry" "EXPIRED $(( -left )) days ago"
    elif [ "$left" -lt 21 ]; then warn "tls expiry" "$left days left — renew, then REDEPLOY (the proxy holds a copy)"
    else pass "tls expiry" "$left days left"; fi
  fi
fi

code() { curl -sk -o /dev/null -m 10 -w '%{http_code}' "$@" 2>/dev/null; }

# ---- the portal itself ----------------------------------------------------
c=$(code "$BASE/health/alive")
[ "$c" = 200 ] && pass "GET /health/alive" "200" || bad "GET /health/alive" "$c (want 200)"

c=$(code "$BASE/health/ready")
case "$c" in
  200) pass "GET /health/ready" "200 — serving" ;;
  503) bad  "GET /health/ready" "503 — draining, or cannot host agent sessions" ;;
  502) bad  "GET /health/ready" "502 — proxy is up, nothing behind it" ;;
  *)   bad  "GET /health/ready" "$c (want 200)" ;;
esac

# ---- the realtime feed the extension lives on -----------------------------
key=$(head -c 16 /dev/urandom | base64)
c=$(code -H "Connection: Upgrade" -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: $key" \
        "$BASE/ws/events")
case "$c" in
  401) pass "GET /ws/events (no token)" "401 — reached the socket, refused on merit" ;;
  101) warn "GET /ws/events (no token)" "101 — upgraded WITHOUT a token; the socket is not gated" ;;
  404) bad  "GET /ws/events (no token)" "404 — the catch-all answered; the upgrade never reached the socket" ;;
  502) bad  "GET /ws/events (no token)" "502 — nothing behind the proxy" ;;
  000) bad  "GET /ws/events (no token)" "no answer — the proxy is dropping the Upgrade" ;;
  *)   bad  "GET /ws/events (no token)" "$c (want 401)" ;;
esac

# ---- the LiveView UI ------------------------------------------------------
c=$(code "$BASE/chat")
case "$c" in
  401) pass "GET /chat" "401 — Basic Auth gate present" ;;
  200) bad  "GET /chat" "200 — the UI is UNAUTHENTICATED" ;;
  *)   warn "GET /chat" "$c (expected 401)" ;;
esac

echo
if [ "$fail" = 0 ]; then
  echo "  Fit to release. Point CONFIG.API_ENDPOINT at $BASE"
else
  echo "  NOT fit to release — fix the ✗ lines first."
fi
exit "$fail"
