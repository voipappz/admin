#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

echo '==> Elixir portal compiles clean'
# Compile only, not `mix test`: the suite needs infra this script has no
# business standing up, and CI's `portal` job runs it against a real service
# container. A warning caught here is the thing a push actually introduces.
if command -v mix >/dev/null 2>&1; then
  (cd connectix && MIX_ENV=test mix compile --warnings-as-errors)
elif docker compose ps --status running --services 2>/dev/null | grep -qx elixir; then
  docker compose exec -T -e MIX_ENV=test elixir mix compile --warnings-as-errors
else
  echo 'Elixir verification needs either mix on PATH or the elixir container running (make up).' >&2
  exit 1
fi

echo '==> Pre-push verification passed'
