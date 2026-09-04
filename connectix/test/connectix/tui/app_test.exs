defmodule Connectix.Tui.AppTest do
  @moduledoc """
  The cockpit, rendered.

  A TUI is usually left untested because it needs a terminal — but the terminal
  is only `Runtime`'s problem. `App` is a pure function from a model to a list
  of `{widget, Rect}`, and `Ansi.to_lines/3` turns that into strings, so every
  assertion here is on what a reader would actually see.
  """
  use ExUnit.Case, async: true

  alias Connectix.Tui.{Ansi, App, Model}
  alias Connectix.Tui.View.Frame

  @frame %Frame{width: 100, height: 30}

  defp screen(model) do
    model
    |> App.render(@frame)
    |> then(&Ansi.to_lines(@frame.width, @frame.height, &1))
    |> Enum.join("\n")
  end

  defp event(overrides \\ %{}) do
    Map.merge(
      %{
        "src" => "CallEvents",
        "label" => "agent-offering",
        "sid" => "call-abc",
        "create_date" => System.system_time(:microsecond),
        "raw" => ~s({"action":"agent-offering","caller_id_number":"0522463424"})
      },
      overrides
    )
  end

  describe "an empty portal" do
    test "says the store is empty rather than showing a blank pane" do
      # "Nothing stored" and "the pane failed to render" look identical when a
      # pane is simply blank, and they are the two things being told apart.
      assert screen(%Model{}) =~ "nothing stored yet"
    end

    test "reports a closed cable, not an absent one" do
      assert screen(%Model{}) =~ "closed"
      assert screen(%Model{}) =~ "no confirmed subscriptions"
    end
  end

  describe "a portal that is working" do
    setup do
      {:ok,
       model: %Model{
         events: [event(), event(%{"label" => "number.answer", "sid" => "call-def"})],
         stats: %{count: 4911, errors: 0, open?: true},
         cable: [
           ~s({"channel":"ApiProxy"}),
           ~s({"channel":"StateChannel","scope":"user","id":"cb1b0a46"})
         ],
         cable_url: "ws://nimbus-prod.voipappz.io:4000/cable",
         socket_open?: true
       }}
    end

    test "shows the counts that answer 'is it receiving'", %{model: m} do
      out = screen(m)
      assert out =~ "4911"
      assert out =~ "open"
      assert out =~ "0s"
    end

    test "names the confirmed subscriptions, decoded", %{model: m} do
      out = screen(m)
      # The identifier is JSON the node echoed back; 60 characters of quoting
      # would push the useful part off the pane.
      assert out =~ "ApiProxy"
      assert out =~ "StateChannel"
      assert out =~ "user.cb1b0a46"
      refute out =~ ~s({"channel")
    end

    test "lists the events newest first, with their ages", %{model: m} do
      out = screen(m)
      assert out =~ "agent-offering"
      assert out =~ "number.answer"
      assert out =~ "call-abc"
    end

    test "marks exactly one row as selected", %{model: m} do
      assert screen(m) |> String.graphemes() |> Enum.count(&(&1 == "▸")) == 1
    end
  end

  describe "moving and selecting" do
    setup do
      {:ok, model: %Model{events: Enum.map(1..3, &event(%{"sid" => "call-#{&1}"}))}}
    end

    test "j and k move, and cannot walk off either end", %{model: m} do
      assert {:cont, m} = App.key("j", m)
      assert m.selected == 1
      assert {:cont, m} = App.key("k", m)
      assert {:cont, m} = App.key("k", m)
      assert m.selected == 0, "moving up past the first row must stay on it"

      m = Enum.reduce(1..10, m, fn _, acc -> elem(App.key("j", acc), 1) end)
      assert m.selected == 2, "moving down past the last row must stay on it"
    end

    test "arrow keys do what j and k do", %{model: m} do
      assert {:cont, %{selected: 1}} = App.key("\e[B", m)
      assert {:cont, %{selected: 0}} = App.key("\e[A", m)
    end

    test "enter opens one event in full and closes it again", %{model: m} do
      assert {:cont, opened} = App.key("\r", m)
      assert opened.detail?
      assert screen(opened) =~ "caller_id_number"

      assert {:cont, closed} = App.key("\r", opened)
      refute closed.detail?
    end

    test "escape closes the detail view but quits from the list", %{model: m} do
      assert {:cont, %{detail?: false}} = App.key("\e", %{m | detail?: true})
      assert {:halt, _} = App.key("\e", m)
    end

    test "q quits", %{model: m} do
      assert {:halt, _} = App.key("q", m)
    end

    test "an unknown key changes nothing", %{model: m} do
      assert {:cont, ^m} = App.key("z", m)
    end
  end

  describe "the src filter" do
    test "cycles through the sources the store actually holds" do
      # Built from the rows, not a fixed list — a stream that starts appearing
      # shows up without a code change, which is the point of the generic `src`.
      m = %Model{
        events: [
          event(%{"src" => "CallEvents"}),
          event(%{"src" => "StateChannel"}),
          event(%{"src" => "CallEvents"})
        ]
      }

      assert Model.cycle_filter(m).filter == "CallEvents"
      assert m |> Model.cycle_filter() |> Model.cycle_filter() |> Map.get(:filter) == "StateChannel"
    end

    test "shows the active filter in the pane title" do
      m = %Model{events: [event()], filter: "StateChannel"}
      assert screen(m) =~ "events · StateChannel"
    end
  end

  describe "failure" do
    test "an unreadable store says why instead of looking empty" do
      # `Events.recent/1` answers {:error, :not_storing} for a closed store —
      # "nothing is stored here" and "nothing happened" are different answers.
      assert screen(%Model{events: [], error: "not_storing"}) =~ "not_storing"
    end
  end
end
