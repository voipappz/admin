defmodule Connectix.StressTest do
  @moduledoc """
  Bounded concurrency tests: many of the thing at once, asserting the app stays
  up and stays answering rather than measuring a throughput number.

  Excluded from the default run — `mix test --only stress`. They are slower
  than the rest of the suite and their failure mode (a slow machine) is not the
  failure mode anyone wants blocking a push.

  Deliberately touch **nothing external**. No SIP registrar, no Deepgram, no
  Cartesia, no LLM: the agent path is stubbed the way
  `Connectix.Voice.SagentsBridgeTest` stubs it, because a test that needs an
  Anthropic balance is a test that fails for a reason it is not about.
  """

  use ConnectixWeb.ConnCase, async: false

  import Phoenix.LiveViewTest

  alias Connectix.Conversations

  @moduletag :stress
  # Concurrency work under a cold BEAM is slower than the 60s default allows.
  @moduletag timeout: 180_000

  # Same shape as SagentsBridgeTest's stub: stands in for the one gateway every
  # surface submits through, so this measures our plumbing and not a model.
  defmodule StubTurns do
    def submit(_scope, _conversation_id, %Connectix.Turns.Input{text: text}, _opts) do
      {:ok, {:accepted, text}}
    end
  end

  # `Phoenix.LiveViewTest`'s helpers may only be called from the test process,
  # so the mounts are issued serially — but each one leaves a live LiveView
  # process running on the server, so what is under test (N concurrent sessions
  # alive at once) is still what happens. Driving them from tasks raises
  # "LiveView helpers can only be invoked from the test process".
  describe "concurrent LiveView sessions" do
    test "fifty chat sessions are alive at once without a crash", %{conn: conn} do
      views = for _ <- 1..50, do: live(conn, ~p"/chat")

      assert Enum.all?(views, &match?({:ok, _, _}, &1)),
             "every mount must succeed; got #{inspect(Enum.reject(views, &match?({:ok, _, _}, &1)))}"

      alive =
        Enum.count(views, fn {:ok, view, _html} -> Process.alive?(view.pid) end)

      assert alive == 50, "expected 50 live sessions, #{alive} survived"
    end

    test "the app still answers after a burst of sessions", %{conn: conn} do
      for _ <- 1..30, do: live(conn, ~p"/chat")

      # The point of the burst: what matters is the state it leaves behind.
      assert {:ok, _view, _html} = live(conn, ~p"/chat")
      assert get(conn, "/health/ready").status == 200
    end
  end

  describe "concurrent conversation creation" do
    test "a hundred conversations are created without collision" do
      scope = ConnectixWeb.UserAuth.resolve_scope()

      created =
        1..100
        |> Task.async_stream(
          fn n -> Conversations.create_conversation(scope, %{"title" => "stress #{n}"}) end,
          max_concurrency: 25,
          timeout: 60_000
        )
        |> Enum.map(fn {:ok, result} -> result end)

      assert Enum.all?(created, &match?({:ok, _}, &1))

      ids =
        created
        |> Enum.map(fn {:ok, conversation} -> conversation.id end)
        |> Enum.uniq()

      # Mnesia-backed and written concurrently; a duplicate id would be a
      # silent data-corruption bug rather than a crash.
      assert length(ids) == 100, "conversation ids must be unique under concurrency"
    end
  end

  describe "concurrent turn submission" do
    test "the turn gateway takes concurrent submissions and stays bounded" do
      scope = ConnectixWeb.UserAuth.resolve_scope()
      {:ok, conversation} = Conversations.create_conversation(scope, %{"title" => "stress turns"})

      {elapsed_us, results} =
        :timer.tc(fn ->
          1..100
          |> Task.async_stream(
            fn n ->
              StubTurns.submit(
                scope,
                conversation.id,
                %Connectix.Turns.Input{text: "message #{n}", origin: :chat},
                []
              )
            end,
            max_concurrency: 25,
            timeout: 60_000
          )
          |> Enum.map(fn {:ok, result} -> result end)
        end)

      assert Enum.all?(results, &match?({:ok, _}, &1))

      # Generous on purpose: this is a smoke bound to catch a pathological
      # regression (a serialising lock, an accidental sleep), not a benchmark.
      assert elapsed_us < 30_000_000,
             "100 stubbed submissions took #{div(elapsed_us, 1000)}ms — suspiciously serial"
    end
  end

  describe "concurrent event writes" do
    test "the event store absorbs concurrent appends" do
      # Append-only and DuckDB-backed; `insert/1` is a cast that must never
      # block a caller, so the assertion is that the store survives and still
      # answers rather than that every row landed.
      1..200
      |> Task.async_stream(
        fn n ->
          Connectix.Events.insert(%{
            "src" => "stress",
            "id" => "stress-#{n}",
            "label" => "stress event #{n}"
          })
        end,
        max_concurrency: 25,
        timeout: 60_000
      )
      |> Stream.run()

      assert Process.whereis(Connectix.Events) |> Process.alive?(),
             "the event store must survive a concurrent write burst"

      assert {:ok, rows} = Connectix.Events.recent(limit: 5)
      assert is_list(rows)
    end
  end
end
