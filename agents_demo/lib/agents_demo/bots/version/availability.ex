defmodule AgentsDemo.Bots.Version.Availability do
  @moduledoc "When the bot counts as \"in hours\": a time zone plus open windows. No windows = always open."
  alias AgentsDemo.Bots.Version.Availability.Window
  @derive Jason.Encoder
  defstruct time_zone: "UTC", windows: []

  def new(attrs \\ %{}) do
    attrs = Map.new(attrs, fn {k, v} -> {to_string(k), v} end)
    zone = attrs["time_zone"] || "UTC"

    with :ok <- valid_zone(zone),
         {:ok, windows} <- build(attrs["windows"] || []) do
      {:ok, %__MODULE__{time_zone: zone, windows: windows}}
    end
  end

  defp valid_zone(zone) do
    case DateTime.now(zone) do
      {:ok, _} -> :ok
      {:error, _} -> {:error, %{time_zone: ["is not a known IANA time zone"]}}
    end
  end

  defp build(list) do
    Enum.reduce_while(list, {:ok, []}, fn attrs, {:ok, acc} ->
      case Window.new(attrs) do
        {:ok, w} -> {:cont, {:ok, [w | acc]}}
        {:error, e} -> {:halt, {:error, %{windows: [e]}}}
      end
    end)
    |> case do
      {:ok, ws} -> {:ok, Enum.reverse(ws)}
      other -> other
    end
  end
end
