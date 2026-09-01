defmodule AgentsDemo.Realtime.StateView do
  @moduledoc """
  Folds the node's state stream into a current picture.

  `node` publishes one named event per transition and stores nothing
  (va-crystal `docs/CABLE_SPEC.md` §5), so every consumer that wants a current
  value has to accumulate it. That accumulation belongs here and not in the
  browser: the previous relay passed the raw document through with a comment
  saying the browser would fold it, and no browser ever did — the stream was
  relayed and dropped.

  Folding server-side also means a reconnecting tab receives a whole view rather
  than whatever delta happens to arrive next.

  Ops, per the spec:

    set    assign the field                  incr   add a DELTA, never a total
    del    remove it                         expire advisory ttl (we ignore it)
    hset   set a subfield                    hdel   remove a subfield
    rpush  append to a list                  lrem   remove from a list
    sadd   add to a set
  """

  @type t :: %{optional(String.t()) => term()}

  @spec new() :: t()
  def new, do: %{}

  @doc "Apply one state message (`%{\"ops\" => [...]}`) to the view."
  @spec apply_message(t(), map()) :: t()
  def apply_message(view, %{"ops" => ops}) when is_list(ops) do
    Enum.reduce(ops, view, &apply_op(&2, &1))
  end

  def apply_message(view, _other), do: view

  # `key` keeps the original `<scope>:<id>:<field>` form; the field is
  # everything after the second colon.
  defp field(key), do: key |> to_string() |> String.split(":", parts: 3) |> List.last()

  defp apply_op(view, %{"op" => "set", "key" => key, "value" => value}),
    do: Map.put(view, field(key), value)

  defp apply_op(view, %{"op" => "del", "key" => key}),
    do: Map.delete(view, field(key))

  # A delta, not a total: two `incr … by: 1` mean two. Anything non-numeric
  # already in the slot is treated as absent rather than crashing the fold.
  defp apply_op(view, %{"op" => "incr", "key" => key} = op) do
    by = to_number(Map.get(op, "by", 1))
    Map.update(view, field(key), by, fn current -> to_number(current) + by end)
  end

  defp apply_op(view, %{"op" => "hset", "key" => key, "field" => sub, "value" => value}) do
    Map.update(view, field(key), %{sub => value}, fn
      map when is_map(map) -> Map.put(map, sub, value)
      _ -> %{sub => value}
    end)
  end

  defp apply_op(view, %{"op" => "hdel", "key" => key, "field" => sub}) do
    Map.update(view, field(key), %{}, fn
      map when is_map(map) -> Map.delete(map, sub)
      other -> other
    end)
  end

  defp apply_op(view, %{"op" => "rpush", "key" => key, "value" => value}) do
    Map.update(view, field(key), [value], fn
      list when is_list(list) -> list ++ [value]
      _ -> [value]
    end)
  end

  defp apply_op(view, %{"op" => "lrem", "key" => key, "value" => value}) do
    Map.update(view, field(key), [], fn
      list when is_list(list) -> List.delete(list, value)
      other -> other
    end)
  end

  defp apply_op(view, %{"op" => "sadd", "key" => key, "value" => value}) do
    Map.update(view, field(key), [value], fn
      list when is_list(list) -> if value in list, do: list, else: list ++ [value]
      _ -> [value]
    end)
  end

  # `expire` is advisory — nothing server-side expires anything — and unknown
  # ops are ignored rather than raising, so one new op type cannot stop a fold.
  defp apply_op(view, _op), do: view

  defp to_number(value) when is_number(value), do: value

  defp to_number(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, _} -> int
      :error -> 0
    end
  end

  defp to_number(_), do: 0
end
