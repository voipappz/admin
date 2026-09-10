defmodule Connectix.EventsTest do
  @moduledoc """
  The event store's contract, exercised against a real DuckDB file.

  Each test gets its OWN store — `start_link(name: ..., path: ...)` on a temp
  file — rather than the supervised `Connectix.Events`. Two reasons: the
  supervised one writes to the box's data directory, and a test that asserted
  counts there would fail the moment the portal had ever received a frame.

  ## The synchronisation trick

  `insert/2` and `record/3` are casts, on purpose — the realtime path must
  never wait on a write. So a test that inserts and immediately reads is racing
  its own store. Every test here calls `Events.stats(store)` — a `call`, and
  therefore behind the same mailbox — after the last write. When it returns,
  every cast queued before it has been handled. No `Process.sleep`, no polling.
  """

  use ExUnit.Case, async: true

  alias Connectix.Events

  # The frame that motivated the dedupe, copied from production: one
  # `agent-state-change` off the StateChannel, carrying a user but no call.
  @frame %{
    "action" => "agent-state-change",
    "type" => "callcenter",
    "uuid" => "53beb321-4c10-454b-8e49-1ca449c94c3d",
    "user_uuid" => "cb1b0a46-77d5-4b3a-92d8-31768fea74e4",
    "user_state" => "In a queue call",
    "meta" => %{
      "CC-Agent" => "cb1b0a46-77d5-4b3a-92d8-31768fea74e4",
      "CC-Action" => "agent-state-change",
      "CC-Agent-State" => "In a queue call"
    }
  }

  setup do
    path =
      Path.join(System.tmp_dir!(), "events-#{System.unique_integer([:positive])}.duckdb")

    name = :"events_test_#{System.unique_integer([:positive])}"
    store = start_supervised!({Events, name: name, path: path})

    on_exit(fn -> File.rm(path) end)

    %{store: store, path: path}
  end

  # `create_date` is passed explicitly wherever order is asserted. Two events
  # written in the same microsecond would otherwise sort arbitrarily, and the
  # test would fail once a month on a fast machine.
  defp ev(fields) do
    Map.merge(
      %{
        "src" => "CallEvents",
        "sid" => "call-1",
        "label" => "x",
        "headers" => %{},
        "raw" => "{}"
      },
      fields
    )
  end

  defp with_env(key, value, fun) do
    previous = System.get_env(key)
    System.put_env(key, value)

    try do
      fun.()
    after
      if previous, do: System.put_env(key, previous), else: System.delete_env(key)
    end
  end

  defp sync(store), do: Events.stats(store)

  describe "channel variables" do
    # 86% of everything the store held was `complete` frames at 8.6KB each,
    # and `custom` another 7% — hundreds of `variable_*` keys per frame, none
    # of which anything reads. ~556MB of raw JSON a day, on a volume shared
    # with Mnesia.
    @channel_frame %{
      "action" => "complete",
      "call_uuid" => "call-trim",
      "caller_id_number" => "0501234567",
      "meta" => %{
        "CC-Agent" => "agent-1",
        "variable_rtp_audio_out_packet_count" => "1848",
        "variable_sofia_profile_name" => "external",
        "variable_playback_ms" => "7290"
      }
    }

    test "are dropped, and the drop is recorded", %{store: store} do
      Events.record(store, "CallEvents", @channel_frame)
      sync(store)

      {:ok, [row]} = Events.recent(store, [])
      raw = Jason.decode!(row["raw"])

      refute raw["meta"]["variable_rtp_audio_out_packet_count"]
      refute raw["meta"]["variable_sofia_profile_name"]

      # What matters is kept.
      assert raw["meta"]["CC-Agent"] == "agent-1"
      assert raw["caller_id_number"] == "0501234567"
      assert raw["action"] == "complete"

      # And a thinned frame says so rather than looking mysteriously sparse.
      assert raw["meta"]["variables_dropped"] == 3
    end

    test "a frame with none is untouched — no marker, no change", %{store: store} do
      Events.record(store, "CallEvents", %{
        "action" => "bridge-agent-start",
        "call_uuid" => "call-clean",
        "meta" => %{"CC-Agent" => "agent-1"}
      })

      sync(store)
      {:ok, [row]} = Events.recent(store, [])
      raw = Jason.decode!(row["raw"])

      assert raw["meta"] == %{"CC-Agent" => "agent-1"}
      refute Map.has_key?(raw["meta"], "variables_dropped")
    end

    test "trimming does not change which row a frame is", %{store: store} do
      # The id comes from the ORIGINAL event, so a re-delivery still dedupes.
      Events.record(store, "CallEvents", @channel_frame)
      Events.record(store, "CallEvents", @channel_frame)
      sync(store)

      assert Events.stats(store).count == 1
    end

    test "the escape hatch keeps them, for debugging a call", %{store: store} do
      previous = System.get_env("EVENTS_KEEP_CHANNEL_VARIABLES")
      System.put_env("EVENTS_KEEP_CHANNEL_VARIABLES", "1")

      try do
        Events.record(store, "CallEvents", @channel_frame)
        sync(store)

        {:ok, [row]} = Events.recent(store, [])
        raw = Jason.decode!(row["raw"])

        assert raw["meta"]["variable_sofia_profile_name"] == "external"
        refute Map.has_key?(raw["meta"], "variables_dropped")
      after
        if previous,
          do: System.put_env("EVENTS_KEEP_CHANNEL_VARIABLES", previous),
          else: System.delete_env("EVENTS_KEEP_CHANNEL_VARIABLES")
      end
    end
  end

  describe "retention" do
    # A live switch writes ~146,000 rows and ~556MB of raw JSON a DAY — measured
    # on nimbus-connectix, where the file reached 557MB in six hours against
    # 5.7GB of free space. Without a window this fills the volume in days and
    # takes Mnesia, which shares it, down too.
    test "drops what is past the window and keeps what is not", %{store: store} do
      old = System.system_time(:microsecond) - 30 * 86_400 * 1_000_000
      now = System.system_time(:microsecond)

      Events.insert(store, ev(%{"sid" => "ancient", "create_date" => old}))
      Events.insert(store, ev(%{"sid" => "today", "create_date" => now}))
      sync(store)

      with_env("EVENTS_RETENTION_DAYS", "7", fn ->
        send(store, :prune)
        sync(store)
      end)

      {:ok, rows} = Events.recent(store, [])
      sids = Enum.map(rows, & &1["sid"])

      assert "today" in sids
      refute "ancient" in sids
    end

    test "0 keeps everything, for a deployment that stores events elsewhere", %{store: store} do
      old = System.system_time(:microsecond) - 365 * 86_400 * 1_000_000
      Events.insert(store, ev(%{"sid" => "ancient", "create_date" => old}))
      sync(store)

      with_env("EVENTS_RETENTION_DAYS", "0", fn ->
        send(store, :prune)
        sync(store)
      end)

      {:ok, rows} = Events.recent(store, [])
      assert "ancient" in Enum.map(rows, & &1["sid"])
    end

    # Pruning bounds growth; it does not shrink the file. Measured against a
    # copy of the live store on DuckDB v1.5.5: 39,865 rows occupied 348MB,
    # deleting half left it at 348MB, and CHECKPOINT and VACUUM changed
    # nothing. So a store that has already ballooned needs the file rewritten,
    # and this is the guard that keeps that fact from being forgotten.
    test "deleting rows does not reclaim the file, which is why compaction exists" do
      path = Path.join(System.tmp_dir!(), "events-reclaim-#{System.unique_integer([:positive])}.duckdb")
      name = :"events_reclaim_#{System.unique_integer([:positive])}"
      store = start_supervised!({Events, name: name, path: path})
      on_exit(fn -> File.rm(path); File.rm(path <> ".wal") end)

      blob = String.duplicate("abcdefghij", 400)

      for i <- 1..2_000 do
        Events.insert(store, ev(%{"sid" => "s#{i}", "create_date" => i, "raw" => blob <> "#{i}"}))
      end

      sync(store)
      Events.stats(store)
      before = File.stat!(path).size

      # NOT `recent/2` — it caps at #{1_000} rows, which is exactly the cap that
      # made a production search look empty earlier.
      assert Events.stats(store).count == 2_000

      # Delete nearly everything the way prune does.
      state = :sys.get_state(store)
      Duckdbex.query(state.conn, "DELETE FROM events WHERE create_date < 1900")
      Duckdbex.query(state.conn, "CHECKPOINT")
      Duckdbex.query(state.conn, "VACUUM")

      after_delete = File.stat!(path).size

      assert after_delete >= before * 0.9,
             "DuckDB started reclaiming on DELETE — compaction may no longer be needed"
    end
  end

  describe "a file it cannot open yet" do
    # The store used to give up permanently on a failed open, and the failure
    # that actually happens is transient by construction: kamal starts the new
    # container, health-checks it, and only THEN stops the old one, so both run
    # for a few seconds and DuckDB is single-writer. The loser logged
    # "Conflicting lock is held in PID 0" and stored NOTHING for the life of
    # the container — every deploy, silently, until someone restarted it.
    #
    # That exact lock cannot be staged here: DuckDB permits several connections
    # to one file from within a single OS process, so two stores in this BEAM
    # both open it happily. A directory where the file belongs fails the same
    # way — `open/1` gets past `mkdir_p` and `Duckdbex.open/1` refuses — and it
    # is the retry, not the particular errno, that is under test.
    test "starts inert rather than crashing, and opens once the obstruction clears" do
      path =
        Path.join(System.tmp_dir!(), "events-blocked-#{System.unique_integer([:positive])}.duckdb")

      File.mkdir_p!(path)
      on_exit(fn -> File.rm_rf(path) end)

      name = :"events_blocked_#{System.unique_integer([:positive])}"
      store = start_supervised!({Events, name: name, path: path})

      # Inert, but alive and still accepting casts: a broken store must never
      # take the realtime path down with it.
      assert Process.alive?(store)
      refute Events.stats(store).open?

      Events.insert(store, ev(%{"sid" => "dropped"}))
      assert Process.alive?(store)
      refute Events.stats(store).open?

      File.rm_rf!(path)

      assert eventually(fn -> Events.stats(store).open? end),
             "the store never reopened after the obstruction was cleared"

      # And it works, rather than merely reporting itself open.
      Events.insert(store, ev(%{"sid" => "after-reopen"}))
      sync(store)
      {:ok, rows} = Events.recent(store, [])
      assert Enum.any?(rows, &(&1["sid"] == "after-reopen"))
    end
  end

  defp eventually(fun, attempts \\ 60) do
    Enum.reduce_while(1..attempts, false, fn _i, _acc ->
      if fun.() do
        {:halt, true}
      else
        Process.sleep(250)
        {:cont, false}
      end
    end)
  end

  describe "insert/2 and recent/2" do
    test "an inserted event comes back", %{store: store} do
      Events.insert(store, ev(%{"label" => "number.answer", "raw" => ~s({"a":1})}))
      sync(store)

      assert {:ok, [row]} = Events.recent(store, [])
      assert row["src"] == "CallEvents"
      assert row["sid"] == "call-1"
      assert row["label"] == "number.answer"
      assert row["raw"] == ~s({"a":1})
      assert is_integer(row["create_date"])
      assert row["headers"] == %{}
    end

    test "newest first", %{store: store} do
      Events.insert(store, ev(%{"label" => "first", "create_date" => 1_000, "raw" => "1"}))
      Events.insert(store, ev(%{"label" => "second", "create_date" => 2_000, "raw" => "2"}))
      Events.insert(store, ev(%{"label" => "third", "create_date" => 3_000, "raw" => "3"}))
      sync(store)

      assert {:ok, rows} = Events.recent(store, [])
      assert Enum.map(rows, & &1["label"]) == ~w(third second first)
    end

    test "headers round-trip as a map", %{store: store} do
      Events.insert(store, ev(%{"headers" => %{"CC-Agent" => "abc", "n" => 2}}))
      sync(store)

      assert {:ok, [row]} = Events.recent(store, [])
      assert row["headers"] == %{"CC-Agent" => "abc", "n" => 2}
    end

    test ":limit caps the page", %{store: store} do
      for n <- 1..5,
          do: Events.insert(store, ev(%{"create_date" => n, "raw" => Integer.to_string(n)}))

      sync(store)

      assert {:ok, rows} = Events.recent(store, limit: 2)
      assert length(rows) == 2
    end

    test ":src filters", %{store: store} do
      Events.insert(store, ev(%{"src" => "StateChannel", "raw" => "state"}))
      Events.insert(store, ev(%{"src" => "CallEvents", "raw" => "call"}))
      sync(store)

      assert {:ok, [row]} = Events.recent(store, src: "StateChannel")
      assert row["raw"] == "state"
    end
  end

  describe "dedupe" do
    test "the same frame delivered 28 times is one row", %{store: store} do
      # Not a hypothetical: one `number.answer` was measured arriving 28 times
      # off the node, identical in every field.
      for _ <- 1..28, do: Events.record(store, "CallEvents", @frame)
      stats = sync(store)

      assert {:ok, rows} = Events.recent(store, [])
      assert length(rows) == 1
      assert stats.count == 1

      # All 28 were accepted by the store; 27 were dropped by the primary key,
      # not by an error.
      assert stats.written == 28
      assert stats.errors == 0
    end
  end

  describe "timeline/2" do
    test "oldest first, one sid only", %{store: store} do
      Events.insert(
        store,
        ev(%{"sid" => "call-A", "label" => "b", "create_date" => 2, "raw" => "2"})
      )

      Events.insert(
        store,
        ev(%{"sid" => "call-A", "label" => "a", "create_date" => 1, "raw" => "1"})
      )

      Events.insert(
        store,
        ev(%{"sid" => "call-A", "label" => "c", "create_date" => 3, "raw" => "3"})
      )

      Events.insert(
        store,
        ev(%{"sid" => "call-B", "label" => "z", "create_date" => 4, "raw" => "4"})
      )

      sync(store)

      assert {:ok, rows} = Events.timeline(store, "call-A")
      assert Enum.map(rows, & &1["label"]) == ~w(a b c)
    end

    test "an unknown sid is empty, not an error", %{store: store} do
      assert {:ok, []} = Events.timeline(store, "nobody")
    end
  end

  describe "search/3" do
    test "matches a substring of raw", %{store: store} do
      Events.insert(store, ev(%{"raw" => ~s({"caller_id_number":"0501234567"})}))
      Events.insert(store, ev(%{"raw" => ~s({"caller_id_number":"0509999999"})}))
      sync(store)

      assert {:ok, [row]} = Events.search(store, "0501234", [])
      assert row["raw"] =~ "0501234567"
    end

    test "matches sid, label and headers too", %{store: store} do
      Events.insert(store, ev(%{"sid" => "needle-sid", "raw" => "1"}))
      Events.insert(store, ev(%{"label" => "needle-label", "raw" => "2"}))
      Events.insert(store, ev(%{"headers" => %{"k" => "needle-header"}, "raw" => "3"}))
      sync(store)

      assert {:ok, [_]} = Events.search(store, "needle-sid", [])
      assert {:ok, [_]} = Events.search(store, "needle-label", [])
      assert {:ok, [_]} = Events.search(store, "needle-header", [])
      assert {:ok, rows} = Events.search(store, "needle", [])
      assert length(rows) == 3
    end

    test "newest first and :limit applies", %{store: store} do
      for n <- 1..4,
          do:
            Events.insert(
              store,
              ev(%{"create_date" => n, "raw" => "needle #{n}", "label" => "l#{n}"})
            )

      sync(store)

      assert {:ok, rows} = Events.search(store, "needle", limit: 2)
      assert Enum.map(rows, & &1["label"]) == ~w(l4 l3)
    end
  end

  describe "stats/1" do
    test "reports an open store and its counters", %{store: store, path: path} do
      Events.insert(store, ev(%{"raw" => "a"}))
      Events.insert(store, ev(%{"raw" => "b"}))
      stats = sync(store)

      assert stats.open? == true
      assert stats.count == 2
      assert stats.written == 2
      assert stats.errors == 0
      assert stats.path == path
    end
  end

  describe "record/3" do
    test "maps a production cable frame onto the row shape", %{store: store} do
      Events.record(store, "StateChannel", @frame)
      sync(store)

      assert {:ok, [row]} = Events.recent(store, [])

      assert row["src"] == "StateChannel"
      # No call_uuid on this frame, so the sid falls back to the user — which is
      # what makes an agent's state changes a timeline of their own.
      assert row["sid"] == "cb1b0a46-77d5-4b3a-92d8-31768fea74e4"
      assert row["label"] == "agent-state-change"

      # Headers keep the frame's own small fields, including meta.
      assert row["headers"]["user_state"] == "In a queue call"
      assert row["headers"]["meta"]["CC-Agent"] == "cb1b0a46-77d5-4b3a-92d8-31768fea74e4"

      # Nothing is lost: raw is the whole frame.
      assert Jason.decode!(row["raw"]) == @frame
    end

    test "a call_uuid wins over the user, so a call is one timeline", %{store: store} do
      frame = Map.merge(@frame, %{"call_uuid" => "the-call", "action" => "number.answer"})
      Events.record(store, "CallEvents", frame)
      sync(store)

      assert {:ok, [row]} = Events.recent(store, [])
      assert row["sid"] == "the-call"
      assert row["label"] == "number.answer"
    end

    test "a frame with neither call nor user falls back to its own id", %{store: store} do
      Events.record(store, "CallEvents", %{"id" => "frame-77", "event" => "ping"})
      sync(store)

      assert {:ok, [row]} = Events.recent(store, [])
      assert row["sid"] == "frame-77"
      assert row["label"] == "ping"
    end

    test "a non-map is ignored rather than crashing the caller", %{store: store} do
      assert Events.record(store, "CallEvents", "not a frame") == :ok
      assert sync(store).count == 0
    end
  end

  describe "a store that could not open" do
    setup do
      name = :"events_closed_#{System.unique_integer([:positive])}"
      store = start_supervised!({Connectix.Events, name: name, path: "/proc/nope/events.duckdb"})
      %{closed: store}
    end

    test "starts anyway and reports itself closed", %{closed: store} do
      stats = Events.stats(store)
      assert stats.open? == false
      assert stats.count == 0
    end

    test "writes are silently dropped, never raised", %{closed: store} do
      assert Events.record(store, "CallEvents", @frame) == :ok
      assert Events.insert(store, %{"src" => "x", "raw" => "y"}) == :ok
      assert Events.stats(store).open? == false
    end

    test "every read says unavailable rather than empty", %{closed: store} do
      # An empty list reads as "no events happened", which is a different and
      # much more misleading answer than "this portal is not storing any".
      assert {:error, :not_storing} = Events.recent(store, [])
      assert {:error, :not_storing} = Events.timeline(store, "call-1")
      assert {:error, :not_storing} = Events.search(store, "x", [])
    end
  end
end
