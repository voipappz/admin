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
  record, fetched with the user's own credential over the same relay the login
  took.
  """

  require Logger

  alias Connectix.Realtime.ApiProxy

  @doc """
  Every id an event may use to name this user: the portal uuid, plus the
  `powerlink_token` when the user record carries one.

  Never fewer than `[user_uuid]`, so a failed lookup degrades to the old
  behaviour rather than to a user nobody can match. The failure is logged at
  warning because it means callcenter pops are off for this session and
  nothing else would say so.
  """
  @spec resolve(String.t(), String.t()) :: [String.t()]
  def resolve(user_uuid, token) when is_binary(user_uuid) and is_binary(token) do
    case fetch_record(user_uuid, token) do
      {:ok, record} ->
        ids([user_uuid | List.wrap(powerlink_token(record))])

      {:error, reason} ->
        Logger.warning(
          "agent identity: could not load user #{user_uuid} (#{inspect(reason)}) — " <>
            "matching on user uuid only; callcenter pops will not fire for this session"
        )

        [user_uuid]
    end
  end

  def resolve(user_uuid, _token), do: List.wrap(user_uuid)

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

  # GET the record with the user's own bearer, over the cable relay.
  defp fetch_record(user_uuid, token) do
    case ApiProxy.request("GET", "/api/users/#{user_uuid}", "", nil, "Bearer #{token}") do
      {:ok, 200, body, _content_type} ->
        case Jason.decode(body) do
          {:ok, %{} = record} -> {:ok, record}
          _ -> {:error, :malformed_body}
        end

      {:ok, status, _body, _content_type} ->
        {:error, {:status, status}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp ids(list), do: list |> Enum.reject(&(is_nil(&1) or &1 == "")) |> Enum.uniq()
end
