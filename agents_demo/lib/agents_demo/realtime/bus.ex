defmodule AgentsDemo.Realtime.Bus do
  @moduledoc """
  The one connection this app holds to the mothership: NATS request/reply.

  **This is the ASK path, and it is the only one.** Anything this app needs to
  know from the mothership — today, whether a token is real and whose it is —
  is a request on this bus. There is no HTTP client pointed at the API, and
  reintroducing one would put a second, differently-authenticated door on a
  service that already answers here.

  **It is not the event path.** Events arrive over cable
  (`AgentsDemo.Realtime.CableClient`), which is itself backed by NATS on the
  crystal side. So this app subscribes to no subject at all: cable owns the
  stream semantics — channel names, stream identifiers, and the
  `logged_in_at` registration that a confirmed subscription performs — and
  duplicating them as raw subjects here would fork that model.

  Two transports, two jobs: *ask* on NATS, *listen* on cable.

  Unset `NATS_URL` and this does not start. Callers get `{:error, :no_bus}`,
  which is a refusal, not a fallback — see `AgentsDemo.Realtime.TokenAuth` for
  why authenticating without the bus is the worse failure.
  """

  require Logger

  @conn __MODULE__.Connection

  @doc """
  Child specs for the supervision tree — empty when `NATS_URL` is unset.

  A missing broker is a configuration state, not a crash: the app still serves
  the SPA and still answers `/health`. What it will not do is authenticate.
  """
  def children do
    case connection_settings() do
      nil ->
        Logger.warning("realtime: NATS_URL is not set — token verification will refuse everything")
        []

      settings ->
        [
          %{
            id: @conn,
            start:
              {Gnat.ConnectionSupervisor, :start_link,
               [%{name: @conn, backoff_period: 2_000, connection_settings: [settings]}, []]}
          }
        ]
    end
  end

  @doc """
  One request, one reply, decoded from JSON.

  The deadline is short and failure is explicit. This sits on the critical path
  of every socket open, so a slow broker must not become a slow login.
  """
  @spec request(String.t(), map(), non_neg_integer()) :: {:ok, map()} | {:error, term()}
  def request(subject, payload, timeout \\ 2_000) do
    with {:ok, json} <- Jason.encode(payload),
         {:ok, %{body: body}} <- Gnat.request(@conn, subject, json, receive_timeout: timeout),
         {:ok, decoded} <- Jason.decode(body) do
      {:ok, decoded}
    else
      {:error, reason} -> {:error, reason}
      # Gnat raises when the named connection is not registered, but a caller
      # racing startup gets `:no_bus` rather than a match error.
      other -> {:error, other}
    end
  rescue
    # `Gnat.request` against an unstarted connection exits, and an exit here
    # would take the socket's caller down with it. The broker being absent is
    # an operational outcome; report it as one.
    e -> {:error, e}
  catch
    :exit, _ -> {:error, :no_bus}
  end

  @doc "Whether a bus is configured at all. Used to make the refusal legible."
  def configured?, do: connection_settings() != nil

  # `nats://host:port`, the same URL every other service on this platform takes.
  defp connection_settings do
    case System.get_env("NATS_URL") do
      url when is_binary(url) and url != "" ->
        uri = URI.parse(url)
        %{host: uri.host || "127.0.0.1", port: uri.port || 4222}
        |> put_auth(uri)

      _ ->
        nil
    end
  end

  defp put_auth(settings, %URI{userinfo: info}) when is_binary(info) do
    case String.split(info, ":", parts: 2) do
      [user, pass] -> Map.merge(settings, %{username: user, password: pass, auth_required: true})
      [token] -> Map.merge(settings, %{token: token, auth_required: true})
    end
  end

  defp put_auth(settings, _uri), do: settings
end
