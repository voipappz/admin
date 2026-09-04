#!/usr/bin/env bash
# Deep health for the local portal.
#
# `make verify` answers "is it up". This answers "is it receiving events",
# which is a different question and the one that costs hours: a portal can
# answer /health/ready with a cable subscription that was never confirmed, or
# confirmed on a stream nothing publishes to, and look perfectly healthy while
# storing nothing.
#
# Both answers live inside the running BEAM, so this asks it over a distributed
# RPC rather than guessing from the outside.
set -uo pipefail

PORTAL="${PORTAL:-http://localhost:4001}"
NODE="${PORTAL_NODE:-connectix@127.0.0.1}"

probe() { printf "  %-22s " "$1"; curl -sf -o /dev/null "$2" && echo OK || echo DOWN; }

rpc() {
  docker compose exec -T elixir sh -lc \
    "elixir --name health-\$\$@127.0.0.1 --cookie \$(cat ~/.erlang.cookie) --rpc-eval $NODE '$1'" 2>/dev/null
}

echo "==> Services"
probe "portal /health/alive" "$PORTAL/health/alive"
probe "portal /health/ready" "$PORTAL/health/ready"
probe "web (vite)" "${WEB_APP:-http://localhost:4200}/"
[ -n "${CABLE_HEALTH:-}" ] && probe "cable" "$CABLE_HEALTH"

echo "==> Cable"
rpc 'st = :sys.get_state(Connectix.Realtime.ApiProxy)
IO.puts("  url                    " <> to_string(System.get_env("CABLE_URL")))
IO.puts("  socket open            " <> inspect(st.conn != nil))
Enum.each(MapSet.to_list(st.confirmed), fn i -> IO.puts("  confirmed              " <> i) end)' \
  || echo "  (unreachable — is the portal running? make up)"

echo "==> Events"
rpc 's = Connectix.Events.stats()
IO.puts("  stored                 " <> to_string(s.count) <> "   errors " <> to_string(s.errors))
case Connectix.Events.recent(limit: 1) do
  {:ok, [r | _]} ->
    age = div(System.system_time(:microsecond) - (r["create_date"] || 0), 1_000_000)
    IO.puts("  newest                 " <> to_string(age) <> "s ago   " <> to_string(r["label"]))
  _ -> IO.puts("  newest                 (nothing stored yet)")
end' || echo "  (unreachable)"
