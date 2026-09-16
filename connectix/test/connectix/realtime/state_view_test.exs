defmodule Connectix.Realtime.StateViewTest do
  @moduledoc """
  The aggregation, against the envelope the node actually publishes.

  There were no tests here at all, and that is how the fold came to be written
  against a format the node had already replaced: it read
  `%{"ops" => [%{"op" => "set", "key" => …}]}` and the node sends named domain
  events with `data`/`incr`/`unset`/`remove`/`once`. Every real message fell
  through to the catch-all clause and the view never changed — a stream that
  looks connected and aggregates nothing.

  Every shape below is taken from `va-crystal node/realtime/state_publisher.cr`.
  """

  use ExUnit.Case, async: true

  alias Connectix.Realtime.StateView

  defp fold(messages), do: Enum.reduce(messages, StateView.new(), &StateView.apply_message(&2, &1))

  describe "data" do
    test "assigns absolute values, and the last one wins" do
      view = fold([%{"data" => %{"state" => "ringing"}}, %{"data" => %{"state" => "hangup"}}])
      assert view["state"] == "hangup"
    end

    test "a map sets subfields rather than replacing the object" do
      # `hset` renders as a nested object holding ONLY the subfields that
      # event touched, so replacing drops everything it did not mention.
      view =
        fold([
          %{"data" => %{"members" => %{"a" => "1"}}},
          %{"data" => %{"members" => %{"b" => "2"}}}
        ])

      assert view["members"] == %{"a" => "1", "b" => "2"}
    end

    test "a list is what was ADDED, so it appends rather than replaces" do
      # `sadd`/`rpush` render as an array of the values added in that batch.
      view =
        fold([
          %{"data" => %{"channel_uuids" => ["c1"]}},
          %{"data" => %{"channel_uuids" => ["c2"]}}
        ])

      assert view["channel_uuids"] == ["c1", "c2"]
    end

    test "a repeated member is not added twice" do
      view =
        fold([%{"data" => %{"members" => ["m1"]}}, %{"data" => %{"members" => ["m1", "m2"]}}])

      assert view["members"] == ["m1", "m2"]
    end

    test "the event name rides along in data, as the node puts it there" do
      assert fold([%{"data" => %{"action" => "call.hangup"}}])["action"] == "call.hangup"
    end
  end

  describe "incr" do
    test "adds deltas rather than storing totals" do
      view = fold([%{"incr" => %{"hangup_counter" => 1}}, %{"incr" => %{"hangup_counter" => 2}}])
      assert view["hangup_counter"] == 3
    end

    test "adds onto a value a set seeded as a string" do
      # The node renders every `set` value with `to_s`, so a counter can arrive
      # as "5" and must still add up rather than reset.
      view = fold([%{"data" => %{"calls" => "5"}}, %{"incr" => %{"calls" => 2}}])
      assert view["calls"] == 7
    end

    test "a non-numeric value is treated as absent, not a crash" do
      assert fold([%{"data" => %{"n" => "abc"}}, %{"incr" => %{"n" => 1}}])["n"] == 1
    end
  end

  describe "unset and remove" do
    test "unset removes the whole field" do
      refute Map.has_key?(
               fold([%{"data" => %{"talking_to" => "x"}}, %{"unset" => ["talking_to"]}]),
               "talking_to"
             )
    end

    test "a dotted unset removes one subfield, which is how hdel renders" do
      view =
        fold([
          %{"data" => %{"members" => %{"a" => "1", "b" => "2"}}},
          %{"unset" => ["members.a"]}
        ])

      assert view["members"] == %{"b" => "2"}
    end

    test "remove takes values out of a collection" do
      view =
        fold([
          %{"data" => %{"members" => ["m1", "m2", "m3"]}},
          %{"remove" => %{"members" => ["m2"]}}
        ])

      assert view["members"] == ["m1", "m3"]
    end

    test "within one message a deletion wins over a write" do
      # The sections arrive as a set, not a sequence, so the order is decided
      # by the fold — and the reading that cannot resurrect something the node
      # said was gone is the one to keep.
      view = fold([%{"data" => %{"state" => "ringing"}, "unset" => ["state"]}])
      refute Map.has_key?(view, "state")
    end
  end

  describe "once" do
    test "writes a field only when it is absent" do
      view =
        fold([
          %{"data" => %{"created_at" => "first"}, "once" => ["created_at"]},
          %{"data" => %{"created_at" => "second"}, "once" => ["created_at"]}
        ])

      assert view["created_at"] == "first"
    end

    test "a field not named in once is overwritten as usual" do
      view =
        fold([
          %{"data" => %{"created_at" => "first", "state" => "a"}, "once" => ["created_at"]},
          %{"data" => %{"created_at" => "second", "state" => "b"}, "once" => ["created_at"]}
        ])

      assert view["created_at"] == "first"
      assert view["state"] == "b"
    end
  end

  describe "what it ignores" do
    test "ttl is advisory: nothing here expires" do
      assert fold([%{"data" => %{"state" => "x"}, "ttl" => 10_800}])["state"] == "x"
    end

    test "a message with no known section leaves the view alone" do
      view = fold([%{"data" => %{"state" => "x"}}, %{"event" => "noop", "at" => 1}])
      assert view == %{"state" => "x"}
    end

    test "a non-map is not a message" do
      assert StateView.apply_message(%{"a" => 1}, "nonsense") == %{"a" => 1}
    end
  end

  test "a whole transition, exactly as the publisher documents it" do
    view =
      fold([
        %{
          "event" => "call.hangup",
          "at" => 1_788_192_667,
          "scope" => "call",
          "id" => "c89919fd",
          "data" => %{
            "action" => "call.hangup",
            "state" => "hangup",
            "destination" => "039000000",
            "channel_uuids" => ["88653c7e"]
          },
          "incr" => %{"hangup_counter" => 1},
          "unset" => ["talking_to_number"],
          "ttl" => 10_800,
          "metadata" => %{"environment_uuid" => "6c87416a"}
        }
      ])

    assert view["state"] == "hangup"
    assert view["destination"] == "039000000"
    assert view["channel_uuids"] == ["88653c7e"]
    assert view["hangup_counter"] == 1
    refute Map.has_key?(view, "talking_to_number")
    # `metadata` describes the delivery, not the entity, so it is not folded in.
    refute Map.has_key?(view, "environment_uuid")
  end
end
