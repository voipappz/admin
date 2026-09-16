defmodule ConnectixWeb.Portal.StatusController do
  @moduledoc """
  The agent break-status vocabulary, served by this app.

  **Static, deliberately and temporarily.** The real list is per-customer rows
  (`voipappz-api lib/models/a_status.rb` — `{uuid, name, type}`, unique per
  `customer_uuid`), and this is a fixed stand-in so the extension's picker
  renders instead of erroring.

  ## Why it is not forwarded like the rest of `/api/`

  Because forwarding it currently returns 401. `Plugs.EngineProxy` relays over
  the broker now, and the node builds its upstream headers as
  `Content-Type` and nothing else — it deliberately does not replay the node's
  own credential, and in doing so it drops the CALLER's `Authorization` too. So
  every authenticated read over that relay loses its token. Login is unaffected
  (its credentials are in the body); this is not.

  The real fix is a frame field carrying the caller's `Authorization` through to
  the node, and it belongs in both repos. Until that lands, a picker that
  renders a fixed list beats one that shows an empty dropdown and a console 401.

  ## Why it is unauthenticated

  It is a vocabulary, not data: no user, no customer, nothing derived from the
  caller. Putting `UserTokenAuth` in front of it would also defeat the point —
  that plug verifies over NATS against whichever API this deployment's broker
  belongs to, which is exactly the hop failing when the token was issued
  elsewhere.

  **When this becomes real per-customer rows it must gain auth**, because then
  the answer depends on who is asking. It does not today.
  """

  use ConnectixWeb, :controller

  # `type: "on_break"` because that is what the extension asks for
  # (`main.component.ts` — `get("/api/statuses", {search: {type: 'on_break'}})`)
  # and what `Status::TYPES` calls this class of reason.
  #
  # The uuids are fixed and namespaced so they are recognisable in a log as
  # placeholders rather than mistaken for real rows — a stand-in that looks like
  # production data is the kind that quietly outlives its welcome.
  @on_break [
    %{uuid: "00000000-0000-4000-8000-00000000b001", name: "הפסקה", type: "on_break"},
    %{uuid: "00000000-0000-4000-8000-00000000b002", name: "פגישה", type: "on_break"},
    %{uuid: "00000000-0000-4000-8000-00000000b003", name: "הדרכה", type: "on_break"},
    %{uuid: "00000000-0000-4000-8000-00000000b004", name: "לא זמין", type: "on_break"}
  ]

  @doc """
  The status list, filtered by `?type=`.

  An unknown type returns `[]` rather than everything: a picker showing the
  wrong vocabulary is worse than one showing none, because only the second is
  obviously broken.
  """
  def index(conn, params) do
    json(conn, statuses(params["type"]))
  end

  defp statuses(nil), do: @on_break
  defp statuses("on_break"), do: @on_break
  defp statuses(_other), do: []
end
