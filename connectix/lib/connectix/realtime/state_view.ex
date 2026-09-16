defmodule Connectix.Realtime.StateView do
  @moduledoc """
  Folds the node's state events into a current picture of one entity.

  The node stores nothing and publishes one NAMED event per transition
  (`va-crystal node/realtime/state_publisher.cr`), so whoever wants a current
  value has to accumulate it. That accumulation is this module, and it belongs
  here rather than in the browser: the relay this replaced passed the raw
  document through with a comment saying the browser would fold it, and no
  browser ever did — the stream was relayed and dropped. Folding here also
  means a reconnecting tab receives a whole view instead of whatever delta
  happens to arrive next.

  ## The envelope

      %{"event" => "call.hangup", "at" => 1788192667,
        "scope" => "call", "id" => "c89919fd-…",
        "data"   => %{"action" => "call.hangup", "state" => "hangup",
                      "channel_uuids" => ["88653c7e-…"]},
        "incr"   => %{"hangup_counter" => 1},
        "unset"  => ["talking_to_number"],
        "remove" => %{"members" => ["…"]},
        "once"   => ["created_at"],
        "ttl"    => 10800,
        "metadata" => %{"environment_uuid" => "6c87416a-…"}}

  Each section means something a plain merge would lose:

  | section | meaning |
  |---|---|
  | `data` | absolute values, except that a **list is what was ADDED** and a **map sets subfields** |
  | `incr` | counter DELTAS, never totals — the consumer adds them up |
  | `unset` | fields removed; `"field.subfield"` removes one subfield |
  | `remove` | values removed from the collection at that field |
  | `once` | fields in `data` to write only if absent |
  | `ttl` | advisory; nothing here expires, so it is ignored |

  **This is not the op log the earlier fold read.** That format
  (`%{"ops" => [%{"op" => "set", "key" => "call_state:<uuid>:state"}]}`) made
  every consumer reimplement a Redis, and the node replaced it. A fold still
  written against it silently returns the view unchanged for every message the
  node actually sends, which is a stream that looks connected and aggregates
  nothing.

  ## Order within one message

  The sections arrive as a set, not a sequence, so the order is decided here:
  `data`, then `incr`, then `remove`, and `unset` LAST. A batch that both
  writes and deletes a field ends with it deleted, which is the reading that
  cannot resurrect something the node said was gone.
  """

  @type t :: %{optional(String.t()) => term()}

  @spec new() :: t()
  def new, do: %{}

  @doc """
  Apply one state event to the view.

  Anything that is not a map with at least one known section leaves the view
  untouched — an unknown section is ignored rather than raised on, so one new
  field on the node cannot stop a fold.
  """
  @spec apply_message(t(), map()) :: t()
  def apply_message(view, %{} = message) do
    once = message |> Map.get("once") |> list()

    view
    |> apply_data(Map.get(message, "data"), once)
    |> apply_incr(Map.get(message, "incr"))
    |> apply_remove(Map.get(message, "remove"))
    |> apply_unset(Map.get(message, "unset"))
  end

  def apply_message(view, _not_a_message), do: view

  # ── data ─────────────────────────────────────────────────────────────────

  defp apply_data(view, %{} = data, once) do
    Enum.reduce(data, view, fn {field, value}, acc ->
      if field in once and Map.has_key?(acc, field) do
        acc
      else
        Map.put(acc, field, merge(Map.get(acc, field), value))
      end
    end)
  end

  defp apply_data(view, _absent, _once), do: view

  # A map sets subfields rather than replacing the whole object: the node's
  # `hset` renders as a nested object holding only the subfields it touched,
  # so replacing would drop every subfield this particular event did not
  # mention.
  defp merge(current, value) when is_map(current) and is_map(value),
    do: Map.merge(current, value)

  # A list is what was ADDED, not the whole collection — `sadd` and `rpush`
  # both render this way. Appending is therefore the faithful reading, and
  # duplicates are dropped because `sadd` is a set and a repeated `rpush` of
  # the same id is the node re-announcing a member it already has.
  defp merge(current, value) when is_list(current) and is_list(value),
    do: current ++ Enum.reject(value, &(&1 in current))

  defp merge(_current, value), do: value

  # ── incr ─────────────────────────────────────────────────────────────────

  defp apply_incr(view, %{} = incr) do
    Enum.reduce(incr, view, fn {field, by}, acc ->
      Map.update(acc, field, number(by), &(number(&1) + number(by)))
    end)
  end

  defp apply_incr(view, _absent), do: view

  # ── remove ───────────────────────────────────────────────────────────────

  defp apply_remove(view, %{} = remove) do
    Enum.reduce(remove, view, fn {field, values}, acc ->
      Map.update(acc, field, [], fn
        list when is_list(list) -> Enum.reject(list, &(&1 in list(values)))
        other -> other
      end)
    end)
  end

  defp apply_remove(view, _absent), do: view

  # ── unset ────────────────────────────────────────────────────────────────

  defp apply_unset(view, unset) when is_list(unset) do
    Enum.reduce(unset, view, fn field, acc -> unset_field(acc, to_string(field)) end)
  end

  defp apply_unset(view, _absent), do: view

  # `"field.subfield"` is the node's rendering of `hdel`; anything else names
  # a whole field.
  defp unset_field(view, field) do
    case String.split(field, ".", parts: 2) do
      [field, subfield] ->
        Map.update(view, field, %{}, fn
          map when is_map(map) -> Map.delete(map, subfield)
          other -> other
        end)

      [field] ->
        Map.delete(view, field)
    end
  end

  # ── coercion ─────────────────────────────────────────────────────────────

  defp list(values) when is_list(values), do: values
  defp list(nil), do: []
  defp list(value), do: [value]

  # The node renders every `set` value with `to_s`, so a counter that was
  # seeded by a `set` arrives as a string and must still add up. A value that
  # is neither is treated as absent rather than crashing the fold.
  defp number(value) when is_number(value), do: value

  defp number(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} -> int
      _not_an_integer -> float(value)
    end
  end

  defp number(_other), do: 0

  defp float(value) do
    case Float.parse(value) do
      {float, _rest} -> float
      :error -> 0
    end
  end
end
