#!/usr/bin/env bash
# Re-apply the parrot_platform source patches that real-call SIP interop depends
# on. `mix deps.get`/`mix deps.clean` re-download a pristine parrot, wiping these,
# so this script runs from the `deps.get`/`compile` mix aliases (see mix.exs) and
# is also safe to run by hand:  bash priv/parrot_patches/apply.sh
#
# Each patch is the minimal documented fix (see CLAUDE.md and the PATCH comments
# in the .patch files):
#   1. connection.ex  — received/rport only on the topmost Via (stacked Vias)
#   2. core.ex        — inbound INVITE uses transaction.request (data.request nil)
#   3. transaction.ex — Transaction struct implements Access (get_in traversals)
#
# Idempotent: a patch already applied is detected with `patch -R --dry-run` and
# skipped, so repeated runs are a no-op. Exit non-zero only on a real failure
# (e.g. parrot bumped and a hunk no longer applies — that needs a human).
set -euo pipefail

DEP_DIR="${DEP_DIR:-deps/parrot_platform}"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$DEP_DIR" ]; then
  echo "parrot_patches: $DEP_DIR not present yet — skipping (run after deps.get)"
  exit 0
fi

applied=0 skipped=0
for patch in "$PATCH_DIR"/*.patch; do
  [ -e "$patch" ] || continue
  # Filename convention: "<dep>__rest.patch" targets deps/<dep>; a plain name
  # targets parrot_platform (the original scope of this directory).
  base="$(basename "$patch")"
  case "$base" in
    *__*) dep_dir="deps/${base%%__*}" ;;
    *) dep_dir="$DEP_DIR" ;;
  esac
  if [ ! -d "$dep_dir" ]; then
    echo "parrot_patches: $dep_dir not present yet — skipping $base"
    continue
  fi
  if patch -p1 -d "$dep_dir" --reverse --dry-run --force <"$patch" >/dev/null 2>&1; then
    echo "parrot_patches: already applied — $base"
    skipped=$((skipped + 1))
  elif patch -p1 -d "$dep_dir" --forward --dry-run --force <"$patch" >/dev/null 2>&1; then
    patch -p1 -d "$dep_dir" --forward --force <"$patch" >/dev/null
    echo "parrot_patches: applied — $base"
    applied=$((applied + 1))
  else
    echo "parrot_patches: FAILED to apply $base — the dep may have changed; reconcile by hand." >&2
    exit 1
  fi
done

echo "parrot_patches: done ($applied applied, $skipped already present)"
