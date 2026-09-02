defmodule AgentsDemo.Realtime.CableClientTest do
  @moduledoc """
  What this app does to a cable message before a client sees it.

  **The relay contract itself is tested in va-crystal**, against a live broker,
  where the wire is — `node/spec/realtime/screen_pop_relay_spec.cr`. That is the
  right place for it: the pop is composed by voipappz-api and carried by the
  node, and neither hop is this app's to assert on.

  What is left here is only what happens on THIS side of the socket, and it is
  two things:

    * routing — a notification and a state delta arrive on one connection and
      must not be confused for one another;
    * the fold — the one place this app is not a pure relay.
  """

  use ExUnit.Case, async: true

  alias AgentsDemo.Realtime.CableClient

  @user_uuid "11111111-2222-3333-4444-555555555555"
  @topic "realtime:user:#{@user_uuid}"

  # The identifiers cable subscribes with, which is how `fanout/3` tells the two
  # streams apart.
  @notifications Jason.encode!(%{channel: "Notifications", user_uuid: @user_uuid})
  @dashboard_user Jason.encode!(%{channel: "DashboardUser", user_uuid: @user_uuid})

  setup do
    :ok = Phoenix.PubSub.subscribe(AgentsDemo.PubSub, @topic)
    {:ok, state: %CableClient{user_uuid: @user_uuid}}
  end

  describe "routing between the two streams on one connection" do
    test "a notification is handed on untouched", %{state: state} do
      # String keys: it has been through JSON twice by the time it reaches here.
      pop = %{"action" => "tab:new", "url" => "https://crm.example.com/r?id=42#tab=calls"}

      CableClient.fanout(state, @notifications, pop)

      assert_receive {:realtime, frame}
      assert frame.type == "notification"
      # Verbatim, not merely equivalent. The extension matches on
      # `data.action == "tab:new"` and reads `data.url`; renaming or nesting any
      # of it breaks a client this app cannot see, and breaks it silently — an
      # unrecognised notification is stored for the popup rather than raising.
      assert frame.message == pop
    end

    test "a state delta never produces a notification frame", %{state: state} do
      # A tab must open because voipappz-api said so, not because a state delta
      # happened to carry a field that looks like an instruction.
      CableClient.fanout(state, @dashboard_user, %{
        "event" => "user.ringing",
        "ops" => [%{"op" => "set", "key" => "user:#{@user_uuid}:action", "value" => "tab:new"}]
      })

      assert_receive {:realtime, frame}
      assert frame.type == "user.state"
    end
  end

  describe "the fold, which is the one thing this app adds" do
    test "does not crash on the first state message", %{state: state} do
      # `fanout/3` reads state.view and writes it back. With no `:view` in the
      # struct that was a KeyError on the FIRST state message, which killed this
      # GenServer — and took the Notifications subscription down with it, so the
      # visible symptom was screen pops that simply stopped.
      returned =
        CableClient.fanout(state, @dashboard_user, %{
          "event" => "user.answer",
          "ops" => [%{"op" => "set", "key" => "user:#{@user_uuid}:status", "value" => "busy"}]
        })

      assert_receive {:realtime, %{type: "user.state", view: view}}
      assert view == %{"status" => "busy"}
      assert returned.view == %{"status" => "busy"}
    end

    test "accumulates across messages, because the node keeps no totals", %{state: state} do
      state =
        CableClient.fanout(state, @dashboard_user, %{
          "ops" => [%{"op" => "set", "key" => "user:#{@user_uuid}:status", "value" => "busy"}]
        })

      state =
        CableClient.fanout(state, @dashboard_user, %{
          "ops" => [%{"op" => "incr", "key" => "user:#{@user_uuid}:calls", "by" => 1}]
        })

      _state =
        CableClient.fanout(state, @dashboard_user, %{
          "ops" => [%{"op" => "incr", "key" => "user:#{@user_uuid}:calls", "by" => 1}]
        })

      assert_receive {:realtime, %{type: "user.state"}}
      assert_receive {:realtime, %{type: "user.state"}}
      assert_receive {:realtime, %{type: "user.state", view: view}}

      # `incr` is a DELTA — two of them mean two, not one.
      assert view == %{"status" => "busy", "calls" => 2}
    end
  end
end
