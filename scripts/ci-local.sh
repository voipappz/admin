#!/usr/bin/env bash
# Run the GitHub Actions workflow locally with nektos/act.
#
#   scripts/ci-local.sh portal # Elixir portal job
#   scripts/ci-local.sh all    # complete workflow
#   scripts/ci-local.sh -l     # list jobs
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bin_dir="${ACT_BIN_DIR:-${TMPDIR:-/tmp}/voipappz-act}"
act_bin="${ACT_BIN:-$bin_dir/act}"
runner="${ACT_RUNNER_IMAGE:-catthehacker/ubuntu:act-latest}"

if [[ ! -x "$act_bin" ]]; then
  if command -v act >/dev/null 2>&1; then
    act_bin="$(command -v act)"
  else
    echo ">> fetching act into $bin_dir"
    mkdir -p "$bin_dir"
    curl -sSL https://raw.githubusercontent.com/nektos/act/master/install.sh |
      bash -s -- -b "$bin_dir" >/dev/null || {
        echo "could not install act — see https://github.com/nektos/act" >&2
        exit 1
      }
  fi
fi

echo ">> $($act_bin --version)"

# act imports ./.env by default. That file can contain tenant credentials and
# GitHub-hosted runners do not have it, so always run against an empty env file.
empty_env="${TMPDIR:-/tmp}/voipappz-act-empty.env"
: > "$empty_env" 2>/dev/null || empty_env=/dev/null

cd "$repo_dir"
if [[ "${1:-all}" == "-l" ]]; then
  exec "$act_bin" --env-file "$empty_env" -l -W .github/workflows/ci.yml
fi

mode="${1:-all}"
job_args=()
if [[ "$mode" != "all" ]]; then job_args=(-j "$mode"); fi

# NO --bind. It mounts the working tree into every job, so a job's own
# `mix deps.get` would write deps/ and _build/ into the real working tree, as
# root. Without it, act copies the workspace and honours .gitignore, so each
# job gets its own — which is what the real runner does, and what makes the
# run representative.
echo ">> running workflow: $mode"
exec "$act_bin" push -W .github/workflows/ci.yml \
  "${job_args[@]}" \
  -P "ubuntu-latest=$runner" \
  -P "ubuntu-24.04=$runner" \
  --container-architecture linux/amd64 \
  --pull=false \
  --env-file "$empty_env"
