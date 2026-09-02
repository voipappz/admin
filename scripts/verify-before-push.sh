#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="$(mktemp -d /tmp/voipappz-verify-build.XXXXXX)"
preview_pid=""

cleanup() {
  # `npx vite preview` spawns a child that outlives the wrapper, so killing
  # $preview_pid alone left a listener holding 4200 after every failed run — and
  # that orphan then blocked the NEXT push, because --strictPort cannot rebind.
  # Kill the whole process group (setsid gives the preview its own).
  if [[ -n "$preview_pid" ]]; then
    kill -- "-$preview_pid" 2>/dev/null || kill "$preview_pid" 2>/dev/null || true
  fi
  rm -rf "$build_dir"
}
trap cleanup EXIT INT TERM

cd "$repo_dir"

# Anything already on 4200 is tested INSTEAD of the build we are about to make:
# --strictPort stops our preview binding, and wait-on then happily connects to
# the squatter. That turns the gate into a rubber stamp over a stale bundle, so
# refuse rather than report a pass that means nothing.
if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ':4200$'; then
  echo "!! port 4200 is in use — the smoke run would test THAT server, not this build." >&2
  echo "   stop it first (make down, or pkill -f 'vite preview'), then push again." >&2
  exit 1
fi

echo '==> ESLint'
npm run lint

echo '==> Frontend unit tests'
npm run test:run

echo '==> Elixir portal compiles clean'
# Compile only, not `mix test`: the suite needs a Postgres this script has no
# business standing up, and CI's `portal` job runs it against a real service
# container. A warning caught here is the thing a push actually introduces.
if command -v mix >/dev/null 2>&1; then
  (cd agents_demo && MIX_ENV=test mix compile --warnings-as-errors)
elif docker compose ps --status running --services 2>/dev/null | grep -qx elixir; then
  docker compose exec -T -e MIX_ENV=test elixir mix compile --warnings-as-errors
else
  echo 'Elixir verification needs either mix on PATH or the elixir container running (make up).' >&2
  exit 1
fi

echo '==> Production build'
VITE_MOCK_LOGIN=1 VITE_USE_MOCK=1 npm run build -- --outDir "$build_dir"

echo '==> End-user module smoke (login, Dashboard, Calls, Reports)'
setsid npx vite preview --configLoader runner --host 127.0.0.1 --port 4200 --strictPort --outDir "$build_dir" > /tmp/voipappz-verify-preview.log 2>&1 &
preview_pid=$!
npx wait-on -t 30000 http://127.0.0.1:4200

if [[ "${VERIFY_E2E_NATIVE:-0}" != "1" ]] && command -v docker >/dev/null 2>&1; then
  docker run --rm --network host \
    -v "$repo_dir:/work" -w /work \
    mcr.microsoft.com/playwright:v1.57.0-noble \
    npx playwright test tests/smoke.spec.ts --output=/tmp/voipappz-pw-results
else
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:4200 \
    npx playwright test tests/smoke.spec.ts --output="$build_dir/playwright-results"
fi

echo '==> Pre-push verification passed'
