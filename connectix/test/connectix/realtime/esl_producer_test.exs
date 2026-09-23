defmodule Connectix.Realtime.EslProducerTest do
  # Not async: `EslProducer.status/0` is one `:persistent_term` for the node.
  use ExUnit.Case, async: false

  alias Connectix.Realtime.EslProducer
  alias Connectix.Realtime.EventPipeline

  @settings %{
    host: "switch.test",
    port: 8021,
    password: "pw",
    events: ["HEARTBEAT", "CUSTOM callcenter::info"]
  }

  @bridge %{
    "Event-Name" => "CUSTOM",
    "Event-Subclass" => "callcenter::info",
    "CC-Action" => "bridge-agent-start",
    "CC-Agent" => "agent-1",
    "CC-Member-UUID" => "member-1",
    "CC-Member-Session-UUID" => "session-1",
    "CC-Member-CID-Number" => "0527073205"
  }

  # A stand-in for the switchx connection process: something the producer can
  # monitor, and the test can kill to mean "the connection died". Unlinked, so
  # killing it does not take the test down.
  defp fake_conn, do: spawn(fn -> Process.sleep(:infinity) end)

  defp connector(test) do
    fn settings ->
      conn = fake_conn()
      send(test, {:connected, self(), conn, settings})
      {:ok, %{conn: conn, socket: nil}}
    end
  end

  defp disconnector(test) do
    fn %{conn: conn} ->
      send(test, {:disconnected, conn})
      Process.exit(conn, :kill)
      :ok
    end
  end

  defp producer_opts(opts) do
    test = self()

    [
      settings: Keyword.get(opts, :settings, @settings),
      connect: Keyword.get(opts, :connect, connector(test)),
      disconnect: Keyword.get(opts, :disconnect, disconnector(test)),
      max_buffer: Keyword.get(opts, :max_buffer, 10_000)
    ]
  end

  # Supervised so teardown is synchronous: `status/0` is one term for the
  # node, and a pipeline still dying from the previous test would otherwise
  # write `:connecting` over this test's `:subscribed`.
  defp start_pipeline(opts \\ []) do
    test = self()
    name = :"pipeline_#{System.unique_integer([:positive])}"

    spec =
      Supervisor.child_spec(
        {EventPipeline,
         name: name,
         producer: {EslProducer, producer_opts(opts)},
         concurrency: 2,
         screen_pop: test,
         events: test,
         user_streams: test},
        id: name
      )

    start_supervised!(spec)
    name
  end

  defp esl_event(headers), do: {:switchx_event, %SwitchX.Event{headers: headers, body: ""}}

  # The producer writes its status after connect returns, and the injected
  # connect reports to the test from inside that call — so the test can be
  # ahead of the write by a scheduler tick.
  defp assert_status(expected, tries \\ 100)
  defp assert_status(expected, 0), do: assert(EslProducer.status() == expected)

  defp assert_status(expected, tries) do
    if EslProducer.status() == expected do
      :ok
    else
      Process.sleep(10)
      assert_status(expected, tries - 1)
    end
  end

  defp eventually(check, tries \\ 100) do
    cond do
      check.() -> true
      tries == 0 -> false
      true -> Process.sleep(10) && eventually(check, tries - 1)
    end
  end

  test "connects with the settings and reports the events it listens for" do
    start_pipeline()

    assert_receive {:connected, _producer, _conn, @settings}
    assert_status({:subscribed, ["HEARTBEAT", "CUSTOM callcenter::info"]})
  end

  test "a callcenter event reaches ScreenPop as a node-shaped frame" do
    start_pipeline()
    assert_receive {:connected, producer, _conn, _settings}

    send(producer, esl_event(@bridge))

    assert_receive {:"$gen_cast",
                    {:event,
                     %{
                       "action" => "bridge-agent-start",
                       "user_uuid" => "agent-1",
                       "caller_id_number" => "0527073205",
                       "id" => "bridge-agent-start_session-1_member-1_agent-1",
                       "meta" => %{"CC-Agent" => "agent-1"}
                     }}}
  end

  describe "the deadman's clock" do
    test "connecting starts it, so a fresh connection is not already silent" do
      start_pipeline()
      assert_receive {:connected, _producer, _conn, _settings}
      assert_status({:subscribed, @settings.events})

      assert is_integer(EslProducer.subscribed_at())
      assert EslProducer.last_message_at() == nil
      assert EslProducer.silent_ms() < 1_000
    end

    test "a HEARTBEAT moves it and is not emitted" do
      # The heartbeat is the liveness signal, not an event anybody pops on.
      start_pipeline()
      assert_receive {:connected, producer, _conn, _settings}
      assert_status({:subscribed, @settings.events})

      send(producer, esl_event(%{"Event-Name" => "HEARTBEAT", "Up-Time" => "0 years"}))

      assert eventually(fn -> is_integer(EslProducer.last_message_at()) end)
      refute_receive {:"$gen_cast", _}, 100
    end

    test "with no connection there is no silence to report" do
      # `nil`, not a large number: the connection check owns that failure and
      # the deadman stands down rather than raising a second alarm for one
      # fault.
      name = start_pipeline()
      assert_receive {:connected, _producer, _conn, _settings}
      assert_status({:subscribed, @settings.events})

      stop_supervised!(name)
      assert_status(:not_started)

      assert EslProducer.silent_ms() == nil
    end
  end

  test "reconnects when the connection process dies" do
    start_pipeline()
    assert_receive {:connected, producer, first, _settings}
    assert_status({:subscribed, @settings.events})

    Process.exit(first, :kill)

    assert_receive {:connected, ^producer, second, _settings}, 3_000
    refute second == first
    assert_status({:subscribed, @settings.events})
  end

  test "a disconnect notice from the switch is a lost connection" do
    start_pipeline()
    assert_receive {:connected, producer, first, _settings}

    send(producer, esl_event(%{"Content-Type" => "text/disconnect-notice"}))

    assert_receive {:disconnected, ^first}
    assert_receive {:connected, ^producer, _second, _settings}, 3_000
  end

  test "reconnect/0 drops the connection and makes it again" do
    start_pipeline()
    assert_receive {:connected, producer, first, _settings}
    assert_status({:subscribed, @settings.events})

    :ok = EslProducer.reconnect()

    assert_receive {:disconnected, ^first}
    assert_receive {:connected, ^producer, _second, _settings}, 3_000
  end

  test "a refused connect is retried with backoff, and the status says connecting" do
    test = self()
    {:ok, attempts} = Agent.start_link(fn -> 0 end)

    connect = fn settings ->
      n = Agent.get_and_update(attempts, &{&1 + 1, &1 + 1})

      if n < 3 do
        send(test, {:refused, n})
        {:error, :econnrefused}
      else
        connector(test).(settings)
      end
    end

    start_pipeline(connect: connect)

    assert_receive {:refused, 1}
    assert_status(:connecting)
    # 1 s, then 2 s: the third attempt lands at ~3 s.
    assert_receive {:refused, 2}, 2_000
    assert_receive {:connected, _producer, _conn, _settings}, 4_000
    assert_status({:subscribed, @settings.events})
  end

  test "the buffer is bounded: the oldest queued event is dropped" do
    # A producer with no consumer demand: start it as a bare GenStage so
    # nothing pulls, and fill it past its bound.
    producer =
      start_supervised!(%{
        id: :bare_producer,
        start: {GenStage, :start_link, [EslProducer, producer_opts(max_buffer: 3)]}
      })

    assert_receive {:connected, ^producer, _conn, _settings}

    :telemetry.attach(
      "esl-dropped-#{inspect(self())}",
      [:connectix, :esl, :event],
      fn
        _event, _measure, %{result: :dropped}, pid -> send(pid, :dropped)
        _event, _measure, _meta, _pid -> :ok
      end,
      self()
    )

    on_exit(fn -> :telemetry.detach("esl-dropped-#{inspect(self())}") end)

    for n <- 1..5, do: send(producer, esl_event(%{"Event-Name" => "X", "n" => "#{n}"}))

    assert_receive :dropped
    assert_receive :dropped

    # Now pull: only the three newest survive, in order.
    events =
      [{producer, max_demand: 10, cancel: :transient}]
      |> GenStage.stream()
      |> Enum.take(3)
      |> Enum.map(& &1.data["n"])

    assert events == ["3", "4", "5"]
  end

  test "the overflow warning is one line per episode, not one per dropped event" do
    import ExUnit.CaptureLog

    producer =
      start_supervised!(%{
        id: :overflow_producer,
        start: {GenStage, :start_link, [EslProducer, producer_opts(max_buffer: 4)]}
      })

    assert_receive {:connected, ^producer, _conn, _settings}

    log =
      capture_log(fn ->
        for n <- 1..40, do: send(producer, esl_event(%{"Event-Name" => "X", "n" => "#{n}"}))
        # Nothing consumes, so every event past the bound drops.
        Process.sleep(100)
      end)

    assert log =~ "buffer full at 4 events"

    warnings = log |> String.split("buffer full at") |> length() |> Kernel.-(1)
    assert warnings == 1, "expected ONE overflow warning for one episode, got #{warnings}"
  end
end
