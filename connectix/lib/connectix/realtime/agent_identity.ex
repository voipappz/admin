defmodule Connectix.Realtime.AgentIdentity do
  @moduledoc """
  The ids under which the switch knows a signed-in user.

  A callcenter event does not name the portal user. FreeSWITCH's `CC-Agent` —
  which the node copies into `user_uuid` and uses as the key of the
  `state.user.<id>` stream it publishes to — is the user's **`profile.powerlink_token`**,
  the CRM agent identity. The portal user uuid never appears on the wire.

  That was measured, not assumed: an `agent-state-change` carrying
  `CC-Agent cb1b0a46…` arrived while the browser held user `be5bc5f0…`, the two
  looked unrelated, and `cb1b0a46…` turned out to be that very user's
  `powerlink_token`. Subscribing to `state.user.<user_uuid>` and matching on
  the user uuid therefore listened on a stream the node never writes and
  compared against a value it never sends — silence, not a rejection.

  So the mapping the whole screen pop hinges on is `powerlink_token -> user`,
  and it is established here, once, when the user's socket connects. The token
  is not in the login JWT (that carries `user_uuid` only); it is on the user
  record, fetched with the user's own credential.

  ## Writing it down instead

  `priv/pocketflow/screen_pop.yaml` can name ids per user under `agents:`, and
  they are ADDED to whatever the record supplies. That exists because the
  lookup has two ways to give nothing — a record with no `powerlink_token`
  yet, and an API that cannot be reached — and both present as a silent
  session where no pop ever fires. A written mapping is also how this gets
  tested without a round trip to the mothership.
  """

  require Logger

  alias Connectix.Realtime.PopRule

  @doc """
  The ids an event may use to name this user: the `powerlink_token` on the
  user record, and nothing else. Empty when the record has none or cannot be
  fetched — logged at warning, because it means pops are off for this session
  and nothing else would say so.

  The portal uuid is deliberately NOT in the list. It used to be, as a
  "never fewer than `[user_uuid]`" fallback, and that fallback popped every
  call at every user: the node stamps `user_uuid` on the frames of a user's
  own state stream, the rule's `agent_fields` fall back from `meta.CC-Agent`
  to `user_uuid`, and so every recipient's own uuid matched every recipient.
  An identity that cannot be matched must yield no pop, never a pop for all.
  """
  @spec resolve(String.t(), String.t() | nil) :: [String.t()]
  def resolve(user_uuid, token) when is_binary(user_uuid) and is_binary(token) do
    configured = PopRule.agents_for(user_uuid)

    fetched =
      case fetch_record(user_uuid, token) do
        {:ok, record} ->
          ids(List.wrap(powerlink_token(record)))

        {:error, reason} ->
          # Named rather than counted: an unreachable API and a record with no
          # token are different problems with the same symptom, and the symptom
          # is a session where nothing ever pops.
          Logger.warning(
            "agent identity: could not load user #{user_uuid} (#{inspect(reason)})"
          )

          []
      end

    case ids(configured ++ fetched) do
      [] ->
        Logger.warning(
          "agent identity: user #{user_uuid} has no powerlink_token on their record " <>
            "and none in the rule file — callcenter pops will not fire for this session"
        )

        []

      resolved ->
        if configured != [] do
          Logger.info(
            "agent identity: user #{user_uuid} -> #{Enum.join(resolved, ", ")} " <>
              "(#{length(configured)} from the rule file)"
          )
        end

        resolved
    end
  end

  def resolve(user_uuid, _token) when is_binary(user_uuid), do: PopRule.agents_for(user_uuid)

  def resolve(_user_uuid, _token), do: []

  @doc """
  The `powerlink_token` on a user record, whichever of the API's two shapes it
  arrived in — `%{"user" => %{...}}` (the login body) or the bare user
  (`GET /api/users/:uuid`). `nil` when absent or blank.
  """
  @spec powerlink_token(map()) :: String.t() | nil
  def powerlink_token(%{"user" => %{} = user}), do: powerlink_token(user)

  def powerlink_token(%{"profile" => %{"powerlink_token" => token}})
      when is_binary(token) and token != "",
      do: token

  def powerlink_token(_record), do: nil

  # GET the record with the user's own bearer.
  #
  # Over HTTP to `ENGINE_URL`, the same upstream `Plugs.EngineProxy` forwards
  # to. This used to go over a WebSocket relay, which is gone; the API judges the
  # bearer exactly as it did, because it is the same request to the same place
  # with one fewer hop in front of it.
  defp fetch_record(user_uuid, token) do
    case engine() do
      "" ->
        {:error, :no_engine}

      upstream ->
        request(upstream <> "/api/users/#{user_uuid}", token)
    end
  end

  defp request(url, token) do
    case Req.request(
           method: :get,
           url: url,
           headers: [{"authorization", "Bearer #{token}"}],
           decode_body: false,
           retry: false,
           receive_timeout: 10_000
         ) do
      {:ok, %{status: 200, body: body}} ->
        case Jason.decode(body || "") do
          {:ok, %{} = record} -> {:ok, record}
          _undecodable -> {:error, :malformed_body}
        end

      {:ok, %{status: status}} ->
        {:error, {:status, status}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Same resolution as the proxy's, so one variable configures both.
  defp engine,
    do:
      (System.get_env("ENGINE_URL") || System.get_env("MOTHERSHIP_URL") || "")
      |> String.trim_trailing("/")

  defp ids(list), do: list |> Enum.reject(&(is_nil(&1) or &1 == "")) |> Enum.uniq()
end
