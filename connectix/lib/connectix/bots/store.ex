defmodule Connectix.Bots.Store do
  @moduledoc """
  Bots and their versions, in Mnesia.

  Two `disc_copies` tables, replicated across the cluster. `bots` is indexed by
  `user_id` (scoped lists) and `slug` (default-bot lookup); `bot_versions` by
  `bot_id`. Version rows carry the whole config — the typed area structs are
  ordinary Erlang terms Mnesia stores as-is, so a version is one row.

  Multi-row writes (create bot + first draft, publish) are the caller's
  `:mnesia.transaction`; this module offers the primitives.
  """

  use GenServer

  alias Connectix.Bots.{Bot, BotVersion}
  alias Connectix.Mnesia

  @bots :bots
  @bot_fields [:id, :user_id, :name, :slug, :description, :current_version_id,
               :draft_version_id, :archived_at, :inserted_at, :updated_at, :status]

  @versions :bot_versions
  @version_fields [:id, :bot_id, :number, :fingerprint, :change_note, :published_at,
                   :published_by_user_id, :retired_at, :inserted_at, :updated_at, :status,
                   :behavior, :model, :safety, :knowledge, :memory, :output, :handoff,
                   :voice, :limits, :availability, :audiences, :skills]

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(_opts) do
    Mnesia.ensure_table(@bots, attributes: @bot_fields, type: :set, index: [:user_id, :slug])
    Mnesia.ensure_table(@versions, attributes: @version_fields, type: :set, index: [:bot_id])
    {:ok, %{}}
  end

  # ── expose the field lists so the context can run its own transactions ──────
  def bots_table, do: {@bots, @bot_fields}
  def versions_table, do: {@versions, @version_fields}

  # ── Bots ─────────────────────────────────────────────────────────────────
  def get_bot(id), do: Mnesia.get(@bots, @bot_fields, id) |> to_bot()

  def list_bots(user_id) do
    Mnesia.transaction!(fn -> Mnesia.index_read(@bots, @bot_fields, user_id, :user_id) end)
    |> Enum.map(&to_bot/1)
  end

  def get_bot_by_slug(user_id, slug) do
    Mnesia.transaction!(fn ->
      @bots
      |> Mnesia.index_read(@bot_fields, slug, :slug)
      |> Enum.find(&(&1.user_id == user_id))
    end)
    |> to_bot()
  end

  @doc "True when a name (or slug) is taken by another of this owner's bots."
  def name_or_slug_taken?(user_id, name, slug, except_id) do
    Mnesia.transaction!(fn ->
      @bots
      |> Mnesia.index_read(@bot_fields, user_id, :user_id)
      |> Enum.any?(fn b -> b.id != except_id and (b.name == name or b.slug == slug) end)
    end)
  end

  def put_bot(%Bot{} = bot), do: Mnesia.transaction!(fn -> put_bot_tx(bot) end)

  # write inside an outer transaction (returns the struct)
  def put_bot_tx(%Bot{} = bot) do
    now = DateTime.utc_now()
    bot = %{bot | id: bot.id || Mnesia.uuid(), inserted_at: bot.inserted_at || now, updated_at: now}
    Mnesia.write(@bots, @bot_fields, Map.from_struct(bot))
    bot
  end

  def delete_bot_tx(id), do: Mnesia.delete(@bots, id)

  # ── Versions ───────────────────────────────────────────────────────────────
  def get_version(id), do: Mnesia.get(@versions, @version_fields, id) |> to_version()

  def list_versions(bot_id) do
    Mnesia.transaction!(fn -> Mnesia.index_read(@versions, @version_fields, bot_id, :bot_id) end)
    |> Enum.map(&to_version/1)
    |> Enum.sort_by(& &1.number, :desc)
  end

  def get_version_by_number(bot_id, number) do
    Enum.find(list_versions(bot_id), &(&1.number == number))
  end

  def put_version(%BotVersion{} = version), do: Mnesia.transaction!(fn -> put_version_tx(version) end)

  def put_version_tx(%BotVersion{} = version) do
    existing = Mnesia.read(@versions, @version_fields, version.id) |> to_version()
    enforce_version_transition!(existing, version)

    now = DateTime.utc_now()
    version = %{version | id: version.id || Mnesia.uuid(), inserted_at: version.inserted_at || now, updated_at: now}
    Mnesia.write(@versions, @version_fields, Map.from_struct(version))
    version
  end

  def delete_version_tx(id) do
    case Mnesia.read(@versions, @version_fields, id) |> to_version() do
      nil -> :ok
      %BotVersion{status: :draft} -> Mnesia.delete(@versions, id)
      %BotVersion{} -> :mnesia.abort(:immutable_version)
    end
  end

  defp enforce_version_transition!(nil, _incoming), do: :ok
  defp enforce_version_transition!(%BotVersion{status: :draft}, _incoming), do: :ok

  defp enforce_version_transition!(
         %BotVersion{status: :published} = existing,
         %BotVersion{status: :retired} = incoming
       ) do
    immutable = [:status, :retired_at, :updated_at]

    if Map.drop(Map.from_struct(existing), immutable) ==
         Map.drop(Map.from_struct(incoming), immutable) do
      :ok
    else
      :mnesia.abort(:immutable_version)
    end
  end

  defp enforce_version_transition!(%BotVersion{}, _incoming),
    do: :mnesia.abort(:immutable_version)

  # ── shaping ────────────────────────────────────────────────────────────────
  defp to_bot(nil), do: nil
  defp to_bot(%{} = row), do: struct(Bot, row)

  defp to_version(nil), do: nil
  defp to_version(%{} = row), do: struct(BotVersion, row)
end
