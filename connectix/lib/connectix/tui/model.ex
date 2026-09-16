defmodule Connectix.Tui.Model do
  @moduledoc """
  What the cockpit is showing, and nothing else.

  Deliberately small. `connectix.io/phone`'s model carried UAs, profiles,
  sessions, recordings and SIP state because its TUI drove a softphone; this one
  answers two questions — *is this portal receiving events, and is each
  signed-in agent actually wired up* — so it holds the last page of the store,
  the live numbers, and one row per agent from `Realtime.Inspector`.

  Everything here is a snapshot pulled by `refresh/1`. Nothing is accumulated
  from the wire: the store is the source of truth and it already dedupes the
  node's N-times delivery, so counting frames as they arrive would disagree
  with it within a minute.
  """

  alias Connectix.Tui.Source

  defstruct events: [],
            stats: %{},
            subjects: [],
            broker_url: nil,
            socket_open?: false,
            relay_ready?: false,
            # One row per agent: %{user_uuid, agent_ids, sockets, upstream}.
            agents: [],
            # Recent socket closes, newest first.
            closes: [],
            selected: 0,
            agent_selected: 0,
            # Which pane j/k drive and enter/x/c act on.
            focus: :agents,
            filter: nil,
            detail?: false,
            error: nil,
            # One line of feedback after an action (kick, reconnect), cleared by
            # the next key.
            notice: nil,
            source: :local,
            limit: 200

  @type t :: %__MODULE__{}

  @doc "A model with nothing in it yet — `refresh/1` fills it."
  def new(opts \\ []) do
    %__MODULE__{
      source: Keyword.get(opts, :source, :local),
      notice: Keyword.get(opts, :notice)
    }
  end

  @doc """
  Re-read the store, the upstream subscription and the agents.

  Each can fail independently and none is fatal: a portal whose upstream is down
  still has a store worth reading, and a store that cannot open still has
  sessions worth watching. A failure is shown, not raised.
  """
  def refresh(%__MODULE__{} = m) do
    m
    |> load_stats()
    |> load_events()
    |> load_realtime()
  end

  defp load_stats(m) do
    %{m | stats: Source.call(m.source, Connectix.Events, :stats, [])}
  rescue
    e -> %{m | error: Exception.message(e)}
  end

  defp load_events(m) do
    opts = [limit: m.limit] ++ if(m.filter, do: [src: m.filter], else: [])

    case Source.call(m.source, Connectix.Events, :recent, [opts]) do
      {:ok, rows} -> %{m | events: rows, error: nil}
      {:error, reason} -> %{m | events: [], error: inspect(reason)}
    end
  rescue
    e -> %{m | events: [], error: Exception.message(e)}
  end

  defp load_realtime(m) do
    snap = Source.call(m.source, Connectix.Realtime.Inspector, :snapshot, [])
    proxy = snap.api_proxy

    %{
      m
      | subjects: proxy.confirmed,
        socket_open?: proxy.connected?,
        relay_ready?: proxy.relay_ready?,
        broker_url: proxy.url,
        agents: snap.agents,
        closes: snap.closes,
        agent_selected: min(m.agent_selected, max(length(snap.agents) - 1, 0))
    }
  rescue
    e -> %{m | agents: [], closes: [], error: Exception.message(e)}
  end

  @doc "The event under the cursor, or nil when the store is empty."
  def current(%__MODULE__{events: []}), do: nil
  def current(%__MODULE__{events: rows, selected: i}), do: Enum.at(rows, i)

  @doc "The agent row under the cursor, or nil."
  def current_agent(%__MODULE__{agents: []}), do: nil
  def current_agent(%__MODULE__{agents: rows, agent_selected: i}), do: Enum.at(rows, i)

  def move(%__MODULE__{focus: :events, events: []} = m, _delta), do: m

  def move(%__MODULE__{focus: :events} = m, delta) do
    %{m | selected: m.selected |> Kernel.+(delta) |> max(0) |> min(length(m.events) - 1)}
  end

  def move(%__MODULE__{focus: :agents, agents: []} = m, _delta), do: m

  def move(%__MODULE__{focus: :agents} = m, delta) do
    %{
      m
      | agent_selected: m.agent_selected |> Kernel.+(delta) |> max(0) |> min(length(m.agents) - 1)
    }
  end

  def toggle_focus(%__MODULE__{focus: :agents} = m), do: %{m | focus: :events}
  def toggle_focus(%__MODULE__{} = m), do: %{m | focus: :agents}

  @doc "Tell the portal to close every socket of the selected agent."
  def kick(%__MODULE__{} = m) do
    case current_agent(m) do
      nil ->
        %{m | notice: "no agent selected"}

      %{user_uuid: uuid} ->
        n = Source.call(m.source, Connectix.Realtime.Inspector, :kick, [uuid])
        %{m | notice: "kicked #{n} socket(s) of #{short(uuid)} — the extension reconnects in ~3s"}
    end
  rescue
    e -> %{m | notice: "kick failed: #{Exception.message(e)}"}
  end

  @doc "Tell the portal to retake the upstream subscription."
  def resubscribe(%__MODULE__{} = m) do
    # Not per-agent: one subscription carries everyone, so this asks the portal
    # to take it again rather than singling out the selected row.
    case Source.call(m.source, Connectix.Realtime.Inspector, :resubscribe, []) do
      :ok -> %{m | notice: "upstream resubscribe requested"}
      other -> %{m | notice: "upstream resubscribe: #{inspect(other)}"}
    end
  rescue
    e -> %{m | notice: "resubscribe failed: #{Exception.message(e)}"}
  end

  @doc """
  Cycle the `src` filter across the streams the store actually holds.

  Built from the rows rather than from a fixed list, so a stream that starts
  appearing shows up here without a code change — which is the whole point of
  the store's generic `src` column.
  """
  def cycle_filter(%__MODULE__{} = m) do
    sources = m.events |> Enum.map(& &1["src"]) |> Enum.uniq() |> Enum.sort()

    next =
      case {m.filter, sources} do
        {_, []} -> nil
        {nil, [first | _]} -> first
        {current, srcs} -> Enum.at(srcs, Enum.find_index(srcs, &(&1 == current)) + 1)
      end

    %{m | filter: next, selected: 0}
  end

  @doc false
  def short(nil), do: "-"
  def short(uuid) when is_binary(uuid), do: String.slice(uuid, 0, 8)
end
