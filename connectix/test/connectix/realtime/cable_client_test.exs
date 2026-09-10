defmodule Connectix.Realtime.CableClientTest do
  @moduledoc """
  Per-user CableClient owns only user-scoped registration, notifications, and
  state. The application-level ApiProxy connection owns the single CallEvents
  subscription; ScreenPop evaluates that stream independently.
  """

  use ExUnit.Case, async: true

  alias Connectix.Realtime.CableClient

  @user_uuid "11111111-2222-3333-4444-555555555555"
  @environment_uuid "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
  @topic "realtime:user:#{@user_uuid}"
  @notifications Jason.encode!(%{channel: "Notifications", user_uuid: @user_uuid})
  @dashboard_user Jason.encode!(%{channel: "DashboardUser", user_uuid: @user_uuid})
  @state_channel Jason.encode!(%{channel: "StateChannel", scope: "user", id: @user_uuid})

  setup do
    :ok = Phoenix.PubSub.subscribe(Connectix.PubSub, @topic)
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

    # The node keys `state.user.<id>` by CC-Agent = powerlink_token, so the
    # token's stream must be held too, or the callcenter's events for this
    # user are published where nobody listens.
    test "also hold the state stream keyed by the user's powerlink_token" do
      powerlink = "cb1b0a46-77d5-4b3a-92d8-31768fea74e4"
      ids = CableClient.identifiers_for(@user_uuid, [@user_uuid, powerlink])

      assert Jason.encode!(%{channel: "StateChannel", scope: "user", id: powerlink}) in ids
      assert @state_channel in ids
      refute Enum.any?(ids, &(&1 =~ "CallEvents"))
    end
  end

  describe "adopting agent ids resolved by a later connect" do
    # The cable client outlives one browser socket, so the FIRST connect is the
    # only one that ever passed `agent_ids` — and it is the one most likely to
    # have none: a record whose `powerlink_token` was not set yet, or a relay
    # that could not be reached. That left a live client with `agent_ids: []`,
    # subscribed to the portal uuid alone, refusing every pop for as long as it
    # lived — and logging in again did not fix it, because `ensure_cable/1` saw
    # `{:already_started, _}` and dropped the ids it had just resolved.
    @powerlink "88309e98-f698-4b57-898d-a6056c37dd55"

    test "an empty client takes on the token and its state stream" do
      state = %CableClient{
        user_uuid: @user_uuid,
        environment_uuid: @environment_uuid,
        agent_ids: [],
        identifiers: CableClient.identifiers_for(@user_uuid, [])
      }

      refute Enum.any?(state.identifiers, &(&1 =~ @powerlink))

      {:noreply, adopted} = CableClient.handle_cast({:adopt_agent_ids, [@powerlink]}, state)

      assert adopted.agent_ids == [@powerlink]

      assert Jason.encode!(%{channel: "StateChannel", scope: "user", id: @powerlink}) in
               adopted.identifiers

      # The uuid's own streams are kept, not replaced.
      assert @state_channel in adopted.identifiers
      assert @notifications in adopted.identifiers
    end

    test "is additive and idempotent" do
      state = %CableClient{
        user_uuid: @user_uuid,
        environment_uuid: @environment_uuid,
        agent_ids: [@powerlink],
        identifiers: CableClient.identifiers_for(@user_uuid, [@powerlink])
      }

      {:noreply, again} = CableClient.handle_cast({:adopt_agent_ids, [@powerlink]}, state)

      assert again == state
    end

    test "adopting nothing is a no-op on a client that has ids" do
      assert CableClient.adopt_agent_ids(@user_uuid, []) == :ok
    end

    test "adopting for a user with no running client does not raise" do
      assert CableClient.adopt_agent_ids("no-such-user", [@powerlink]) == :ok
    end
  end

  describe "a connection that dies without saying so" do
    # THE "notifications stop after a few hours" BUG. `@recv_timeout` was
    # declared and never armed. Cable pings every few seconds, so frames never
    # legitimately stop — but when a NAT or load balancer drops an established
    # connection there is no close frame and no error: Mint reports nothing,
    # `schedule_reconnect/1` never runs, and the process holds a dead socket
    # until something restarts it. Default TCP keepalive is two hours, which is
    # what set the timescale.
    test "a minute of silence is treated as death, and reconnects" do
      state = %CableClient{
        user_uuid: @user_uuid,
        environment_uuid: @environment_uuid,
        conn: :a_dead_but_open_looking_conn,
        welcomed?: true,
        last_frame_at: System.monotonic_time(:millisecond) - CableClient.recv_timeout() - 1
      }

      {:noreply, after_check} = CableClient.handle_info(:liveness, state)

      # Torn down and queued for reconnect rather than left to rot.
      assert after_check.conn == nil
      refute after_check.welcomed?
      assert_receive :reconnect, 5_000
    end

    test "a connection still receiving frames is left alone" do
      state = %CableClient{
        user_uuid: @user_uuid,
        environment_uuid: @environment_uuid,
        conn: :a_live_conn,
        welcomed?: true,
        last_frame_at: System.monotonic_time(:millisecond)
      }

      {:noreply, after_check} = CableClient.handle_info(:liveness, state)

      assert after_check.conn == :a_live_conn
      assert after_check.welcomed?
      refute_receive :reconnect, 100
    end

    test "the check is inert before there is a connection" do
      state = %CableClient{user_uuid: @user_uuid, environment_uuid: @environment_uuid, conn: nil}
      assert {:noreply, ^state} = CableClient.handle_info(:liveness, state)
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
