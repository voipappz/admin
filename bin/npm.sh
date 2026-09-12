#!/usr/bin/env bash
# Run npm on the node this repo pins, whatever the shell's PATH says.
#
# `mise install` puts the pinned node under ~/.local/share/mise, but it is only
# on PATH once mise is activated in your shell -- and it is not, in a
# non-interactive `make` recipe. Looking only at `command -v node` then finds
# the system's Node 14 and npm ci fails, on a machine where the right node is
# installed and one directory away. Same class of bug as the API Makefile's
# tmuxinator lookup.
set -e -o pipefail

want=$(sed -n 's/^node *= *"\(.*\)"/\1/p' mise.toml 2>/dev/null | tr -d ' ')
want=${want:-22}; want_major=${want%%.*}

major_of() { "$1" --version 2>/dev/null | sed 's/v//; s/\..*//'; }

# 1. The npm already on PATH, if its node is new enough.
if command -v node >/dev/null 2>&1 && [ "$(major_of node)" -ge "$want_major" ] 2>/dev/null; then
  exec npm "$@"
fi

# 2. mise, which knows where the pinned node actually lives.
if command -v mise >/dev/null 2>&1; then
  exec mise exec -- npm "$@"
fi

# 3. mise's shims, for a machine where mise itself is not on PATH either.
shim="$HOME/.local/share/mise/shims/npm"
if [ -x "$shim" ]; then
  exec "$shim" "$@"
fi

echo "no node >= ${want_major} available. Run: make setup" >&2
exit 1
