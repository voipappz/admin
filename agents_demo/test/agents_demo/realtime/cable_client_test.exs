defmodule AgentsDemo.Realtime.CableClientTest do
  @moduledoc """
  Per-user CableClient owns only user-scoped registration, notifications, and
  state. The application-level ApiProxy connection owns the single CallEvents
  subscription; ScreenPop evaluates that stream independently.
  """

  use ExUnit.Case, async: true

  alias AgentsDemo.Realtime.CableClient

  @user_uuid "11111111-2222-3333-4444-555555555555"
  @environment_uuid "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
  @topic "realtime:user:#{@user_uuid}"
  @notifications Jason.encode!(%{channel: "Notifications", user_uuid: @user_uuid})
  @dashboard_user Jason.encode!(%{channel: "DashboardUser", user_uuid: @user_uuid})
  @state_channel Jason.encode!(%{channel: "StateChannel", scope: "user", id: @user_uuid})

  setup do
    :ok = Phoenix.PubSub.subscribe(AgentsDemo.PubSub, @topic)
    {:ok, state: %CableClient{user_uuid: @user_uuid, environment_uuid: @environment_uuid}}
  end

  describe "the streams held per logged-in user" do
    test "are user-scoped and never include the broad CallEvents stream" do
      ids = CableClient.identifiers_for(@user_uuid)

      assert ids == [@dashboard_user, @notifications, @state_channel]
      refute Enum.any?(ids, &(&1 =~ "CallEvents"))

      # Every stream names the verified uuid and nothing broader.
      assert Enum.all?(ids, &(&1 =~ @user_uuid))
    end
  end

  describe "notification relay" do
    test "relays current agent notifications verbatim", %{state: state} do
      ringing = %{
        "type" => "agent",
        "message" => %{"type" => "ringing", "call" => %{"uuid" => "c-1"}, "screen" => %{}}
      }

      assert CableClient.fanout(state, @notifications, ringing) == state
      assert_receive {:realtime, %{type: "notification", message: ^ringing}}
    end

    test "does not execute screen-pop rules on the Notifications stream", %{state: state} do
      legacy = %{"action" => "tab:new", "url" => "https://crm.example.com/contact/42"}

      assert CableClient.fanout(state, @notifications, legacy) == state
      assert_receive {:realtime, %{type: "notification", message: ^legacy}}
    end
  end

  describe "state folding" do
    test "a state delta never becomes a screen-pop command", %{state: state} do
      returned =
        CableClient.fanout(state, @dashboard_user, %{
          "event" => "user.answer",
          "ops" => [
            %{"op" => "set", "key" => "user:#{@user_uuid}:status", "value" => "busy"}
          ]
        })

      assert_receive {:realtime, %{type: "user.state", view: view}}
      assert view == %{"status" => "busy"}
      assert returned.view == %{"status" => "busy"}
      refute_receive {:realtime, %{type: "notification"}}
    end

    test "accumulates deltas across messages", %{state: state} do
      state =
        CableClient.fanout(state, @dashboard_user, %{
          "ops" => [
            %{"op" => "set", "key" => "user:#{@user_uuid}:status", "value" => "busy"}
          ]
        })

      state =
        CableClient.fanout(state, @dashboard_user, %{
          "ops" => [%{"op" => "incr", "key" => "user:#{@user_uuid}:calls", "by" => 1}]
        })

      returned =
        CableClient.fanout(state, @dashboard_user, %{
          "ops" => [%{"op" => "incr", "key" => "user:#{@user_uuid}:calls", "by" => 1}]
        })

      assert_receive {:realtime, %{type: "user.state"}}
      assert_receive {:realtime, %{type: "user.state"}}
      assert_receive {:realtime, %{type: "user.state", view: view}}
      assert view == %{"status" => "busy", "calls" => 2}
      assert returned.view == view
    end
  end
end
