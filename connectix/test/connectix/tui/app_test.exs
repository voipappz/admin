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
      assert screen(%{m | focus: :events}) |> String.graphemes() |> Enum.count(&(&1 == "▸")) == 1
    end
  end

  describe "moving and selecting" do
    setup do
      {:ok, model: %Model{events: Enum.map(1..3, &event(%{"sid" => "call-#{&1}"})), focus: :events}}
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

  describe "agents" do
    defp agent(overrides \\ %{}) do
      now = System.system_time(:millisecond)

      Map.merge(
        %{
          user_uuid: "be5bc5f0-feb3-4c96-a370-3219f7ede250",
          agent_ids: ["cb1b0a46-77d5-4b3a-92d8-31768fea74e4"],
          sockets: [
            %{
              pid: self(),
              user_uuid: "be5bc5f0-feb3-4c96-a370-3219f7ede250",
              connected_at: now - 5_333_000,
              last_pong_at: now - 3_000,
              pushed: 412,
              remote_ip: "84.110.57.30"
            }
          ],
          cable: %{
            user_uuid: "be5bc5f0-feb3-4c96-a370-3219f7ede250",
            agent_ids: ["cb1b0a46-77d5-4b3a-92d8-31768fea74e4"],
            connected?: true,
            welcomed?: true,
            subscribed: 4,
            confirmed: 4,
            attempts: 0,
            last_frame_ms_ago: 2_000
          }
        },
        overrides
      )
    end

    test "one row per agent, with both halves" do
      out = screen(%Model{agents: [agent()]})
      assert out =~ "be5bc5f0"
      assert out =~ "cb1b0a46"
      assert out =~ "1h28m"
      assert out =~ "84.110.57.30"
      assert out =~ "4/4"
      assert out =~ "412"
      assert out =~ "agents (1)"
    end

    test "a missing half is named, not blank" do
      out = screen(%Model{agents: [agent(%{cable: nil})]})
      assert out =~ "none"

      out = screen(%Model{agents: [agent(%{sockets: []})]})
      assert out =~ "0 "
    end

    test "an empty portal says nobody is wired up" do
      assert screen(%Model{}) =~ "no agent has a socket or a cable client"
    end

    test "closes are listed with lifetime and reason" do
      now = System.system_time(:millisecond)

      m = %Model{
        closes: [
          %{at: now, user_uuid: "be5bc5f0-x", reason: :remote, lived_ms: 5_333_000, last_pong_at: now - 4_000}
        ]
      }

      out = screen(m)
      assert out =~ "lived 1h28m"
      assert out =~ ":remote"
      assert out =~ "last pong 4s before"
    end

    test "tab moves the cursor between the agents and the events" do
      m = %Model{agents: [agent()], events: [event()], focus: :agents}
      assert {:cont, %{focus: :events}} = App.key("\t", m)
      assert {:cont, %{focus: :agents}} = App.key("\t", %{m | focus: :events})
    end

    test "j and k move within the agents when they have the focus" do
      m = %Model{agents: [agent(), agent(%{user_uuid: "other"})], focus: :agents}
      assert {:cont, %{agent_selected: 1}} = App.key("j", m)
      assert {:cont, %{agent_selected: 0}} = App.key("k", m)
    end

    test "enter on an agent shows the whole row" do
      m = %Model{agents: [agent()], focus: :agents}
      assert {:cont, opened} = App.key("\r", m)
      assert screen(opened) =~ "last_frame_ms_ago"
    end

    test "x kicks the selected agent's sockets through the portal and reports it" do
      # `Inspector.kick/1` finds the socket rows by user, and this test
      # process is registered as one of them, so the kick lands here.
      uuid = "tui-kick-#{System.unique_integer([:positive])}"
      :ok = Connectix.Realtime.Sessions.opened(self(), %{user_uuid: uuid, environment_uuid: nil, agent_ids: []})
      on_exit(fn -> Connectix.Realtime.Sessions.closed(self(), :normal) end)

      m = %Model{agents: [agent(%{user_uuid: uuid})], focus: :agents}
      assert {:cont, after_kick} = App.key("x", m)
      assert_receive :kick
      assert after_kick.notice =~ "kicked 1 socket"
      assert screen(after_kick) =~ "kicked 1 socket"
    end

    test "c asks for a cable reconnect and reports when there is no client" do
      m = %Model{agents: [agent(%{user_uuid: "nobody-here"})], focus: :agents}
      assert {:cont, m} = App.key("c", m)
      assert m.notice =~ "no_client"
    end

    test "the status pane names the source" do
      assert screen(%Model{source: {:remote, :"connectix@127.0.0.1"}}) =~ "connectix@127.0.0.1"
      assert screen(%Model{source: :local}) =~ "this process"
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
