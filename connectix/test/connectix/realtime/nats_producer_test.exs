defmodule Connectix.Realtime.NatsProducerTest do
  # Not async: `NatsProducer.status/0` is one `:persistent_term` for the node.
  use ExUnit.Case, async: false

  alias Connectix.Realtime.EventPipeline
  alias Connectix.Realtime.NatsProducer

  # A stand-in for the Gnat connection: the producer only needs something
  # registered to `whereis` and monitor. It never receives a call, because
  # `:subscribe` is injected too.
  defp start_connection do
    {:ok, pid} = Agent.start_link(fn -> :ok end)
    pid
  end

  defp start_pipeline(conn, opts \\ []) do
    test = self()

    subscribe =
      Keyword.get(opts, :subscribe, fn ^conn, subscriber, subject ->
        send(test, {:subscribed, subscriber, subject})
        {:ok, "sid-" <> subject}
      end)

    start_supervised_pipeline(
      producer:
        {NatsProducer,
         subjects: Keyword.get(opts, :subjects, ["call_events", "state.user.*"]),
         connection: conn,
         subscribe: subscribe,
         max_buffer: Keyword.get(opts, :max_buffer, 10_000)},
      concurrency: 2,
      screen_pop: test,
      events: test,
      user_streams: test
    )
  end

  # Supervised so teardown is synchronous: `NatsProducer.status/0` is one
  # term for the node, and a pipeline still dying from the previous test
  # would otherwise write `:connecting` over this test's `:subscribed`.
  defp start_supervised_pipeline(opts) do
    name = :"pipeline_#{System.unique_integer([:positive])}"
    spec = Supervisor.child_spec({EventPipeline, Keyword.put(opts, :name, name)}, id: name)
    start_supervised!(spec)
    name
  end

  defp nats_msg(subject, body), do: {:msg, %{topic: subject, body: body, reply_to: nil, sid: 1}}

  # The producer writes its status after the last subscribe returns, and the
  # injected subscribe reports to the test from inside that loop — so the
  # test can be ahead of the write by a scheduler tick.
  defp assert_status(expected, tries \\ 100)

  defp assert_status(expected, 0), do: assert(NatsProducer.status() == expected)

  defp assert_status(expected, tries) do
    if NatsProducer.status() == expected do
      :ok
    else
      Process.sleep(10)
      assert_status(expected, tries - 1)
    end
  end

  defp no_unsub, do: fn _conn, _sid -> :ok end

  test "subscribes to every subject on the connection and reports it" do
    conn = start_connection()
    start_pipeline(conn)

    assert_receive {:subscribed, producer, "call_events"}
    assert_receive {:subscribed, ^producer, "state.user.*"}
    assert_status({:subscribed, ["call_events", "state.user.*"]})
  end

  test "a call event reaches ScreenPop decoded, a state frame is recorded" do
    conn = start_connection()
    start_pipeline(conn)
    assert_receive {:subscribed, producer, "call_events"}

    send(producer, nats_msg("call_events", ~s({"action":"bridge-agent-start","id":"e1"})))
    assert_receive {:"$gen_cast", {:event, %{"action" => "bridge-agent-start", "id" => "e1"}}}

    send(producer, nats_msg("state.user.abc", ~s({"event":"answered"})))
    assert_receive {:"$gen_cast", {:state, "user", "abc", %{"event" => "answered"}}}
  end

  test "a body that is not a JSON object is dropped and counted" do
    conn = start_connection()
    start_pipeline(conn)
    assert_receive {:subscribed, producer, "call_events"}

    :telemetry.attach(
      "nats-undecodable-#{inspect(self())}",
      [:connectix, :nats, :message],
      fn _event, _measure, meta, pid -> send(pid, {:nats_metric, meta.result}) end,
      self()
    )

    on_exit(fn -> :telemetry.detach("nats-undecodable-#{inspect(self())}") end)

    send(producer, nats_msg("call_events", "not json"))
    send(producer, nats_msg("call_events", "[1,2]"))

    assert_receive {:nats_metric, :undecodable}
    assert_receive {:nats_metric, :undecodable}
    refute_receive {:"$gen_cast", _}, 100
  end

  test "re-subscribes on the replacement when the connection process dies" do
    name = :"nats_conn_#{System.unique_integer([:positive])}"
    test = self()

    # Unlinked, so killing it does not take the test down with it — the way
    # `Gnat.ConnectionSupervisor` replaces a dead connection with a new pid
    # under the same registered name.
    {:ok, first} = Agent.start(fn -> :ok end, name: name)

    subscribe = fn conn, subscriber, subject ->
      send(test, {:subscribed, subscriber, subject, conn})
      {:ok, "sid-" <> subject}
    end

    start_supervised_pipeline(
      producer:
        {NatsProducer,
         subjects: ["call_events"],
         connection: name,
         subscribe: subscribe,
         unsubscribe: no_unsub()},
      concurrency: 1,
      screen_pop: test,
      events: test,
      user_streams: test
    )

    assert_receive {:subscribed, producer, "call_events", ^first}

    ref = Process.monitor(first)
    Process.exit(first, :kill)
    assert_receive {:DOWN, ^ref, :process, ^first, :killed}
    {:ok, second} = Agent.start(fn -> :ok end, name: name)
    on_exit(fn -> if Process.alive?(second), do: Agent.stop(second) end)

    assert_receive {:subscribed, ^producer, "call_events", ^second}, 3_000
    assert_status({:subscribed, ["call_events"]})
  end

  test "waits for a connection that is not registered yet" do
    conn = start_connection()
    name = :"nats_conn_#{System.unique_integer([:positive])}"
    test = self()

    subscribe = fn ^conn, subscriber, subject ->
      send(test, {:subscribed, subscriber, subject})
      {:ok, "sid"}
    end

    start_supervised_pipeline(
      producer:
        {NatsProducer,
         subjects: ["call_events"],
         connection: name,
         subscribe: subscribe,
         unsubscribe: no_unsub()},
      concurrency: 1,
      screen_pop: test,
      events: test,
      user_streams: test
    )

    refute_receive {:subscribed, _, _}, 200
    assert_status(:connecting)

    Process.register(conn, name)
    assert_receive {:subscribed, _, "call_events"}, 3_000
  end

  test "the buffer is bounded: the oldest queued message is dropped" do
    conn = start_connection()
    test = self()

    # A producer with no consumer demand: start it as a bare GenStage so
    # nothing pulls, and fill it past its bound.
    subscribe = fn ^conn, _subscriber, subject -> {:ok, "sid-" <> subject} end

    producer =
      start_supervised!(%{
        id: :bare_producer,
        start:
          {GenStage, :start_link,
           [
             NatsProducer,
             [
               subjects: ["call_events"],
               connection: conn,
               subscribe: subscribe,
               unsubscribe: no_unsub(),
               max_buffer: 3
             ]
           ]}
      })

    :telemetry.attach(
      "nats-dropped-#{inspect(self())}",
      [:connectix, :nats, :message],
      fn
        _event, _measure, %{result: :dropped}, pid -> send(pid, :dropped)
        _event, _measure, _meta, _pid -> :ok
      end,
      self()
    )

    on_exit(fn -> :telemetry.detach("nats-dropped-#{inspect(self())}") end)

    for n <- 1..5, do: send(producer, nats_msg("call_events", "#{n}"))

    assert_receive :dropped
    assert_receive :dropped

    # Now pull: only the three newest survive, in order.
    events =
      [{producer, max_demand: 10, cancel: :transient}]
      |> GenStage.stream()
      |> Enum.take(3)
      |> Enum.map(& &1.data)

    assert events == ["3", "4", "5"]
  end

  test "the overflow warning is one line per episode, not one per dropped frame" do
    # Measured before the hysteresis: the flag cleared as soon as the buffer was
    # one under its bound, so the next arrival overflowed again and the pair of
    # log lines repeated per message — four full/draining cycles in four
    # milliseconds. The buffer now has to fall to half the bound first.
    import ExUnit.CaptureLog

    conn = start_connection()
    subscribe = fn ^conn, _subscriber, subject -> {:ok, "sid-" <> subject} end

    producer =
      start_supervised!(%{
        id: :overflow_producer,
        start:
          {GenStage, :start_link,
           [
             NatsProducer,
             [
               subjects: ["call_events"],
               connection: conn,
               subscribe: subscribe,
               unsubscribe: no_unsub(),
               max_buffer: 4
             ]
           ]}
      })

    log =
      capture_log(fn ->
        for n <- 1..40, do: send(producer, nats_msg("call_events", "#{n}"))
        # Nothing consumes, so every message past the bound drops.
        Process.sleep(100)
      end)

    assert log =~ "buffer full at 4 messages"

    warnings = log |> String.split("buffer full at") |> length() |> Kernel.-(1)

    assert warnings == 1,
           "expected ONE overflow warning for one episode, got #{warnings}"
  end
end
