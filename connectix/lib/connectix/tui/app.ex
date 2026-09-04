defmodule Connectix.Tui.App do
  @moduledoc """
  The cockpit: what this portal is receiving, live, in a terminal.

  It exists because the question that costs hours is not "is it up" — it is "is
  it receiving events, and which ones". `/health/ready` answers the first and
  says nothing about the second: a portal with a cable subscription that was
  never confirmed, or confirmed on a stream nothing publishes to, is a healthy
  portal that stores nothing.

  So the four panes are the four facts that settle it: the store's totals, the
  subscriptions the node CONFIRMED, the last page of events with their ages,
  and one event in full.

  ## It polls; it does not listen

  `Connectix.Events` is the source of truth and it dedupes — the node was
  measured re-delivering one frame 28 times. Counting frames off PubSub as they
  arrive would disagree with the store within a minute, and the disagreement
  would be in the cockpit rather than in the thing being diagnosed. A one-second
  re-read is cheap and cannot drift.
  """

  @behaviour_note "shape required by Connectix.Tui.Runtime: init/0 render/2 key/2 pubsub/2"
  @doc false
  def behaviour_note, do: @behaviour_note

  alias Connectix.Tui.{Model, Panels}
  alias Connectix.Tui.View.{Layout, Rect}

  @tick_ms 1_000

  def init do
    schedule_tick()
    Model.refresh(Model.new())
  end

  # A detail view takes the whole frame: the raw event is the thing being read,
  # and splitting the screen to keep a list visible would make both unreadable.
  def render(%Model{detail?: true} = m, frame) do
    [{Panels.detail(m, area(frame)), area(frame)}]
  end

  def render(%Model{} = m, frame) do
    [top, middle, bottom] =
      Layout.split(area(frame), :vertical, [{:length, 5}, {:fill, 1}, {:length, 7}])

    [left, right] = Layout.split(top, :horizontal, [{:percentage, 55}, {:fill, 1}])

    [
      {Panels.status(m, left), left},
      {Panels.cable(m, right), right},
      {Panels.events(m, middle), middle},
      {Panels.help(m, bottom), bottom}
    ]
  end

  def key("q", model), do: {:halt, model}
  def key("\e", %Model{detail?: true} = m), do: {:cont, %{m | detail?: false}}
  def key("\e", model), do: {:halt, model}

  def key("\r", %Model{detail?: d} = m), do: {:cont, %{m | detail?: not d}}
  def key("\n", %Model{detail?: d} = m), do: {:cont, %{m | detail?: not d}}

  def key(k, m) when k in ["j", "\e[B"], do: {:cont, Model.move(m, 1)}
  def key(k, m) when k in ["k", "\e[A"], do: {:cont, Model.move(m, -1)}
  def key("g", m), do: {:cont, %{m | selected: 0}}
  def key("G", m), do: {:cont, %{m | selected: max(length(m.events) - 1, 0)}}

  def key("f", m), do: {:cont, m |> Model.cycle_filter() |> Model.refresh()}
  def key("r", m), do: {:cont, Model.refresh(m)}

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
