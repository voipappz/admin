defmodule Connectix.Bots do
  @moduledoc """
  Bots and their versions: create, edit a draft, publish, pin — on Mnesia.

  Every function takes an `Connectix.Accounts.Scope` first and filters on it, so
  one owner's bots are invisible to another (`pinned_version/1` is the exception,
  running inside an already-scoped agent process).

  Lifecycle: `create_bot` → bot + draft v1; `update_draft` edits the draft
  (creating one from the current version when absent); `publish_draft` validates,
  fingerprints, freezes it and points `current_version` at it in one
  transaction; `create_draft` copies the current version into the next draft;
  `retire_version` supersedes a published version; `archive_bot` closes the bot
  to new conversations. Published versions are never patched in place — the
  immutability check lives in `BotVersion.apply_draft/2`.
  """

  alias Connectix.Accounts.Scope
  alias Connectix.Bots.{Bot, BotVersion, Store, Snapshot, Validator}
  alias Connectix.Conversations
  alias Connectix.Mnesia

  @default_slug "default"

  ## Reading

  def list_bots(%Scope{} = scope),
    do:
      scope
      |> owner_id()
      |> Store.list_bots()
      |> Enum.map(&attach_versions/1)
      |> Enum.sort_by(& &1.name)

  def get_bot(%Scope{} = scope, id) do
    case Store.get_bot(id) do
      %Bot{user_id: uid} = bot ->
        if uid == owner_id(scope),
          do: {:ok, attach_versions(bot)},
          else: {:error, :not_found}

      nil ->
        {:error, :not_found}
    end
  end

  def get_bot_by_slug(%Scope{} = scope, slug) when is_binary(slug) do
    case Store.get_bot_by_slug(owner_id(scope), slug) do
      %Bot{} = bot -> {:ok, attach_versions(bot)}
      nil -> {:error, :not_found}
    end
  end

  def list_versions(%Scope{} = scope, bot_id) do
    with {:ok, bot} <- get_bot(scope, bot_id), do: {:ok, Store.list_versions(bot.id)}
  end

  def get_version(%Scope{} = scope, bot_id, number) when is_integer(number) do
    with {:ok, bot} <- get_bot(scope, bot_id) do
      case Store.get_version_by_number(bot.id, number) do
        %BotVersion{} = v -> {:ok, v}
        nil -> {:error, :not_found}
      end
    end
  end

  def version_diff(%Scope{} = scope, bot_id, from, to) do
    with {:ok, a} <- get_version(scope, bot_id, from),
         {:ok, b} <- get_version(scope, bot_id, to) do
      {:ok, %{from: Snapshot.canonical(a), to: Snapshot.canonical(b)}}
    end
  end

  def conversation_counts(%Scope{} = scope, bot_id) do
    with {:ok, bot} <- get_bot(scope, bot_id), do: {:ok, Conversations.count_by_version(bot.id)}
  end

  ## Creating and editing

  def create_bot(%Scope{} = scope, attrs) do
    attrs = normalize(attrs)
    {version_attrs, bot_attrs} = Map.pop(attrs, "version", %{})
    owner = owner_id(scope)

    with {:ok, bot} <- Bot.validate_new(owner, bot_attrs),
         {:ok, draft} <- BotVersion.new_draft(nil, 1) |> BotVersion.apply_draft(version_attrs) do
      Mnesia.transaction(fn ->
        if Store.name_or_slug_taken?(owner, bot.name, bot.slug, nil),
          do: :mnesia.abort(%{name: ["you already have a bot with that name"]})

        stored = Store.put_bot_tx(bot)
        draft = Store.put_version_tx(%{draft | bot_id: stored.id})
        %{Store.put_bot_tx(%{stored | draft_version_id: draft.id}) | draft_version_id: draft.id}
      end)
      |> attach_result_versions()
    end
  end

  def update_bot(%Scope{} = scope, id, attrs) do
    with {:ok, bot} <- get_bot(scope, id),
         {:ok, updated} <- Bot.validate_update(bot, normalize(attrs)) do
      {:ok, Store.put_bot(updated) |> attach_versions()}
    end
  end

  def update_draft(%Scope{} = scope, bot_id, attrs) do
    with {:ok, bot} <- get_bot(scope, bot_id) do
      Mnesia.transaction(fn ->
        {_bot, draft} = ensure_draft!(bot)

        case BotVersion.apply_draft(draft, normalize(attrs)) do
          {:ok, edited} -> Store.put_version_tx(edited)
          {:error, errors} -> :mnesia.abort(errors)
        end
      end)
    end
  end

  def create_draft(%Scope{} = scope, bot_id) do
    with {:ok, bot} <- get_bot(scope, bot_id) do
      if bot.draft_version_id do
        {:error, :draft_exists}
      else
        Mnesia.transaction(fn ->
          {_bot, draft} = ensure_draft!(bot)
          draft
        end)
      end
    end
  end

  def delete_draft(%Scope{} = scope, bot_id) do
    with {:ok, bot} <- get_bot(scope, bot_id) do
      case bot.draft_version_id do
        nil ->
          {:error, :no_draft}

        draft_id ->
          Mnesia.transaction(fn ->
            Store.delete_version_tx(draft_id)
            Store.put_bot_tx(%{bot | draft_version_id: nil})
            :ok
          end)
      end
    end
  end

  def preflight(%Scope{} = scope, bot_id) do
    with {:ok, bot} <- get_bot(scope, bot_id),
         %BotVersion{} = version <- draft_or_current(bot) || {:error, :no_draft} do
      compiled =
        case Connectix.Bots.Compiler.compile(version) do
          {:ok, spec} -> Connectix.Bots.CompiledSpec.redacted(spec)
          {:error, _} -> nil
        end

      {:ok,
       %{report: Validator.validate(version), compiled: compiled, version_number: version.number}}
    end
  end

  ## Publishing

  def publish_draft(%Scope{} = scope, bot_id, opts \\ []) do
    now = DateTime.utc_now()

    with {:ok, bot} <- get_bot(scope, bot_id) do
      Mnesia.transaction(fn ->
        draft = bot.draft_version_id && Store.get_version(bot.draft_version_id)
        unless draft, do: :mnesia.abort(:no_draft)

        case Validator.validate(draft) do
          %Validator.Report{valid?: true} -> :ok
          report -> :mnesia.abort(report)
        end

        published =
          Store.put_version_tx(%{
            draft
            | status: :published,
              fingerprint: Snapshot.fingerprint(draft),
              published_at: now,
              published_by_user_id: owner_id(scope)
          })

        if Keyword.get(opts, :retire_previous, false) and bot.current_version_id do
          if prev = Store.get_version(bot.current_version_id),
            do: Store.put_version_tx(%{prev | status: :retired, retired_at: now})
        end

        %{
          Store.put_bot_tx(%{bot | current_version_id: published.id, draft_version_id: nil})
          | current_version_id: published.id,
            draft_version_id: nil
        }
      end)
      |> attach_result_versions()
    end
  end

  def retire_version(%Scope{} = scope, bot_id, number) do
    now = DateTime.utc_now()

    with {:ok, bot} <- get_bot(scope, bot_id),
         {:ok, version} <- get_version(scope, bot.id, number) do
      cond do
        version.id == bot.current_version_id -> {:error, :version_is_current}
        version.status != :published -> {:error, :version_not_published}
        true -> {:ok, Store.put_version(%{version | status: :retired, retired_at: now})}
      end
    end
  end

  ## Lifecycle

  def archive_bot(%Scope{} = scope, id) do
    with {:ok, bot} <- get_bot(scope, id),
         do:
           {:ok,
            Store.put_bot(%{bot | status: :archived, archived_at: DateTime.utc_now()})
            |> attach_versions()}
  end

  def unarchive_bot(%Scope{} = scope, id) do
    with {:ok, bot} <- get_bot(scope, id),
         do: {:ok, Store.put_bot(%{bot | status: :active, archived_at: nil}) |> attach_versions()}
  end

  def delete_bot(%Scope{} = scope, id) do
    with {:ok, bot} <- get_bot(scope, id) do
      published? = Enum.any?(Store.list_versions(bot.id), &(&1.status in [:published, :retired]))
      used? = Conversations.exists_for_bot?(bot.id)

      if published? or used? do
        {:error, :has_history}
      else
        Mnesia.transaction(fn ->
          Enum.each(Store.list_versions(bot.id), &Store.delete_version_tx(&1.id))
          Store.delete_bot_tx(bot.id)
          bot
        end)
      end
    end
  end

  ## Pinning

  def resolve_pin(%Scope{} = scope, attrs) do
    attrs = normalize(attrs)

    case {attrs["bot_version_id"], attrs["bot_id"]} do
      {version_id, _} when is_binary(version_id) -> pin_version(scope, version_id)
      {_, bot_id} when is_binary(bot_id) -> pin_bot(get_bot(scope, bot_id))
      _ -> pin_bot(get_bot_by_slug(scope, @default_slug))
    end
  end

  defp pin_bot({:error, :not_found}), do: {:error, :not_found}
  defp pin_bot({:ok, %Bot{status: :archived}}), do: {:error, :bot_archived}
  defp pin_bot({:ok, %Bot{current_version_id: nil}}), do: {:error, :no_published_version}

  defp pin_bot({:ok, %Bot{} = bot}),
    do: {:ok, %{bot_id: bot.id, bot_version_id: bot.current_version_id}}

  defp pin_version(scope, version_id) do
    with %BotVersion{} = v <- Store.get_version(version_id),
         %Bot{} = bot <- Store.get_bot(v.bot_id),
         true <- bot.user_id == owner_id(scope) do
      cond do
        bot.status == :archived -> {:error, :bot_archived}
        v.status != :published -> {:error, :version_not_published}
        true -> {:ok, %{bot_id: v.bot_id, bot_version_id: v.id}}
      end
    else
      _ -> {:error, :not_found}
    end
  end

  @doc "The published version a conversation pins, with its skills."
  def pinned_version(conversation_id) do
    with version_id when is_binary(version_id) <- Conversations.pinned_version_id(conversation_id),
         %BotVersion{} = version <- Store.get_version(version_id) do
      version
    else
      _ -> nil
    end
  end

  ## Defaults

  def ensure_default_bot(%Scope{} = scope) do
    case get_bot_by_slug(scope, @default_slug) do
      {:ok, bot} ->
        {:ok, bot}

      {:error, :not_found} ->
        with {:ok, bot} <- create_bot(scope, default_definition()),
             do: publish_draft(scope, bot.id)
    end
  end

  def default_definition do
    %{
      "name" => "Default assistant",
      "slug" => @default_slug,
      "description" => "A general assistant with memory files and web lookup.",
      "version" => %{
        "behavior" => %{
          "instructions" =>
            "You are a helpful AI assistant with access to persistent files under /Memories and web search capabilities."
        },
        "memory" => %{"files_enabled" => true},
        "limits" => %{"max_runs" => 50},
        "skills" => [
          %{"skill_id" => "memory_files", "skill_version" => "1.0.0", "position" => 0},
          %{"skill_id" => "web_lookup", "skill_version" => "1.0.0", "position" => 1},
          %{"skill_id" => "todo", "skill_version" => "1.0.0", "position" => 2}
        ]
      }
    }
  end

  ## Internals

  # Returns {bot, draft} inside a transaction, creating the draft from the
  # current version when there is none.
  defp ensure_draft!(%Bot{draft_version_id: id} = bot) when is_binary(id),
    do: {bot, Store.get_version(id)}

  defp ensure_draft!(%Bot{} = bot) do
    number = (Store.list_versions(bot.id) |> Enum.map(& &1.number) |> Enum.max(fn -> 0 end)) + 1
    base = if bot.current_version_id, do: Store.get_version(bot.current_version_id), else: nil

    draft =
      BotVersion.new_draft(bot.id, number)
      |> copy_from(base)
      |> Store.put_version_tx()

    bot = Store.put_bot_tx(%{bot | draft_version_id: draft.id})
    {bot, draft}
  end

  defp copy_from(draft, nil), do: draft

  defp copy_from(draft, %BotVersion{} = base) do
    areas = Map.take(base, BotVersion.areas())
    %{struct(draft, areas) | skills: base.skills}
  end

  defp draft_or_current(%Bot{draft_version_id: id}) when is_binary(id), do: Store.get_version(id)

  defp draft_or_current(%Bot{current_version_id: id}) when is_binary(id),
    do: Store.get_version(id)

  defp draft_or_current(_bot), do: nil

  defp attach_result_versions({:ok, %Bot{} = bot}), do: {:ok, attach_versions(bot)}
  defp attach_result_versions(result), do: result

  defp attach_versions(%Bot{} = bot) do
    %{
      bot
      | current_version: load_version(bot.current_version_id),
        draft_version: load_version(bot.draft_version_id)
    }
  end

  defp load_version(id) when is_binary(id), do: Store.get_version(id)
  defp load_version(_id), do: nil

  defp normalize(attrs) when is_map(attrs),
    do: Map.new(attrs, fn {k, v} -> {to_string(k), v} end)

  defp owner_id(%Scope{user: user}), do: user.id
end
