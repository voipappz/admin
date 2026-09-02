defmodule AgentsDemo.Bots.Version.Audiences.Entry do
  @moduledoc false
  @derive Jason.Encoder
  defstruct [:phone, :audience_id, :name]

  @phone ~r/^\+?[0-9][0-9 \-]{5,}$/
  @id ~r/^[a-z][a-z0-9_]*$/

  def new(attrs) do
    m = AgentsDemo.Bots.Version.take(attrs, %__MODULE__{}, [:phone, :audience_id, :name])

    errors =
      %{}
      |> req(:phone, m.phone)
      |> req(:audience_id, m.audience_id)
      |> fmt(:phone, m.phone, @phone, "must be a phone number")
      |> fmt(:audience_id, m.audience_id, @id, "is invalid")

    AgentsDemo.Bots.Version.done(errors, struct(__MODULE__, m))
  end

  defp req(errors, field, value) when value in [nil, ""], do: Map.put(errors, field, ["can't be blank"])
  defp req(errors, _f, _v), do: errors
  defp fmt(errors, _f, nil, _re, _m), do: errors
  defp fmt(errors, field, value, re, msg),
    do: if(Regex.match?(re, to_string(value)), do: errors, else: Map.update(errors, field, [msg], &(&1 ++ [msg])))
end
