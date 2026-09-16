defmodule Connectix.Realtime.Nats do
  @moduledoc """
  The one NATS connection this app holds.

  Every stream the platform publishes is on this broker first: a stream
  identifier IS its subject, verbatim — the node's broker backend publishes it
  that way.
  The portal used to read those streams through a WebSocket relay standing in
  front of it, which cost a hop, a process that decoded the whole firehose
  alone, and the ability to subscribe by wildcard — the relay required every
  stream named one at a time.

  This module owns the connection. `Realtime.NatsProducer` subscribes on it and
  `Realtime.EventPipeline` (Broadway) does the work. It also `publish/2`es, for
  the one thing the portal has to say rather than hear: the presence stamp that
  subscribing used to perform as a side effect (`ConnectixWeb.RealtimeSocket`).

  Unset `NATS_URL` and no connection starts. That is a configuration state, not
  a crash: the app still serves everything except events — no screen pop, an
  empty store — and `/health` says so.

  `Gnat.ConnectionSupervisor` reconnects on its own with a fixed backoff and
  never gives up — so an unreachable broker is a log line every few seconds,
  not a supervisor exhausting its restarts. What it does NOT do is restore
  subscriptions, because they belonged to the connection process that died;
  the producer watches for that and re-subscribes.
  """

  require Logger

  @connection __MODULE__.Connection

  @doc "The registered name of the connection, for `Gnat.sub/4` and friends."
  def connection, do: @connection

  @doc """
  Child specs for the supervision tree — empty when `NATS_URL` is unset.
  """
  def children do
    case settings() do
      nil ->
        []

      settings ->
        [
          %{
            id: @connection,
            start:
              {Gnat.ConnectionSupervisor, :start_link,
               [%{name: @connection, backoff_period: 2_000, connection_settings: [settings]}, []]}
          }
        ]
    end
  end

  @doc """
  Publish one JSON payload on a subject.

  `:ok`, or `{:error, reason}` when there is no connection — a caller that
  cannot announce something is never a caller that should crash.
  """
  @spec publish(String.t(), map()) :: :ok | {:error, term()}
  def publish(subject, payload) when is_binary(subject) and is_map(payload) do
    with {:ok, json} <- Jason.encode(payload),
         pid when is_pid(pid) <- GenServer.whereis(@connection) do
      Gnat.pub(pid, subject, json)
    else
      nil -> {:error, :not_connected}
      {:error, reason} -> {:error, reason}
    end
  catch
    :exit, reason -> {:error, {:exit, reason}}
  end

  @doc "Whether a broker is configured at all."
  def configured?, do: settings() != nil

  @doc """
  `NATS_URL` as the settings map `Gnat` takes, or nil.

  `nats://host:port`, with `user:pass@` or `token@` when the broker requires
  it. Pure, so the parse can be pinned by a test without a broker.
  """
  @spec settings() :: map() | nil
  def settings, do: settings(Connectix.Realtime.EventPipeline.url())

  @doc false
  def settings(nil), do: nil

  def settings(url) when is_binary(url) do
    uri = URI.parse(url)

    %{host: uri.host || "127.0.0.1", port: uri.port || 4222}
    |> put_auth(uri)
  end

  defp put_auth(settings, %URI{userinfo: info}) when is_binary(info) do
    case String.split(info, ":", parts: 2) do
      [user, pass] -> Map.merge(settings, %{username: user, password: pass, auth_required: true})
      [token] -> Map.merge(settings, %{token: token, auth_required: true})
    end
  end

  defp put_auth(settings, _uri), do: settings
end
