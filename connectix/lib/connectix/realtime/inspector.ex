defmodule Connectix.Realtime.Inspector do
  @moduledoc """
  The running portal's realtime state, in one call, for a human.

  One row per signed-in agent, joining the two things that have to both be
  true for that agent to get a screen pop: a browser socket (`Sessions`) and a
  cable client the node confirmed (`CableClient`). Either can be present
  without the other — a cable client outlives the socket that opened it, and
  a socket can exist while its client is still reconnecting — and every
  "pops stopped" report so far has been one of those two halves missing.

  Read by the TUI over RPC (`Connectix.Tui`), and usable from `make iex`:

      Connectix.Realtime.Inspector.snapshot()
      Connectix.Realtime.Inspector.kick("be5bc5f0-…")
      Connectix.Realtime.Inspector.reconnect_cable("be5bc5f0-…")
  """

  alias Connectix.Realtime.{CableClient, Sessions}

  @type row :: %{
          user_uuid: String.t(),
          agent_ids: [String.t()],
          sockets: [map()],
          cable: map() | nil
        }

  @doc "Everything, as of now."
  @spec snapshot() :: %{agents: [row()], closes: [map()], api_proxy: map(), at: integer()}
  def snapshot do
    %{
      at: System.system_time(:millisecond),
      agents: agents(),
      closes: Sessions.recent_closes(20),
      api_proxy: api_proxy()
    }
  end

  @doc "One row per user that has a socket, a cable client, or both."
  def agents do
    sockets = Sessions.live() |> Enum.group_by(& &1.user_uuid)
    clients = CableClient.snapshots() |> Map.new(&{&1.user_uuid, &1})

    (Map.keys(sockets) ++ Map.keys(clients))
    |> Enum.uniq()
    |> Enum.sort()
    |> Enum.map(fn user_uuid ->
      socks = Map.get(sockets, user_uuid, [])
      client = Map.get(clients, user_uuid)

      %{
        user_uuid: user_uuid,
        agent_ids:
          (Enum.flat_map(socks, & &1.agent_ids) ++ ((client && client.agent_ids) || []))
          |> Enum.uniq()
          |> Enum.reject(&(&1 == user_uuid)),
        sockets: socks,
        cable: client
      }
    end)
  end

  @doc "The application connection: the relay and CallEvents for everyone."
  def api_proxy do
    st = :sys.get_state(Connectix.Realtime.ApiProxy, 1_000)

    %{
      configured?: true,
      connected?: st.conn != nil,
      relay_ready?: st.subscribed?,
      confirmed: st.confirmed |> MapSet.to_list() |> Enum.sort(),
      attempts: st.attempts,
      pending: map_size(st.pending),
      last_frame_ms_ago:
        if(st.last_frame_at, do: System.monotonic_time(:millisecond) - st.last_frame_at),
      url: System.get_env("CABLE_URL")
    }
  catch
    :exit, _ ->
      %{configured?: false, connected?: false, relay_ready?: false, confirmed: [], attempts: 0,
        pending: 0, last_frame_ms_ago: nil, url: System.get_env("CABLE_URL")}
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

  @doc "Drop and reopen this user's cable connection now. See `CableClient.reconnect/1`."
  @spec reconnect_cable(String.t()) :: :ok | {:error, :no_client}
  def reconnect_cable(user_uuid) when is_binary(user_uuid), do: CableClient.reconnect(user_uuid)
end
