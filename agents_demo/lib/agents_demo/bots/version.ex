defmodule AgentsDemo.Bots.Version do
  @moduledoc """
  Shared helpers for the version-config area structs (`Version.Behavior`,
  `Version.Model`, …).

  These areas were `Ecto.Changeset`-validated embedded schemas; now they are
  plain structs with a `new/1` that pipes an error map through these checks.
  Simple on purpose — a handful of rules, no schema machinery.
  """

  @doc "Read the listed keys off a (string- or atom-keyed) attrs map, defaulting to `current`'s."
  def take(attrs, %_{} = current, keys) do
    attrs = if is_struct(attrs), do: Map.from_struct(attrs), else: attrs
    attrs = Map.new(attrs, fn {k, v} -> {to_string(k), v} end)
    Map.new(keys, fn key -> {key, Map.get(attrs, Atom.to_string(key), Map.get(current, key))} end)
  end

  def inclusion(errors, _field, nil, _allowed), do: errors

  def inclusion(errors, field, value, allowed),
    do: if(value in allowed, do: errors, else: err(errors, field, "is invalid"))

  def range(errors, field, value, opts) when is_number(value) do
    Enum.reduce(opts, errors, fn
      {:gte, b}, acc ->
        if value >= b, do: acc, else: err(acc, field, "must be greater than or equal to #{b}")

      {:gt, b}, acc ->
        if value > b, do: acc, else: err(acc, field, "must be greater than #{b}")

      {:lte, b}, acc ->
        if value <= b, do: acc, else: err(acc, field, "must be less than or equal to #{b}")
    end)
  end

  def range(errors, _field, _value, _opts), do: errors

  def max_len(errors, field, value, max) when is_binary(value),
    do:
      if(String.length(value) <= max,
        do: errors,
        else: err(errors, field, "should be at most #{max} character(s)")
      )

  def max_len(errors, _field, _value, _max), do: errors

  def min_items(errors, field, list, min) when is_list(list),
    do:
      if(length(list) >= min,
        do: errors,
        else: err(errors, field, "should have at least #{min} item(s)")
      )

  def min_items(errors, _field, _value, _min), do: errors

  def done(errors, struct) when map_size(errors) == 0, do: {:ok, struct}
  def done(errors, _struct), do: {:error, errors}

  defp err(errors, field, msg), do: Map.update(errors, field, [msg], &(&1 ++ [msg]))
end
