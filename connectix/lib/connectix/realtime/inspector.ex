defmodule Connectix.Realtime.Inspector do
  @moduledoc """
  The running portal's realtime state, in one call, for a human.

  One row per signed-in agent: their browser sockets and the ids the switch
  knows them by. Those ids are the half that used to go missing — an agent
  with a socket but no `powerlink_token` registered receives nothing, because
  every frame about them arrives addressed to an id nobody claims.

  The other half is no longer per-agent. Events used to arrive on one upstream
  connection per user, so a row could show one half up and the other down; they
  now arrive on ONE broker subscription for the whole portal, reported once
  rather than per agent.

  Read by the TUI over RPC (`Connectix.Tui`), and usable from `make iex`:

      Connectix.Realtime.Inspector.snapshot()
      Connectix.Realtime.Inspector.kick("be5bc5f0-…")
      Connectix.Realtime.Inspector.resubscribe()
  """

  alias Connectix.Realtime.Sessions

  @type row :: %{
          user_uuid: String.t(),
          agent_ids: [String.t()],
          sockets: [map()],
          upstream: map() | nil
        }

  @doc "Everything, as of now."
  @spec snapshot() :: %{agents: [row()], closes: [map()], api_proxy: map(), at: integer()}
  def snapshot do
    %{
      at: System.system_time(:millisecond),
      agents: agents(),
      closes: Sessions.recent_closes(20),
      # Still called `api_proxy` because that is the key the TUI reads and it
      # answers the same question the old one did: is the thing that carries
      # everyone's events actually up.
      api_proxy: nats()
    }
  end

  @doc "One row per user that has a browser socket."
  def agents do
    sockets = Sessions.live() |> Enum.group_by(& &1.user_uuid)

    sockets
    |> Map.keys()
    |> Enum.sort()
    |> Enum.map(fn user_uuid ->
      socks = Map.get(sockets, user_uuid, [])

      %{
        user_uuid: user_uuid,
        agent_ids:
          socks
          |> Enum.flat_map(& &1.agent_ids)
          |> Enum.uniq()
          |> Enum.reject(&(&1 == user_uuid)),
        sockets: socks,
        # No per-user upstream any more: everyone's events arrive on the one
        # subscription reported in `api_proxy`. Kept so a row's shape does not
        # depend on which half exists.
        upstream: nil
      }
    end)
  end

  @doc """
  The one subscription that carries every user's events.

  `configured?` is whether this deployment was given a broker at all;
  `relay_ready?` is whether the producer is actually subscribed. The gap
  between them is the whole failure mode — a portal pointed at a broker it
  cannot reach looks identical to a quiet switch.
  """
  def nats do
    status = Connectix.Realtime.NatsProducer.status()

    %{
      configured?: Connectix.Realtime.EventPipeline.enabled?(),
      connected?: status not in [:not_started, :connecting, :disconnected],
      relay_ready?: match?({:subscribed, _}, status),
      confirmed:
        case status do
          {:subscribed, subjects} -> Enum.sort(subjects)
          _not_subscribed -> []
        end,
      attempts: 0,
      pending: 0,
      last_frame_ms_ago: nil,
      url: Connectix.Config.nats_url()
    }
  end

  @doc """
  Close every browser socket this user has. The extension reconnects on its
  own three seconds later and re-registers — the recovery a re-login gives,
  without the agent doing anything. Returns how many sockets were told to go.
  """
  @spec kick(String.t()) :: non_neg_integer()
  def kick(user_uuid) when is_binary(user_uuid) do
    Sessions.live()
    |> Enum.filter(&(&1.user_uuid == user_uuid))
    |> Enum.map(fn %{pid: pid} -> send(pid, :kick) end)
    |> length()
  end

  @doc """
  Reopen the one upstream subscription every agent's events arrive on.

  There is nothing per-agent left to reopen, so this is deliberately global:
  it drops the broker subscription and lets the producer take it again. Kicking
  one agent's socket (`kick/1`) is the per-agent recovery.
  """
  @spec resubscribe() :: :ok
  def resubscribe, do: Connectix.Realtime.NatsProducer.resubscribe()
end
