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

# The e2e job serves its OWN build on :4200 and waits for it. act's runner shares
# the host network, so a dev stack already holding that port (make dev / make up,
# or a leaked `vite preview`) answers the wait instead — and that server is built
# WITHOUT VITE_MOCK_LOGIN, so every post-login spec dies at the OTP step against a
# real mothership. The job "fails" with nothing wrong in the code. Refuse to start.
if [[ "$mode" == "e2e" || "$mode" == "all" ]]; then
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ':4200$'; then
    echo "!! port 4200 is already in use — the e2e job would test THAT server, not its own build." >&2
    echo "   stop it first (make down, or pkill -f 'vite preview'), then re-run." >&2
    exit 1
  fi
fi

# The cable-events job starts its own stack on 14001/14100/14222/18222. A
# leftover stack (a killed run, a `make test-cable` still up) would answer the
# readiness gate in its place and the job would test THAT. Refuse to start.
if [[ "$mode" == "cable-events" || "$mode" == "all" ]]; then
  for port in 14001 14100 14222 18222 18021 18022; do
    if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ":$port\$"; then
      echo "!! port $port is already in use — the cable-events job would test THAT stack, not its own." >&2
      echo "   docker compose -f tests/cable-events/docker-compose.yml down -v, then re-run." >&2
      exit 1
    fi
  done
fi

# The empty env file keeps tenant credentials out; this one variable is the
# exception, passed explicitly: the published node image may be behind the
# source, and a locally built one is the only way to run the job then.
extra_env=()
if [[ -n "${VA_CRYSTAL_IMAGE:-}" ]]; then extra_env=(--env "VA_CRYSTAL_IMAGE=$VA_CRYSTAL_IMAGE"); fi

echo ">> running workflow: $mode"
exec "$act_bin" push -W .github/workflows/ci.yml \
  "${job_args[@]}" \
  -P "ubuntu-latest=$runner" \
  -P "ubuntu-24.04=$runner" \
  --container-architecture linux/amd64 \
  --pull=false \
  --bind \
  --env-file "$empty_env" \
  "${extra_env[@]}"
