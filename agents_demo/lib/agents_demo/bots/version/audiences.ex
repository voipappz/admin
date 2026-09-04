defmodule Connectix.Bots.Version.Audiences do
  @moduledoc "Who the bot is talking to, decided from the sender's phone; unmatched senders get `default_id`."
  alias Connectix.Bots.Version.Audiences.Entry
  @derive Jason.Encoder
  defstruct default_id: "customer", entries: []

  @id ~r/^[a-z][a-z0-9_]*$/

  def new(attrs \\ %{}) do
    attrs = Map.new(attrs, fn {k, v} -> {to_string(k), v} end)
    default_id = attrs["default_id"] || "customer"

    with :ok <- valid_id(default_id),
         {:ok, entries} <- build(attrs["entries"] || []),
         :ok <- unique_phones(entries) do
      {:ok, %__MODULE__{default_id: default_id, entries: entries}}
    end
  end

  @doc "The audience id and display name for a phone number, or the default with no name."
  def resolve(%__MODULE__{} = audiences, phone) when is_binary(phone) do
    digits = String.replace(phone, ~r/\D/, "")

    case Enum.find(audiences.entries, &(String.replace(&1.phone, ~r/\D/, "") == digits)) do
      %Entry{audience_id: id, name: name} -> %{id: id, name: name}
      nil -> %{id: audiences.default_id, name: nil}
    end
  end

  def resolve(%__MODULE__{default_id: id}, _no_phone), do: %{id: id, name: nil}

  defp valid_id(id) do
    if Regex.match?(@id, to_string(id)), do: :ok, else: {:error, %{default_id: ["is invalid"]}}
  end

  defp build(list) do
    Enum.reduce_while(list, {:ok, []}, fn attrs, {:ok, acc} ->
      case Entry.new(attrs) do
        {:ok, e} -> {:cont, {:ok, [e | acc]}}
        {:error, e} -> {:halt, {:error, %{entries: [e]}}}
      end
    end)
    |> case do
      {:ok, es} -> {:ok, Enum.reverse(es)}
      other -> other
    end
  end

  defp unique_phones(entries) do
    phones = Enum.map(entries, &String.replace(&1.phone || "", ~r/\D/, ""))
    if length(phones) == length(Enum.uniq(phones)),
      do: :ok,
      else: {:error, %{entries: ["list the same phone number more than once"]}}
  end
end
