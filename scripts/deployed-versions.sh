#!/usr/bin/env bash
# Which build is each destination actually running, and how far behind is it?
#
# THE NODE IS THE SOURCE OF TRUTH, not a deploy log and not someone's memory.
# Every release serves /release/info with the commit it was built from (see
# ConnectixWeb.ReleaseController and the RELEASE_SHA build arg), so "is prod
# current?" is a question with an answer rather than an inference from the last
# thing anyone remembers running.
#
# Read-only. Reaches the public hosts in config/deploy*.yml over HTTPS and
# changes nothing, so it is safe to run on a whim and safe to put in a loop.
set -uo pipefail   # NOT -e: one unreachable node must not stop the report,
                   # which is exactly when you most want to see the others.

cd "$(dirname "${BASH_SOURCE[0]}")/.."

head_sha=$(git rev-parse --short HEAD)
head_desc=$(git log -1 --pretty=%s | cut -c1-48)

printf '\n\033[1mDeployed builds\033[0m   local HEAD %s  %s\n\n' "$head_sha" "$head_desc"
printf '  %-10s %-30s %-12s %s\n' DEST HOST BUILD STATE
printf '  %-10s %-30s %-12s %s\n' ---- ---- ----- -----

drift=0

for f in config/deploy.*.yml; do
  dest=$(basename "$f" .yml | sed 's/^deploy\.//')

  # The public address is the FIRST proxy host. Destinations behind Kong
  # declare `proxy: false` and have none — they are not unreachable, they are
  # not reachable FROM HERE, and saying so beats printing a red error.
  host=$(awk '/^proxy:/{p=1;next} p&&/^[a-z]/{exit} p&&/^ *- /{sub(/^ *- /,""); print; exit}' "$f")

  if [ -z "$host" ]; then
    printf '  %-10s %-30s %-12s %s\n' "$dest" "-" "-" "no public host in config"
    continue
  fi

  info=$(curl -sk --max-time 10 "https://$host/release/info" 2>/dev/null)

  if [ -z "$info" ]; then
    printf '  %-10s %-30s %-12s \033[33m%s\033[0m\n' "$dest" "$host" "?" "unreachable"
    continue
  fi

  sha=$(printf '%s' "$info" | sed -n 's/.*"build_sha"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  ver=$(printf '%s' "$info" | sed -n 's/.*"app_version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

  if [ -z "$sha" ] || [ "$sha" = "unknown" ]; then
    printf '  %-10s %-30s %-12s %s\n' "$dest" "$host" "${ver:-?}" "no build sha (image predates it)"
    drift=1
    continue
  fi

  if [ "$sha" = "$head_sha" ]; then
    printf '  %-10s %-30s %-12s \033[32m%s\033[0m\n' "$dest" "$host" "$sha" "current"
  elif git cat-file -e "$sha^{commit}" 2>/dev/null; then
    # An ancestor is BEHIND and countable. Anything else was built from a
    # commit this checkout does not have — another branch, or a force-push —
    # and "behind by N" would be a lie, so it says what it knows instead.
    if git merge-base --is-ancestor "$sha" HEAD 2>/dev/null; then
      n=$(git rev-list --count "$sha..HEAD" 2>/dev/null)
      printf '  %-10s %-30s %-12s \033[33m%s\033[0m\n' "$dest" "$host" "$sha" "behind by $n commit(s)"
    else
      printf '  %-10s %-30s %-12s \033[33m%s\033[0m\n' "$dest" "$host" "$sha" "not an ancestor of HEAD"
    fi
    drift=1
  else
    printf '  %-10s %-30s %-12s \033[33m%s\033[0m\n' "$dest" "$host" "$sha" "unknown commit"
    drift=1
  fi
done

echo
[ "$drift" = "1" ] && echo "  make deploy DEST=<dest>   to bring one up to HEAD"
echo
