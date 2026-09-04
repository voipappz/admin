defmodule Connectix.Tui.Model do
  @moduledoc """
  What the cockpit is showing, and nothing else.

  Deliberately small. `connectix.io/phone`'s model carried UAs, profiles,
  sessions, recordings and SIP state because its TUI drove a softphone; this one
  answers a single question — *is this portal receiving events, and what are
  they* — so it holds the last page of the store plus the two live numbers.

  Everything here is a snapshot pulled by `refresh/1`. Nothing is accumulated
  from the wire: the store is the source of truth and it already dedupes the
  node's N-times delivery, so counting frames as they arrive would disagree
  with it within a minute.
  """

  defstruct events: [],
            stats: %{},
            cable: [],
            cable_url: nil,
            socket_open?: false,
            selected: 0,
            filter: nil,
            detail?: false,
            error: nil,
            limit: 200

  @type t :: %__MODULE__{}

  @doc "A model with nothing in it yet — `refresh/1` fills it."
  def new, do: %__MODULE__{}

  @doc """
  Re-read the store and the cable connection.

  Both can fail independently and neither is fatal: a portal whose cable is
  down still has a store worth reading, and a store that cannot open still has
  a cable worth watching. A failure of either is shown, not raised.
  """
  def refresh(%__MODULE__{} = m) do
    m
    |> load_stats()
    |> load_events()
    |> load_cable()
  end

  defp load_stats(m) do
    %{m | stats: Connectix.Events.stats()}
  rescue
    e -> %{m | error: Exception.message(e)}
  end

  defp load_events(m) do
    opts = [limit: m.limit] ++ if(m.filter, do: [src: m.filter], else: [])

    case Connectix.Events.recent(opts) do
      {:ok, rows} -> %{m | events: rows, error: nil}
      {:error, reason} -> %{m | events: [], error: inspect(reason)}
    end
  rescue
    e -> %{m | events: [], error: Exception.message(e)}
  end

  defp load_cable(m) do
    st = :sys.get_state(Connectix.Realtime.ApiProxy)

    %{
      m
      | cable: st.confirmed |> MapSet.to_list() |> Enum.sort(),
        socket_open?: st.conn != nil,
        cable_url: System.get_env("CABLE_URL")
    }
  catch
    # No cable configured, or the process is not running — not an error, just
    # nothing to show. `CABLE_URL` unset is a supported deployment.
    :exit, _ -> %{m | cable: [], socket_open?: false}
  end

  @doc "The row under the cursor, or nil when the store is empty."
  def current(%__MODULE__{events: []}), do: nil
  def current(%__MODULE__{events: rows, selected: i}), do: Enum.at(rows, i)

  def move(%__MODULE__{events: []} = m, _delta), do: m

  def move(%__MODULE__{} = m, delta) do
    %{m | selected: m.selected |> Kernel.+(delta) |> max(0) |> min(length(m.events) - 1)}
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
end
