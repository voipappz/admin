defmodule Connectix.Logging.InfluxTest do
  @moduledoc """
  The shipper's contract: what one event becomes on the wire, that the
  writer batches instead of posting per line, that it stays quiet while
  InfluxDB is down, and — above all — that it is an addition to the console
  log and never a replacement for it.
  """

  # System.put_env and Application.put_env — the writer reads both at start.
  use ExUnit.Case, async: false

  import ExUnit.CaptureLog

  alias Connectix.Logging.Influx
  alias Connectix.Logging.Influx.Writer

  # ── HTTP stub ───────────────────────────────────────────────────────────────

  # Stands in for `Influx.HTTP` through the `:influx_http` seam. Every call is
  # mailed to the test process; the answer is whatever the test last set.
  defmodule StubHTTP do
    def post(url, headers, body, opts) do
      send(test_pid(), {:influx_post, url, headers, body, opts})
      reply(:post)
    end

    def get(url, opts) do
      send(test_pid(), {:influx_get, url, opts})
      reply(:get)
    end

    defp test_pid, do: Application.fetch_env!(:agents_demo, :influx_stub_pid)

    defp reply(verb),
      do: Application.get_env(:agents_demo, :influx_stub_replies, %{})[verb] || {:ok, 204}
  end

  @env ~w(VA_MONITOR_TOKEN VA_INFLUXDB_HOST VA_INFLUXDB_PORT VA_INFLUXDB_DATABASE)

  setup do
    previous = Map.new(@env, &{&1, System.get_env(&1)})

    on_exit(fn ->
      Enum.each(previous, fn
        {key, nil} -> System.delete_env(key)
        {key, value} -> System.put_env(key, value)
      end)

      Application.delete_env(:agents_demo, :influx_http)
      Application.delete_env(:agents_demo, :influx_stub_pid)
      Application.delete_env(:agents_demo, :influx_stub_replies)
      # A test that failed between add and remove must not leave its handler
      # behind for the next one.
      :logger.remove_handler(:influx_test)
    end)

    Enum.each(@env, &System.delete_env/1)
    :ok
  end

  defp configure(pairs) do
    Enum.each(pairs, fn {key, value} -> System.put_env(key, value) end)
    Application.put_env(:agents_demo, :influx_http, StubHTTP)
    Application.put_env(:agents_demo, :influx_stub_pid, self())
  end

  defp stub_reply(verb, reply) do
    replies = Application.get_env(:agents_demo, :influx_stub_replies, %{})
    Application.put_env(:agents_demo, :influx_stub_replies, Map.put(replies, verb, reply))
  end

  # A writer of this test's own: its own name, and either no :logger handler
  # or one installed under a test id, so the app's (absent) writer is never
  # involved and a leftover handler cannot point at a dead pid.
  defp start_writer(opts) do
    opts =
      Keyword.merge([name: :influx_writer_under_test, handler_id: nil, flush_ms: 60_000], opts)

    pid = start_supervised!({Writer, opts})
    # Drain the startup probe so a test's first assertion is about its own call.
    assert_receive {:influx_get, _url, _opts}
    pid
  end

  defp event(message, meta \\ %{}) do
    %{
      level: :info,
      msg: {:string, message},
      meta: Map.merge(%{time: 1_700_000_000_000_000}, meta)
    }
  end

  # ── to_line/1 ───────────────────────────────────────────────────────────────

  describe "to_line/1" do
    test "measurement, the three tags, the message, and the timestamp in nanoseconds" do
      line = Influx.to_line(event("hello"))

      assert line ==
               ~s(portal_log,app=portal,level=info,node=#{node()} message="hello" 1700000000000000000)
    end

    test "module, function and request_id are fields when the metadata has them" do
      line =
        Influx.to_line(
          event("hi", %{mfa: {ConnectixWeb.Endpoint, :call, 2}, request_id: "abc123"})
        )

      assert line =~ ~s(,module="ConnectixWeb.Endpoint")
      assert line =~ ~s(,function="call/2")
      assert line =~ ~s(,request_id="abc123")
    end

    test "missing metadata means no such field, and no time means now" do
      before = System.os_time(:nanosecond)
      line = Influx.to_line(%{level: :warning, msg: {:string, "x"}, meta: %{}})
      [_, ts] = String.split(line, ~r/ (?=\d+$)/)

      refute line =~ "module="
      refute line =~ "request_id="
      assert String.to_integer(ts) >= before
      assert line =~ ",level=warning,"
    end

    test "quotes and backslashes in the message are escaped, newlines become literal \\n" do
      line = Influx.to_line(event(~s(say "hi" C:\\path\nline two)))

      assert line =~ ~s( message="say \\"hi\\" C:\\\\path\\nline two" )
    end

    test "commas, equals and spaces in tag values are escaped" do
      # Tag values come from atoms this module controls, but the escaper is
      # what stands between a future tag and a rejected batch.
      line = Influx.to_line(event("m", %{request_id: "a b,c=d"}))

      # Fields are quoted strings — no escaping of those characters is needed.
      assert line =~ ~s(request_id="a b,c=d")
      # And the level tag path is the one under test for escaping: feed a
      # level whose name needs it through the same function.
      assert Influx.to_line(%{level: :"odd level,x=y", msg: {:string, "m"}, meta: %{}}) =~
               ~s(level=odd\\ level\\,x\\=y)
    end

    test "iodata messages and report messages both become a string" do
      assert Influx.to_line(event(["a", ?b, ["c"]])) =~ ~s(message="abc")

      report = %{level: :error, msg: {:report, %{what: 1}}, meta: %{}}
      assert Influx.to_line(report) =~ ~s(message="%{what: 1}")

      formatted = %{level: :error, msg: {~c"x=~p", [42]}, meta: %{}}
      assert Influx.to_line(formatted) =~ ~s(message="x=42")
    end
  end

  # ── children/0 ──────────────────────────────────────────────────────────────

  describe "children/0" do
    test "no token, no writer, no handler" do
      capture_log(fn -> assert Influx.children() == [] end)
      refute :influx in :logger.get_handler_ids()
    end

    test "\"\" is the same as unset" do
      System.put_env("VA_MONITOR_TOKEN", "")
      capture_log(fn -> assert Influx.children() == [] end)
    end

    test "a token puts the writer in the tree" do
      System.put_env("VA_MONITOR_TOKEN", "tok")
      assert Influx.children() == [Writer]
    end
  end

  # ── Writer ──────────────────────────────────────────────────────────────────

  describe "Writer" do
    setup do
      configure(%{
        "VA_MONITOR_TOKEN" => "s3cret",
        "VA_INFLUXDB_HOST" => "influx.test",
        "VA_INFLUXDB_PORT" => "8181",
        "VA_INFLUXDB_DATABASE" => "portal"
      })

      :ok
    end

    test "installs the handler BESIDE the default one, and removes only its own" do
      existing_ids = :logger.get_handler_ids()
      pid = start_writer(handler_id: :influx_test)

      ids = :logger.get_handler_ids()
      # ExUnit replaces the runtime's console handler while capturing logs;
      # every handler present before installation must still be present.
      assert Enum.all?(existing_ids, &(&1 in ids))
      assert :influx_test in ids

      assert {:ok, %{module: Influx, config: %{writer: :influx_writer_under_test}}} =
               :logger.get_handler_config(:influx_test)

      stop_supervised!(Writer)
      refute Process.alive?(pid)

      ids = :logger.get_handler_ids()
      assert Enum.all?(existing_ids, &(&1 in ids))
      refute :influx_test in ids
    end

    test "a second install is not an error" do
      start_writer(handler_id: :influx_test)
      # What a restart of the writer sees: :logger still holds the handler.
      assert :ok = :logger.add_handler(:influx_test, Influx, %{}) |> then(fn _ -> :ok end)
      assert Enum.count(:logger.get_handler_ids(), &(&1 == :influx_test)) == 1
    end

    test "a logged line reaches InfluxDB through the handler, as one v3 write with a bearer" do
      start_writer(handler_id: :influx_test)

      require Logger
      Logger.info("shipped through the handler", request_id: "req-1")
      Writer.flush(:influx_writer_under_test)

      assert_receive {:influx_post, url, headers, body, opts}
      assert url == "http://influx.test:8181/api/v3/write_lp?db=portal&precision=nanosecond"
      assert {"authorization", "Bearer s3cret"} in headers
      assert body =~ ~s(portal_log,app=portal,level=info,node=)
      assert body =~ ~s(message="shipped through the handler")
      assert body =~ ~s(request_id="req-1")
      assert Keyword.fetch!(opts, :connect_timeout) == 2_000
    end

    test "lines are batched: one POST at max_lines, newline-joined, in order" do
      start_writer(max_lines: 3)

      for n <- 1..3, do: Writer.enqueue(:influx_writer_under_test, "l#{n} v=1i #{n}")

      assert_receive {:influx_post, _url, _headers, body, _opts}
      assert body == "l1 v=1i 1\nl2 v=1i 2\nl3 v=1i 3"
      refute_receive {:influx_post, _, _, _, _}, 50
    end

    test "the timer flushes a partial batch" do
      start_writer(flush_ms: 20)

      Writer.enqueue(:influx_writer_under_test, "lonely v=1i 1")

      assert_receive {:influx_post, _url, _headers, "lonely v=1i 1", _opts}, 500
    end

    test "a failure is warned about ONCE per streak, batches are dropped, and recovery is announced" do
      start_writer([])
      stub_reply(:post, {:error, %RuntimeError{message: "connection refused"}})

      first =
        capture_log(fn ->
          Writer.enqueue(:influx_writer_under_test, "a v=1i 1")
          Writer.flush(:influx_writer_under_test)
        end)

      assert first =~ "Influx: write to influx.test:8181 failed — connection refused"

      # Still down: a second failed flush says nothing — the log is the thing
      # we are failing to ship, and it must not fill with our own complaints.
      second =
        capture_log(fn ->
          Writer.enqueue(:influx_writer_under_test, "b v=1i 2")
          Writer.flush(:influx_writer_under_test)
        end)

      refute second =~ "Influx:"

      # Back: the dropped lines are gone, the new batch holds only new lines.
      stub_reply(:post, {:ok, 204})

      resumed =
        capture_log(fn ->
          Writer.enqueue(:influx_writer_under_test, "c v=1i 3")
          Writer.flush(:influx_writer_under_test)
        end)

      assert resumed =~ "Influx: writes to influx.test:8181 resumed"
      assert_receive {:influx_post, _, _, "a v=1i 1", _}
      assert_receive {:influx_post, _, _, "b v=1i 2", _}
      assert_receive {:influx_post, _, _, "c v=1i 3", _}
    end

    test "a non-2xx answer counts as a failure and names the status" do
      start_writer([])
      stub_reply(:post, {:ok, 401})

      log =
        capture_log(fn ->
          Writer.enqueue(:influx_writer_under_test, "a v=1i 1")
          Writer.flush(:influx_writer_under_test)
        end)

      assert log =~ "failed — HTTP 401"
    end

    test "the startup probe hits /health and warns, naming host:port and the variable, when it fails" do
      stub_reply(:get, {:error, %RuntimeError{message: "nxdomain"}})

      log =
        capture_log(fn ->
          start_supervised!({Writer, name: :influx_writer_under_test, handler_id: nil})
          assert_receive {:influx_get, "http://influx.test:8181/health", timeout: 2_000}
          # handle_continue has run once the first call is answered.
          Writer.flush(:influx_writer_under_test)
        end)

      assert log =~ "InfluxDB NOT reachable at influx.test:8181 — nxdomain"
      assert log =~ "VA_INFLUXDB_HOST"
      # Not fatal: the writer is up regardless.
      assert Process.alive?(Process.whereis(:influx_writer_under_test))
    end

    test "the startup probe logs OK when /health answers 200" do
      stub_reply(:get, {:ok, 200})

      log =
        capture_log(fn ->
          start_supervised!({Writer, name: :influx_writer_under_test, handler_id: nil})
          assert_receive {:influx_get, _, _}
          Writer.flush(:influx_writer_under_test)
        end)

      assert log =~ "InfluxDB OK (influx.test:8181)"
    end
  end
end
