#!/usr/bin/env bash
# What is installed, what is configured, and what is missing. Read-only.
set -e -o pipefail

row() { printf '  %-22s %s\n' "$1" "$2"; }

echo
echo "Tooling"
want=$(sed -n 's/^node *= *"\(.*\)"/\1/p' mise.toml 2>/dev/null | tr -d ' '); want=${want:-22}
if command -v node >/dev/null 2>&1; then
  nv=$(node --version); nmaj=${nv#v}; nmaj=${nmaj%%.*}
  if [ "$nmaj" -lt "${want%%.*}" ] 2>/dev/null; then
    row "node" "$nv  TOO OLD -- needs ${want}, run: make setup"
  else
    row "node" "$nv"
  fi
else
  row "node" "MISSING -- run: make setup"
fi
row "npm"     "$(npm --version 2>/dev/null || echo MISSING)"
row "docker"  "$(docker --version 2>/dev/null | cut -d, -f1 || echo 'not installed (optional)')"

echo
echo "Project"
row "node_modules" "$([ -d node_modules ] && echo present || echo 'MISSING -- make install')"
row "playwright"   "$(npx playwright --version 2>/dev/null || echo "MISSING -- make browsers")"
row "specs"        "$(ls tests/*.spec.ts 2>/dev/null | wc -l | tr -d ' ') found"

echo
echo "Configuration"
if [ ! -f .env ]; then
  row ".env" "MISSING -- make env"
else
  row ".env" "present"
  for k in VITE_API_BASE_URL TEST_EMAIL TEST_PASSWORD VA_TEST_OTP; do
    v=$(sed -n "s/^${k}=//p" .env 2>/dev/null | tail -1 || true)
    case "$k" in
      VITE_API_BASE_URL) row "  $k" "${v:-'empty -- the app has no API to talk to'}" ;;
      *)                 row "  $k" "$([ -n "$v" ] && echo set || echo 'empty -- Playwright will fail at login')" ;;
    esac
  done
fi

# The API this app is useless without. Say whether it actually answers.
echo
echo "API"
base=$(sed -n "s/^VITE_API_BASE_URL=//p" .env 2>/dev/null | tail -1 || true)
if [ -z "$base" ]; then
  row "reachable" "unknown -- VITE_API_BASE_URL is not set"
else
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "${base}/tasks/openapi.json" 2>/dev/null) || code=000
  case "$code" in
    200) row "$base" "OpenAPI contract reachable (200)" ;;
    000) row "$base" "NO RESPONSE -- wrong host, or no network route" ;;
    *)   row "$base" "answered $code for /tasks/openapi.json" ;;
  esac
fi
echo
