defmodule AgentsDemo.Realtime.ScreenPopTest do
  use ExUnit.Case, async: false

  alias AgentsDemo.Realtime.ScreenPop

  @environment_uuid "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
  @user_uuid "11111111-2222-3333-4444-555555555555"
  @topic "realtime:user:#{@user_uuid}"
  @url "https://crm.example.com/static-answer"

  defp instruction do
    %{
      "service_uuid" => "screen-pop-service-1",
      "service_type" => "screen_pop",
      "triggers" => ["user.answer"],
      "environment_uuid" => @environment_uuid,
      "profile" => %{"record_url" => @url, "pop_on" => "answer"},
      "steps" => [%{"key" => "pop", "node" => "screen_pop_pop", "on" => %{}}]
    }
  end

  defp event(overrides \\ %{}) do
    Map.merge(
      %{
        "action" => "user.answer",
        "id" => "event-1",
        "call_uuid" => "call-1",
        "user_uuid" => @user_uuid,
        "environment_uuid" => @environment_uuid
      },
      overrides
    )
  end

  defp state(overrides \\ %{}) do
    Map.merge(
      %ScreenPop{instructions: %{@environment_uuid => [instruction()]}},
      overrides
    )
  end

  defp eventually(fun, attempts \\ 100)
  defp eventually(_fun, 0), do: false

  defp eventually(fun, attempts) do
    if fun.() do
      true
    else
      Process.sleep(10)
      eventually(fun, attempts - 1)
    end
  end

  setup do
    Phoenix.PubSub.subscribe(AgentsDemo.PubSub, @topic)
    :ok
  end

  describe "execution for a logged-in user" do
    test "a matching event broadcasts one tab command to that user's PubSub topic" do
      returned =
        ScreenPop.process_event(state(), event(), fn user, environment ->
          user == @user_uuid and environment == @environment_uuid
        end)

      assert_receive {:realtime,
                      %{type: "notification", message: %{"action" => "tab:new", "url" => @url}}}

      assert map_size(returned.seen) == 1
    end

    test "an offline user receives nothing and the event is not queued or marked executed" do
      original = state()
      returned = ScreenPop.process_event(original, event(), fn _user, _environment -> false end)

      assert returned == original
      refute_receive {:realtime, _}
    end

    test "an event for user B is not sent to logged-in user A" do
      returned =
        ScreenPop.process_event(state(), event(%{"user_uuid" => "user-b"}), fn user,
                                                                               environment ->
          user == @user_uuid and environment == @environment_uuid
        end)

      assert returned == state()
      refute_receive {:realtime, _}
    end

    test "wrong environment, unknown event, and missing identity are dropped" do
      bad_events = [
        event(%{"environment_uuid" => "other-env"}),
        event(%{"action" => "user.ringing"}),
        Map.delete(event(), "user_uuid"),
        Map.delete(event(), "environment_uuid")
      ]

      returned =
        Enum.reduce(bad_events, state(), fn bad, acc ->
          ScreenPop.process_event(acc, bad, fn _user, _environment -> true end)
        end)

      assert returned == state()
      refute_receive {:realtime, _}
    end
  end

  describe "deduplication" do
    test "the same event executes once" do
      state = ScreenPop.process_event(state(), event(), fn _, _ -> true end)
      _state = ScreenPop.process_event(state, event(), fn _, _ -> true end)

      assert_receive {:realtime, %{type: "notification"}}
      refute_receive {:realtime, _}
    end

    test "a different event id for the same call can execute" do
      state = ScreenPop.process_event(state(), event(), fn _, _ -> true end)
      _state = ScreenPop.process_event(state, event(%{"id" => "event-2"}), fn _, _ -> true end)

      assert_receive {:realtime, %{type: "notification"}}
      assert_receive {:realtime, %{type: "notification"}}
    end

    test "expired ids can execute again" do
      expired = System.monotonic_time(:millisecond) - ScreenPop.seen_ttl_ms() - 1

      existing = %{
        "screen-pop-service-1:user.answer:event-1" => expired
      }

      _state = ScreenPop.process_event(state(%{seen: existing}), event(), fn _, _ -> true end)
      assert_receive {:realtime, %{type: "notification"}}
    end

    test "the cache remains bounded" do
      returned =
        Enum.reduce(1..(ScreenPop.seen_max() + 10), state(), fn n, acc ->
          ScreenPop.process_event(acc, event(%{"id" => "event-#{n}"}), fn _, _ -> true end)
        end)

      assert map_size(returned.seen) == ScreenPop.seen_max()
    end
  end

  describe "load-time caching" do
    test "loads an environment from Ruby once, not once per event or socket" do
      parent = self()

      loader = fn environment_uuid ->
        send(parent, {:loaded_from_ruby, environment_uuid})
        {:ok, %{"instructions" => [instruction()]}}
      end

      start_supervised!({ScreenPop, name: nil, loader: loader})
      |> then(fn pid ->
        ScreenPop.load_environment(pid, @environment_uuid)
        assert eventually(fn -> ScreenPop.loaded?(pid, @environment_uuid) end)
        ScreenPop.load_environment(pid, @environment_uuid)
        ScreenPop.handle_event(pid, event())
      end)

      assert_receive {:loaded_from_ruby, @environment_uuid}
      refute_receive {:loaded_from_ruby, @environment_uuid}
    end

    test "a failed load is retryable and never installs partial instructions" do
      parent = self()
      counter = :counters.new(1, [])

      loader = fn _environment_uuid ->
        :counters.add(counter, 1, 1)
        attempt = :counters.get(counter, 1)
        send(parent, {:load_attempt, attempt})

        if attempt == 1,
          do: {:error, :unavailable},
          else: {:ok, %{"instructions" => [instruction()]}}
      end

      pid = start_supervised!({ScreenPop, name: nil, loader: loader})

      ScreenPop.load_environment(pid, @environment_uuid)
      refute ScreenPop.loaded?(pid, @environment_uuid)
      assert_receive {:load_attempt, 1}
      assert eventually(fn -> MapSet.size(:sys.get_state(pid).loading) == 0 end)

      ScreenPop.load_environment(pid, @environment_uuid)
      assert eventually(fn -> ScreenPop.loaded?(pid, @environment_uuid) end)
      assert_receive {:load_attempt, 2}
    end

    test "explicit refresh replaces an environment's cached instructions" do
      counter = :counters.new(1, [])

      loader = fn _environment_uuid ->
        :counters.add(counter, 1, 1)
        suffix = :counters.get(counter, 1)

        loaded =
          put_in(instruction(), ["profile", "record_url"], "https://crm.example.com/v#{suffix}")

        {:ok, %{"instructions" => [loaded]}}
      end

      pid = start_supervised!({ScreenPop, name: nil, loader: loader})
      ScreenPop.load_environment(pid, @environment_uuid)
      assert eventually(fn -> ScreenPop.loaded?(pid, @environment_uuid) end)

      ScreenPop.refresh_environment(pid, @environment_uuid)

      assert eventually(fn ->
               [loaded] = :sys.get_state(pid).instructions[@environment_uuid]
               loaded["profile"]["record_url"] == "https://crm.example.com/v2"
             end)
    end

    test "queues an event while loading without blocking the singleton" do
      parent = self()

      loader = fn _environment_uuid ->
        send(parent, {:load_started, self()})

        receive do
          :finish_load -> {:ok, %{"instructions" => [instruction()]}}
        end
      end

      pid = start_supervised!({ScreenPop, name: nil, loader: loader})
      Registry.register(AgentsDemo.Realtime.SessionRegistry, @user_uuid, @environment_uuid)

      assert :ok = ScreenPop.load_environment(pid, @environment_uuid)
      assert_receive {:load_started, loader_pid}
      refute ScreenPop.loaded?(pid, @environment_uuid)

      ScreenPop.handle_event(pid, event())
      assert eventually(fn -> Map.has_key?(:sys.get_state(pid).pending, @environment_uuid) end)
      refute_receive {:realtime, _}

      send(loader_pid, :finish_load)
      assert_receive {:realtime, %{type: "notification"}}
      assert ScreenPop.loaded?(pid, @environment_uuid)
    end
  end

  test "emits received and dispatched metrics through the real GenServer path" do
    owner = self()
    handler = "screen-pop-process-#{System.unique_integer([:positive])}"

    :telemetry.attach(
      handler,
      [:agents_demo, :screen_pop, :event],
      fn _event, _measurements, metadata, _config -> send(owner, {:outcome, metadata.result}) end,
      nil
    )

    on_exit(fn -> :telemetry.detach(handler) end)
    Registry.register(AgentsDemo.Realtime.SessionRegistry, @user_uuid, @environment_uuid)

    pid =
      start_supervised!(
        {ScreenPop, name: nil, loader: fn _ -> {:ok, %{"instructions" => [instruction()]}} end}
      )

    ScreenPop.load_environment(pid, @environment_uuid)
    assert eventually(fn -> ScreenPop.loaded?(pid, @environment_uuid) end)
    ScreenPop.handle_event(pid, event())

    assert_receive {:outcome, :received}
    assert_receive {:outcome, :dispatched}
  end

  test "the real session registry requires the verified user and environment pair" do
    user_uuid = "online-#{System.unique_integer([:positive])}"
    refute ScreenPop.online?(user_uuid, @environment_uuid)

    Registry.register(AgentsDemo.Realtime.SessionRegistry, user_uuid, @environment_uuid)
    assert ScreenPop.online?(user_uuid, @environment_uuid)
    refute ScreenPop.online?(user_uuid, "another-environment")
  end
  describe "a pop from the agent's own state stream" do
    # No subscribe here: the outer setup already subscribes this process to the
    # topic, and subscribing twice delivers every broadcast twice — which reads
    # exactly like a duplicate pop.
    setup do
      {:ok, state: %ScreenPop{}}
    end

    defp state_event(overrides \\ %{}) do
      Map.merge(
        %{
          "event" => "user.state_change",
          "scope" => "user",
          "id" => "call-abc",
          "user_uuid" => @user_uuid,
          "meta" => %{"CC-Agent" => @user_uuid, "CC-Agent-State" => "In a queue call"}
        },
        overrides
      )
    end

    test "pops for the signed-in agent named by CC-Agent", %{state: state} do
      online = fn _uuid -> true end

      ScreenPop.process_user_event(state, @user_uuid, state_event(), online)

      assert_receive {:realtime, %{type: "notification", message: message}}
      assert message["action"] == "tab:new"
      assert message["url"] =~ "search_phone="
      assert message["url"] =~ "callId=call-abc"
    end

    test "uses the caller number when the event carries one", %{state: state} do
      online = fn _uuid -> true end
      event = state_event(%{"data" => %{"caller_id_number" => "0501234567"}})

      ScreenPop.process_user_event(state, @user_uuid, event, online)

      assert_receive {:realtime, %{type: "notification", message: %{"url" => url}}}
      assert url =~ "search_phone=0501234567"
    end

    # The whole point of the rule: the agent in the event must be the agent
    # signed in here. Without this a state event could open a tab in somebody
    # else's browser.
    test "never pops for a different agent", %{state: state} do
      online = fn _uuid -> true end
      other = "99999999-8888-7777-6666-555555555555"

      ScreenPop.process_user_event(state, @user_uuid, state_event(%{
        "user_uuid" => other,
        "meta" => %{"CC-Agent" => other}
      }), online)

      refute_receive {:realtime, %{type: "notification"}}
    end

    test "does not pop when the agent has no live socket", %{state: state} do
      offline = fn _uuid -> false end

      ScreenPop.process_user_event(state, @user_uuid, state_event(), offline)

      refute_receive {:realtime, %{type: "notification"}}
    end

    test "ignores state events that are not call-shaped", %{state: state} do
      online = fn _uuid -> true end

      ScreenPop.process_user_event(state, @user_uuid, state_event(%{"event" => "user.logged_in"}), online)

      refute_receive {:realtime, %{type: "notification"}}
    end

    test "pops once for the same event, not twice", %{state: state} do
      online = fn _uuid -> true end

      after_first = ScreenPop.process_user_event(state, @user_uuid, state_event(), online)
      assert_receive {:realtime, %{type: "notification"}}

      ScreenPop.process_user_event(after_first, @user_uuid, state_event(), online)
      refute_receive {:realtime, %{type: "notification"}}
    end
  end

end
