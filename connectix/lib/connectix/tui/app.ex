defmodule Connectix.Tui.App do
  @moduledoc """
  The cockpit: what this portal is receiving, and who is wired up, live, in a
  terminal.

  It exists because the question that costs hours is not "is it up" — it is "is
  it receiving events, and is this agent actually connected". `/health/ready`
  answers the first and says nothing about the rest: a portal with a cable
  subscription that was never confirmed, or a user whose browser socket died
  an hour ago, is a healthy portal that pops nothing.

  So the panes are the facts that settle it: the store's totals, the
  subscriptions the node CONFIRMED, one row per signed-in agent (socket age,
  last pong, cable confirmed/attempts, last frame), the last socket closes
  with their reason and lifetime, and the events as they land. Two keys act:
  `x` closes an agent's socket (the extension reconnects on its own), `c`
  reopens their cable connection.

  ## It polls; it does not listen

  `Connectix.Events` is the source of truth and it dedupes — the node was
  measured re-delivering one frame 28 times. Counting frames off PubSub as they
  arrive would disagree with the store within a minute, and the disagreement
  would be in the cockpit rather than in the thing being diagnosed. A one-second
  re-read is cheap and cannot drift.
  """

  @behaviour_note "shape required by Connectix.Tui.Runtime: init/1 render/2 key/2 pubsub/2"
  @doc false
  def behaviour_note, do: @behaviour_note

  alias Connectix.Tui.{Model, Panels}
  alias Connectix.Tui.View.{Layout, Rect}

  @tick_ms 1_000

  def init(opts \\ []) do
    schedule_tick()
    Model.refresh(Model.new(opts))
  end

  # A detail view takes the whole frame: the thing being read is the raw event
  # or the whole agent row, and splitting the screen to keep a list visible
  # would make both unreadable.
  def render(%Model{detail?: true, focus: :agents} = m, frame) do
    [{Panels.agent_detail(m, area(frame)), area(frame)}]
  end

  def render(%Model{detail?: true} = m, frame) do
    [{Panels.detail(m, area(frame)), area(frame)}]
  end

  def render(%Model{} = m, frame) do
    agents_h = min(length(m.agents) + 3, 12)
    closes_h = 5

    [top, agents, closes, middle, bottom] =
      Layout.split(area(frame), :vertical, [
        {:length, 5},
        {:length, agents_h},
        {:length, closes_h},
        {:fill, 1},
        {:length, 8}
      ])

    [left, right] = Layout.split(top, :horizontal, [{:percentage, 55}, {:fill, 1}])

    [
      {Panels.status(m, left), left},
      {Panels.cable(m, right), right},
      {Panels.agents(m, agents), agents},
      {Panels.closes(m, closes), closes},
      {Panels.events(m, middle), middle},
      {Panels.help(m, bottom), bottom}
    ]
  end

  def key("q", model), do: {:halt, model}
  def key("\e", %Model{detail?: true} = m), do: {:cont, %{m | detail?: false}}
  def key("\e", model), do: {:halt, model}

  def key("\r", %Model{detail?: d} = m), do: {:cont, %{m | detail?: not d, notice: nil}}
  def key("\n", %Model{detail?: d} = m), do: {:cont, %{m | detail?: not d, notice: nil}}

  def key(k, m) when k in ["j", "\e[B"], do: {:cont, Model.move(%{m | notice: nil}, 1)}
  def key(k, m) when k in ["k", "\e[A"], do: {:cont, Model.move(%{m | notice: nil}, -1)}
  def key("\t", m), do: {:cont, Model.toggle_focus(%{m | notice: nil})}
  def key("g", %Model{focus: :events} = m), do: {:cont, %{m | selected: 0}}
  def key("G", %Model{focus: :events} = m), do: {:cont, %{m | selected: max(length(m.events) - 1, 0)}}

  def key("f", m), do: {:cont, m |> Model.cycle_filter() |> Model.refresh()}
  def key("r", m), do: {:cont, Model.refresh(%{m | notice: nil})}

  def key("x", m), do: {:cont, m |> Model.kick() |> Model.refresh()}
  def key("c", m), do: {:cont, m |> Model.reconnect_cable() |> Model.refresh()}

  def key(_other, model), do: {:cont, model}

  # The runtime hands every non-key message here, which is how the tick arrives.
  def pubsub(:tick, model) do
    schedule_tick()
    Model.refresh(model)
  end

  def pubsub(_message, model), do: model

  defp schedule_tick, do: Process.send_after(self(), :tick, @tick_ms)

  defp area(frame), do: %Rect{x: 0, y: 0, width: frame.width, height: frame.height}
end
