defmodule Connectix.Bots.Bot do
  @moduledoc """
  A bot's stable identity — a plain struct. Everything the bot *does* is in
  `Connectix.Bots.BotVersion`. `current_version_id` is the published version new
  conversations pin; `draft_version_id` is the one being edited, if any.
  Uniqueness of name/slug per owner is enforced by `Connectix.Bots.Store` in the
  write transaction.
  """

  @derive {Jason.Encoder,
           only: [:id, :user_id, :name, :slug, :description, :status,
                  :current_version_id, :draft_version_id, :archived_at, :inserted_at]}
  defstruct [
    :id, :user_id, :name, :slug, :description,
    :current_version_id, :draft_version_id, :archived_at, :inserted_at, :updated_at,
    # Loaded projections. They are never written to the bot table.
    :current_version, :draft_version,
    status: :active
  ]

  @slug_format ~r/^[a-z0-9]+(-[a-z0-9]+)*$/

  def validate_new(owner_id, attrs) do
    attrs = stringify(attrs)
    name = attrs["name"]
    slug = attrs["slug"] || (is_binary(name) && slugify(name)) || nil
    validate(%__MODULE__{user_id: owner_id, name: name, slug: slug, description: attrs["description"]})
  end

  def validate_update(%__MODULE__{} = bot, attrs) do
    attrs = stringify(attrs)
    validate(%{bot | name: Map.get(attrs, "name", bot.name), description: Map.get(attrs, "description", bot.description)})
  end

  def slugify(name) when is_binary(name),
    do: name |> String.downcase() |> String.replace(~r/[^a-z0-9]+/u, "-") |> String.trim("-")

  defp validate(%__MODULE__{} = bot) do
    errors =
      %{}
      |> req(:user_id, bot.user_id)
      |> req(:name, bot.name)
      |> req(:slug, bot.slug)
      |> bad(:name, is_binary(bot.name) and String.length(bot.name) > 100, "should be at most 100 character(s)")
      |> bad(:slug, is_binary(bot.slug) and not Regex.match?(@slug_format, bot.slug),
        "must be lowercase letters, digits and single dashes")

    if map_size(errors) == 0, do: {:ok, bot}, else: {:error, errors}
  end

  defp req(errors, field, value) when value in [nil, ""], do: Map.put(errors, field, ["can't be blank"])
  defp req(errors, _f, _v), do: errors
  defp bad(errors, _f, false, _m), do: errors
  defp bad(errors, field, true, msg), do: Map.update(errors, field, [msg], &(&1 ++ [msg]))
  defp stringify(attrs), do: Map.new(attrs, fn {k, v} -> {to_string(k), v} end)
end
