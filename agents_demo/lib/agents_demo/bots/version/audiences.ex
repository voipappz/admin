defmodule AgentsDemo.Bots.Version.Audiences do
  @moduledoc """
  Who the bot is talking to, decided deterministically from the sender.

  An entry maps phone numbers to an audience id (for example `"partner"`);
  anyone unmatched is the `default_id`. A flow may start at a different
  state per audience. Names are optional and only used for greetings.
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias __MODULE__.Entry

  @primary_key false
  embedded_schema do
    field :default_id, :string, default: "customer"
    embeds_many :entries, Entry, on_replace: :delete
  end

  def changeset(audiences, attrs) do
    audiences
    |> cast(attrs, [:default_id])
    |> validate_required([:default_id])
    |> validate_format(:default_id, ~r/^[a-z][a-z0-9_]*$/)
    |> cast_embed(:entries)
    |> validate_unique_phones()
  end

  @doc """
  The audience id and display name for a phone number, or the default with
  no name.
  """
  def resolve(%__MODULE__{} = audiences, phone) when is_binary(phone) do
    digits = String.replace(phone, ~r/\D/, "")

    case Enum.find(audiences.entries, &(String.replace(&1.phone, ~r/\D/, "") == digits)) do
      %Entry{audience_id: id, name: name} -> %{id: id, name: name}
      nil -> %{id: audiences.default_id, name: nil}
    end
  end

  def resolve(%__MODULE__{default_id: id}, _no_phone), do: %{id: id, name: nil}

  defp validate_unique_phones(changeset) do
    phones =
      changeset
      |> get_field(:entries)
      |> Enum.map(&String.replace(&1.phone || "", ~r/\D/, ""))

    if length(phones) == length(Enum.uniq(phones)) do
      changeset
    else
      add_error(changeset, :entries, "list the same phone number more than once")
    end
  end
end
