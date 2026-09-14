defmodule Connectix.Realtime.ScreenPopTest do
  use ExUnit.Case, async: false

  alias Connectix.Realtime.ScreenPop

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
    Phoenix.PubSub.subscribe(Connectix.PubSub, @topic)

    # The environment path resolves its recipient exactly as the agent path
    # does — the event's agent id must be one a signed-in user answers to.
    # This session answers to `@user_uuid` as its token, so the events below,
    # which name that id, reach this test's topic; an event naming any other
    # id reaches nobody. The registry entry dies with the test process.
    Registry.register(Connectix.Realtime.SessionRegistry, {:agent, @user_uuid}, {@user_uuid, [@user_uuid]})
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
      Registry.register(Connectix.Realtime.SessionRegistry, @user_uuid, @environment_uuid)

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
      [:connectix, :screen_pop, :event],
      fn _event, _measurements, metadata, _config -> send(owner, {:outcome, metadata.result}) end,
      nil
    )

    on_exit(fn -> :telemetry.detach(handler) end)
    Registry.register(Connectix.Realtime.SessionRegistry, @user_uuid, @environment_uuid)

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

    Registry.register(Connectix.Realtime.SessionRegistry, user_uuid, @environment_uuid)
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

    @powerlink "cb1b0a46-77d5-4b3a-92d8-31768fea74e4"

    # The event names the agent by powerlink_token — never by the portal uuid,
    # which the switch does not know.
    defp state_event(overrides \\ %{}) do
      Map.merge(
        %{
          "event" => "bridge-agent-start",
          "scope" => "user",
          "id" => "call-abc",
          "user_uuid" => @powerlink,
          "meta" => %{"CC-Agent" => @powerlink, "CC-Agent-State" => "In a queue call"}
        },
        overrides
      )
    end

    test "pops for the signed-in agent named by CC-Agent", %{state: state} do
      online = fn _uuid -> true end

      ScreenPop.process_user_event(state, @user_uuid, state_event(), online, [@powerlink])

      assert_receive {:realtime, %{type: "notification", message: message}}
      assert message["action"] == "tab:new"
      assert message["url"] =~ "CallerNumber="
      refute message["url"] =~ "callId"
    end

    # THE CASE THAT WAS FAILING IN PRODUCTION. The callcenter names an agent by
    # `powerlink_token`, not by user uuid: an agent-state-change carrying
    # `CC-Agent cb1b0a46…` arrived while the browser held user `be5bc5f0…`,
    # and cb1b0a46… was that user's powerlink_token. Matching on the uuid alone
    # refused it. With the resolved agent ids it pops.
    test "matches the user's powerlink_token, which is what CC-Agent carries", %{state: state} do
      online = fn _uuid -> true end
      powerlink = "cb1b0a46-77d5-4b3a-92d8-31768fea74e4"

      event =
        state_event(%{
          "user_uuid" => powerlink,
          "meta" => %{"CC-Agent" => powerlink, "CC-Agent-State" => "In a queue call"}
        })

      # Without the token in the accepted ids: correctly refused (old behaviour).
      ScreenPop.process_user_event(state, @user_uuid, event, online, [@user_uuid])
      refute_receive {:realtime, %{type: "notification"}}

      # With it: pops, and to the USER's topic, not the token's.
      ScreenPop.process_user_event(state, @user_uuid, event, online, [@user_uuid, powerlink])
      assert_receive {:realtime, %{type: "notification", message: %{"action" => "tab:new"}}}
    end

    # THE FRAME THE NODE ACTUALLY PUSHES, copied verbatim from its log. Note
    # `action` (not `event`), the raw callcenter name (not the mapped
    # `user.state_change`), and CC-Agent = the user's powerlink_token. Each of
    # those three refused the pop on its own at some point.
    # The shape copied from a real answered call on nimbus-connectix: no
    # `call_uuid` and no `environment_uuid`, the agent named three times over
    # (meta.CC-Agent, user_uuid, and the id's last segment), and the caller's
    # number only under `CC-Member-CID-Number`.
    test "pops for the raw bridge-agent-start frame the node pushes" do
      online = fn _uuid -> true end
      powerlink = "cb1b0a46-77d5-4b3a-92d8-31768fea74e4"

      raw = %{
        "id" => "bridge-agent-start_ac8cf994-50e2-4124-8d54-b208ab76b88f_857850d9-d66e-4b87-b973-f769a55e55a8_#{powerlink}",
        "uuid" => "ac8cf994-50e2-4124-8d54-b208ab76b88f",
        "action" => "bridge-agent-start",
        "type" => "callcenter",
        "user_uuid" => powerlink,
        "meta" => %{
          "CC-Agent" => powerlink,
          "CC-Action" => "bridge-agent-start",
          "CC-Member-CID-Number" => "0545234585",
          "CC-Member-Session-UUID" => "ac8cf994-50e2-4124-8d54-b208ab76b88f",
          "CC-Queue" => "11106@328.nimbusip.com"
        }
      }

      ScreenPop.process_user_event(%ScreenPop{}, @user_uuid, raw, online, [@user_uuid, powerlink])

      assert_receive {:realtime, %{type: "notification", message: message}}
      assert message["action"] == "tab:new"
      # Dispatched to the USER's topic even though the event named the token.
      assert message["url"] =~ "CallerNumber=0545234585"
    end

    test "uses the caller number when the event carries one", %{state: state} do
      online = fn _uuid -> true end
      event = state_event(%{"data" => %{"caller_id_number" => "0501234567"}})

      ScreenPop.process_user_event(state, @user_uuid, event, online, [@powerlink])

      assert_receive {:realtime, %{type: "notification", message: %{"url" => url}}}
      assert url =~ "CallerNumber=0501234567"
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
      }), online, [@powerlink])

      refute_receive {:realtime, %{type: "notification"}}
    end

    test "does not pop when the agent has no live socket", %{state: state} do
      offline = fn _uuid -> false end

      ScreenPop.process_user_event(state, @user_uuid, state_event(), offline, [@powerlink])

      refute_receive {:realtime, %{type: "notification"}}
    end

    test "ignores state events that are not call-shaped", %{state: state} do
      online = fn _uuid -> true end

      ScreenPop.process_user_event(state, @user_uuid, state_event(%{"event" => "user.logged_in"}), online, [@powerlink])

      refute_receive {:realtime, %{type: "notification"}}
    end

    test "pops once for the same event, not twice", %{state: state} do
      online = fn _uuid -> true end

      after_first = ScreenPop.process_user_event(state, @user_uuid, state_event(), online, [@powerlink])
      assert_receive {:realtime, %{type: "notification"}}

      ScreenPop.process_user_event(after_first, @user_uuid, state_event(), online, [@powerlink])
      refute_receive {:realtime, %{type: "notification"}}
    end
  end

  describe "one call pops exactly one user" do
    # The agent id from the real production frame further down; module
    # attributes are read where they are written, so it is restated here.
    @popped_agent "fdc47399-1a8b-4ecb-8751-891edf6b9e32"
    # As reported from production: every signed-in user popped on every call.
    # The identity list a session answered to used to include the portal uuid
    # as a fallback, the node stamps `user_uuid` on every frame of a user's
    # own stream, and the rule's `agent_fields` fall back to that field — so
    # each recipient matched their own uuid on a call that was not theirs.
    # The identity is the powerlink token, or nothing.

    test "a frame on a user's own stream stamped with their uuid does not pop a user with no token" do
      online = fn _uuid -> true end

      frame = %{
        "event" => "bridge-agent-start",
        "scope" => "user",
        "id" => "call-someone-elses",
        "user_uuid" => @user_uuid
      }

      # `[]`: the token lookup failed or the record carries none. This used to
      # default to `[@user_uuid]` and match.
      ScreenPop.process_user_event(%ScreenPop{}, @user_uuid, frame, online, [])
      refute_receive {:realtime, %{type: "notification"}}, 200
    end

    test "the same real frame on a second user's stream does not pop that user" do
      online = fn _uuid -> true end
      # A second signed-in user, with their own token, receiving the frame that
      # names the first user's agent — the N× delivery the node does.
      ScreenPop.process_user_event(%ScreenPop{}, @user_uuid, real_frame(), online, ["someone-elses-token"])
      refute_receive {:realtime, %{type: "notification"}}, 200
    end

    test "with two users signed in, a node-wide frame pops only the one whose token it names" do
      popped = connect_agent(@popped_agent)

      bystander = "user-#{System.unique_integer([:positive])}"
      Registry.register(Connectix.Realtime.SessionRegistry, bystander, nil)
      Registry.register(Connectix.Realtime.SessionRegistry, {:agent, "bystander-token"}, {bystander, ["bystander-token"]})
      Phoenix.PubSub.subscribe(Connectix.PubSub, "realtime:user:#{bystander}")

      ScreenPop.route_event(%ScreenPop{}, real_frame())

      assert_receive {:realtime, %{type: "notification", message: message}}
      assert message["url"] =~ "CallerNumber=0522463424"
      refute_receive {:realtime, %{type: "notification"}}, 200

      # Whose topic it went to is not visible from one mailbox, so ask the
      # registry the same question the dispatcher did.
      assert {^popped, [@popped_agent]} = ScreenPop.user_for_agent(@popped_agent)
    end
  end

  describe "a node-wide CallEvents frame that names a signed-in agent" do
    # This is a REAL frame, copied verbatim out of the production event store on
    # nimbus. Two things about it are the whole reason this path exists:
    #
    #   * there is no `environment_uuid` anywhere in it, so `route_event` could
    #     never match a loaded environment and dropped it as :unloaded;
    #   * the only identity it carries is `meta.CC-Agent` — the agent's
    #     powerlink_token, not the portal user uuid.
    #
    # Kept as the raw JSON rather than a hand-built map so it cannot quietly
    # drift from what the switch actually sends.
    @real_bridge_start ~s({"action":"bridge-agent-start","caller_id_number":"0522463424","id":"bridge-agent-start_e3dd4aa6-d602-4ae6-ac29-f58e961e921f_53beb321-4c10-454b-8e49-1ca449c94c3d_fdc47399-1a8b-4ecb-8751-891edf6b9e32","meta":{"CC-Action":"bridge-agent-start","CC-Agent":"fdc47399-1a8b-4ecb-8751-891edf6b9e32","CC-Agent-System":"single_box","CC-Agent-Type":"callback","CC-Member-CID-Name":"0522463424","CC-Member-CID-Number":"0522463424","CC-Member-DNIS":"503","CC-Member-Session-UUID":"e3dd4aa6-d602-4ae6-ac29-f58e961e921f","CC-Member-UUID":"9312fae3-5923-4c29-b7a2-36c6f62f2c8c","CC-Queue":"11106@328.nimbusip.com"},"queue_name":"11106@328.nimbusip.com","type":"callcenter","user_uuid":"fdc47399-1a8b-4ecb-8751-891edf6b9e32","uuid":"e3dd4aa6-d602-4ae6-ac29-f58e961e921f"})

    @real_agent_id "fdc47399-1a8b-4ecb-8751-891edf6b9e32"

    defp real_frame, do: Jason.decode!(@real_bridge_start)

    defp connect_agent(agent_id) do
      user = "user-#{System.unique_integer([:positive])}"
      Registry.register(Connectix.Realtime.SessionRegistry, user, nil)

      Registry.register(
        Connectix.Realtime.SessionRegistry,
        {:agent, agent_id},
        {user, [agent_id]}
      )

      Phoenix.PubSub.subscribe(Connectix.PubSub, "realtime:user:#{user}")
      user
    end

    test "the real frame carries no environment, which is why it never popped" do
      frame = real_frame()

      refute Map.has_key?(frame, "environment_uuid")
      assert get_in(frame, ["meta", "CC-Agent"]) == @real_agent_id
    end

    test "user_for_agent/1 finds nobody when no session claims the agent" do
      assert ScreenPop.user_for_agent("nobody-claims-this") == nil
    end

    test "user_for_agent/1 returns the user and the ids they answer to" do
      user = connect_agent(@real_agent_id)

      assert ScreenPop.user_for_agent(@real_agent_id) == {user, [@real_agent_id]}
    end

    test "pops the real frame at the user who answers to its CC-Agent" do
      connect_agent(@real_agent_id)

      ScreenPop.route_event(%ScreenPop{}, real_frame())

      assert_receive {:realtime, %{type: "notification", message: %{"action" => "tab:new", "url" => url}}}

      # The caller's number reaches the CRM url — a pop to a blank search would
      # look like it worked while being useless.
      assert url =~ "0522463424"
    end

    test "does not pop for an agent nobody here answers to" do
      # The common case on a busy switch: a real event belonging to someone
      # signed in somewhere else entirely.
      state = ScreenPop.route_event(%ScreenPop{}, real_frame())

      assert state == %ScreenPop{}
      refute_receive {:realtime, _}, 50
    end

    test "does not pop when the frame names neither an environment nor an agent" do
      state = ScreenPop.route_event(%ScreenPop{}, %{"action" => "bridge-agent-start"})

      assert state == %ScreenPop{}
      refute_receive {:realtime, _}, 50
    end

    test "the same frame twice pops once" do
      # The node re-delivers heavily — one number.answer was measured arriving
      # 28 times. A pop per delivery would open 28 tabs.
      connect_agent(@real_agent_id)

      state = ScreenPop.route_event(%ScreenPop{}, real_frame())
      assert_receive {:realtime, %{message: %{"action" => "tab:new"}}}

      ScreenPop.route_event(state, real_frame())
      refute_receive {:realtime, _}, 50
    end

    test "an agent's registration dies with the socket that made it" do
      agent = "agent-#{System.unique_integer([:positive])}"
      user = "user-#{System.unique_integer([:positive])}"

      task =
        Task.async(fn ->
          Registry.register(
            Connectix.Realtime.SessionRegistry,
            {:agent, agent},
            {user, [user, agent]}
          )

          :registered
        end)

      assert Task.await(task) == :registered

      # The task process is gone, so the registration must be too — otherwise a
      # pop could be attributed to a user who has disconnected.
      Process.sleep(20)
      assert ScreenPop.user_for_agent(agent) == nil
    end
  end

  describe "the rule file is the gate" do
    # A live switch delivers thousands of frames a minute and the rule names
    # one of them. Everything else used to be stored, looked up and logged as
    # "no pop — not one of [...]" for every signed-in agent; now it is counted
    # and dropped before any of that.
    setup do
      test_pid = self()
      handler = "screen-pop-gate-#{System.unique_integer([:positive])}"

      :telemetry.attach(
        handler,
        [:connectix, :screen_pop, :event],
        fn _name, _measure, %{result: result}, _cfg -> send(test_pid, {:telemetry, result}) end,
        nil
      )

      on_exit(fn -> :telemetry.detach(handler) end)
      :ok
    end

    test "a node-wide frame the rule does not name is ignored, even for a signed-in agent" do
      connect_agent(@real_agent_id)
      offering = real_frame() |> Map.put("action", "agent-offering") |> put_in(["meta", "CC-Action"], "agent-offering")

      state = ScreenPop.route_event(%ScreenPop{}, offering)

      assert state == %ScreenPop{}
      assert_receive {:telemetry, :ignored}
      refute_receive {:telemetry, :received}, 50
      refute_receive {:realtime, _}, 50
    end

    test "a node-wide frame the rule names is processed" do
      connect_agent(@real_agent_id)

      ScreenPop.route_event(%ScreenPop{}, real_frame())

      assert_receive {:telemetry, :received}
      assert_receive {:realtime, %{type: "notification"}}
    end

    test "a frame on the user's own stream the rule does not name is ignored" do
      online = fn _uuid -> true end
      frame = %{"event" => "agent-state-change", "user_state" => "Waiting", "user_uuid" => @real_agent_id}

      ScreenPop.process_user_event(%ScreenPop{}, @user_uuid, frame, online, [@real_agent_id])

      assert_receive {:telemetry, :ignored}
      refute_receive {:telemetry, :received}, 50
    end

    test "trigger? reads both spellings and refuses a nameless frame" do
      alias Connectix.Realtime.PopRule
      assert PopRule.trigger?(%{"action" => "bridge-agent-start"})
      assert PopRule.trigger?(%{"event" => "bridge-agent-start"})
      refute PopRule.trigger?(%{"action" => "agent-offering"})
      refute PopRule.trigger?(%{"caller_id_number" => "0501"})
      refute PopRule.trigger?("not a map")
    end
  end

end
