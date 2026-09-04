#!/usr/bin/env bash
# Where this stack is, whether it answers, and whether it is receiving events.
#
# One command, because the three were never separable. `urls` printed an address
# without saying if anything served it; `check-engine` probed the upstream in
# isolation; `verify` said "up" while a portal with an unconfirmed cable
# subscription stored nothing and looked perfectly healthy. Each answered a
# third of the same question and none of them answered it.
#
# The last section is the one that costs hours: a confirmed subscription on a
# stream nothing publishes to is indistinguishable from a healthy portal until
# you look at the store.
set -uo pipefail

PORTAL="${PORTAL:-http://localhost:4001}"
NODE="${PORTAL_NODE:-connectix@127.0.0.1}"

# The address AND its state on one line. An address nothing serves and a probe
# against the wrong port look identical when they are printed separately.
probe() {
  printf '  %-9s %-44s ' "$1" "$2"
  if curl -sf -o /dev/null --max-time 6 "$3"; then echo OK; else echo DOWN; fi
}

rpc() {
  docker compose exec -T elixir sh -lc \
    "elixir --name health-\$\$@127.0.0.1 --cookie \$(cat ~/.erlang.cookie) --rpc-eval $NODE '$1'" 2>/dev/null
}

echo "==> Services"
probe portal "$PORTAL"                          "$PORTAL/health/alive"
probe ready  "$PORTAL/health/ready"             "$PORTAL/health/ready"
[ -n "${CABLE_HEALTH:-}" ] && probe cable "${CABLE_URL:-$CABLE_HEALTH}" "$CABLE_HEALTH"

# The API the portal forwards to. A portal that is up while this is not answers
# every /auth and /api request with a failure that reads as broken auth.
if [ -n "${PORTAL_ENGINE_URL:-}" ]; then
  probe engine "$PORTAL_ENGINE_URL" "$PORTAL_ENGINE_URL/tasks/customer_portal_data"
fi

echo "==> Cable"
rpc 'st = :sys.get_state(Connectix.Realtime.ApiProxy)
IO.puts("  socket    " <> inspect(st.conn != nil))
Enum.each(MapSet.to_list(st.confirmed), fn i -> IO.puts("  confirmed " <> i) end)' \
  || echo "  (unreachable — is the portal running? make up)"

echo "==> Events"
rpc 's = Connectix.Events.stats()
IO.puts("  stored    " <> to_string(s.count) <> "   errors " <> to_string(s.errors))
case Connectix.Events.recent(limit: 1) do
  {:ok, [r | _]} ->
    age = div(System.system_time(:microsecond) - (r["create_date"] || 0), 1_000_000)
    IO.puts("  newest    " <> to_string(age) <> "s ago   " <> to_string(r["label"]))
  _ -> IO.puts("  newest    (nothing stored yet)")
end' || echo "  (unreachable)"
