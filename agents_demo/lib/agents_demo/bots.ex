defmodule AgentsDemo.Bots do
  @moduledoc """
  Bots and their versions: create, edit a draft, publish, pin.

  Every function takes a `AgentsDemo.Accounts.Scope` first and filters on it,
  so one owner's bots are invisible to another. The one exception is
  `pinned_version/1`, which runs inside the agent process on behalf of a
  conversation that was already loaded through a scope.

  ## Lifecycle

      create_bot        -> bot + draft v1
      update_draft      -> edits the draft (creating one from the current
                           version when there is none)
      publish_draft     -> validates, fingerprints, freezes v1, points
                           current_version at it — one transaction
      create_draft      -> copies the current version into draft v2
      publish_draft     -> v2 becomes current; conversations on v1 stay on v1
      retire_version    -> a superseded published version, kept for its
                           conversations, no longer pinnable
      archive_bot       -> no new conversations; nothing existing changes

  Published versions are never patched in place: the changesets refuse, and
  so does a database trigger.
  """

  import Ecto.Query, warn: false

  alias AgentsDemo.Accounts.Scope
  alias AgentsDemo.Bots.Bot
  alias AgentsDemo.Bots.BotVersion
  alias AgentsDemo.Bots.Snapshot
  alias AgentsDemo.Bots.Validator
  alias AgentsDemo.Conversations.Conversation
  alias AgentsDemo.Repo

  @default_slug "default"
  @preloads [:current_version, :draft_version]

  ## Reading

  def list_bots(%Scope{} = scope) do
    Bot
    |> scope_query(scope)
    |> order_by([b], asc: b.name)
    |> preload(^@preloads)
    |> Repo.all()
  end

  def get_bot(%Scope{} = scope, id) do
    Bot
    |> scope_query(scope)
    |> preload(^@preloads)
    |> Repo.get(id)
    |> case do
      nil -> {:error, :not_found}
      bot -> {:ok, bot}
    end
  rescue
    Ecto.Query.CastError -> {:error, :not_found}
  end

  def get_bot_by_slug(%Scope{} = scope, slug) when is_binary(slug) do
    Bot
    |> scope_query(scope)
    |> preload(^@preloads)
    |> Repo.get_by(slug: slug)
    |> case do
      nil -> {:error, :not_found}
      bot -> {:ok, bot}
    end
  end

  def list_versions(%Scope{} = scope, bot_id) do
    with {:ok, bot} <- get_bot(scope, bot_id) do
      versions =
        BotVersion
        |> where([v], v.bot_id == ^bot.id)
        |> order_by([v], desc: v.number)
        |> preload(:skills)
        |> Repo.all()

      {:ok, versions}
    end
  end

  def get_version(%Scope{} = scope, bot_id, number) when is_integer(number) do
    with {:ok, bot} <- get_bot(scope, bot_id) do
      BotVersion
      |> where([v], v.bot_id == ^bot.id and v.number == ^number)
      |> preload(:skills)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        version -> {:ok, version}
      end
    end
  end

  @doc "Canonical content of two versions side by side, for a diff view."
  def version_diff(%Scope{} = scope, bot_id, from, to) do
    with {:ok, a} <- get_version(scope, bot_id, from),
         {:ok, b} <- get_version(scope, bot_id, to) do
      {:ok, %{from: Snapshot.canonical(a), to: Snapshot.canonical(b)}}
    end
  end

  @doc "How many conversations pin each version of a bot."
  def conversation_counts(%Scope{} = scope, bot_id) do
    with {:ok, bot} <- get_bot(scope, bot_id) do
      counts =
        Conversation
        |> where([c], c.bot_id == ^bot.id)
        |> group_by([c], c.bot_version_id)
        |> select([c], {c.bot_version_id, count(c.id)})
        |> Repo.all()
        |> Map.new()

      {:ok, counts}
    end
  end

  ## Creating and editing

  @doc """
  Creates a bot and its first draft in one transaction. `attrs` may carry a
  `"version"` map of configuration areas for the draft.
  """
  def create_bot(%Scope{} = scope, attrs) do
    attrs = normalize(attrs)
    {version_attrs, bot_attrs} = Map.pop(attrs, "version", %{})

    Repo.transaction(fn ->
      with {:ok, bot} <- scope |> owner_id() |> Bot.create_changeset(bot_attrs) |> Repo.insert(),
           {:ok, draft} <- insert_draft(bot, 1, version_attrs),
           {:ok, bot} <- point(bot, draft_version_id: draft.id) do
        %{bot | draft_version: draft, current_version: nil}
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  def update_bot(%Scope{} = scope, id, attrs) do
    with {:ok, bot} <- get_bot(scope, id) do
      bot |> Bot.changeset(normalize(attrs)) |> Repo.update()
    end
  end

  @doc """
  Edits the bot's draft, creating one from the current version first when
  there is none. Only drafts change; the current version is untouched.
  """
  def update_draft(%Scope{} = scope, bot_id, attrs) do
    Repo.transaction(fn ->
      with {:ok, bot} <- lock_bot(scope, bot_id),
           {:ok, draft} <- ensure_draft(bot),
           {:ok, draft} <- draft |> BotVersion.draft_changeset(normalize(attrs)) |> Repo.update() do
        Repo.preload(draft, :skills, force: true)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Starts a new draft as a copy of the current version."
  def create_draft(%Scope{} = scope, bot_id) do
    Repo.transaction(fn ->
      with {:ok, bot} <- lock_bot(scope, bot_id),
           :ok <- no_draft(bot),
           {:ok, draft} <- ensure_draft(bot) do
        draft
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  def delete_draft(%Scope{} = scope, bot_id) do
    Repo.transaction(fn ->
      with {:ok, bot} <- lock_bot(scope, bot_id),
           %BotVersion{} = draft <- bot.draft_version || {:error, :no_draft},
           {:ok, _bot} <- point(bot, draft_version_id: nil),
           {:ok, _draft} <- Repo.delete(draft) do
        :ok
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Validates and compiles the draft (or the current version when there is no
  draft) without publishing: the report `publish_draft/3` would act on, plus
  the compiled, redacted spec — the exact prompt and capability list the
  model would get — so an author can inspect before making it live.
  """
  def preflight(%Scope{} = scope, bot_id) do
    with {:ok, bot} <- get_bot(scope, bot_id),
         %BotVersion{} = version <-
           bot.draft_version || bot.current_version || {:error, :no_draft} do
      version = Repo.preload(version, :skills)

      compiled =
        case AgentsDemo.Bots.Compiler.compile(version) do
          {:ok, spec} -> AgentsDemo.Bots.CompiledSpec.redacted(spec)
          {:error, _report} -> nil
        end

      {:ok,
       %{report: Validator.validate(version), compiled: compiled, version_number: version.number}}
    end
  end

  ## Publishing

  @doc """
  Publishes the draft: validates it, fingerprints it, freezes it, and moves
  `current_version` to it — all in one transaction, so a conversation created
  while this runs pins either the old version or the new one, never a
  half-published state.

  Options: `retire_previous: true` retires the version being replaced; by
  default it stays published so API callers may still pin it explicitly.
  """
  def publish_draft(%Scope{} = scope, bot_id, opts \\ []) do
    now = DateTime.utc_now()

    Repo.transaction(fn ->
      with {:ok, bot} <- lock_bot(scope, bot_id),
           %BotVersion{} = draft <- bot.draft_version || {:error, :no_draft},
           draft = Repo.preload(draft, :skills),
           %Validator.Report{valid?: true} <- Validator.validate(draft),
           {:ok, published} <-
             draft
             |> BotVersion.publish_changeset(owner_id(scope), Snapshot.fingerprint(draft), now)
             |> Repo.update(),
           {:ok, _previous} <- maybe_retire(bot.current_version, opts, now),
           {:ok, bot} <- point(bot, current_version_id: published.id, draft_version_id: nil) do
        %{bot | current_version: published, draft_version: nil}
      else
        %Validator.Report{} = report -> Repo.rollback(report)
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Retires a published version that is no longer current."
  def retire_version(%Scope{} = scope, bot_id, number) do
    now = DateTime.utc_now()

    Repo.transaction(fn ->
      with {:ok, bot} <- lock_bot(scope, bot_id),
           {:ok, version} <- get_version(scope, bot.id, number),
           :ok <- retirable(bot, version) do
        {:ok, retired} = version |> BotVersion.retire_changeset(now) |> Repo.update()
        retired
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  ## Lifecycle

  def archive_bot(%Scope{} = scope, id) do
    with {:ok, bot} <- get_bot(scope, id) do
      bot |> Bot.archive_changeset(DateTime.utc_now()) |> Repo.update()
    end
  end

  def unarchive_bot(%Scope{} = scope, id) do
    with {:ok, bot} <- get_bot(scope, id) do
      bot |> Bot.unarchive_changeset() |> Repo.update()
    end
  end

  @doc """
  Deletes a bot that has no history: no published version and no
  conversation. Anything with history is archived instead, because the
  versions it published are what its conversations are reproducible from.
  """
  def delete_bot(%Scope{} = scope, id) do
    Repo.transaction(fn ->
      with {:ok, bot} <- lock_bot(scope, id),
           :ok <- no_history(bot),
           {:ok, bot} <- point(bot, current_version_id: nil, draft_version_id: nil),
           {:ok, bot} <- Repo.delete(bot) do
        bot
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  ## Pinning

  @doc """
  Decides which bot and version a new conversation pins.

  `%{bot_id: id}` pins the bot's current published version; the bot must be
  active and have one. `%{bot_version_id: id}` pins that exact version; it
  must be published and belong to one of the caller's bots. With neither,
  the caller's default bot answers. Runs inside the conversation-creating
  transaction, so the decision and the insert are atomic.
  """
  def resolve_pin(%Scope{} = scope, attrs) do
    attrs = normalize(attrs)

    case {attrs["bot_version_id"], attrs["bot_id"]} do
      {version_id, _bot_id} when is_binary(version_id) -> pin_version(scope, version_id)
      {_no_version, bot_id} when is_binary(bot_id) -> pin_bot(scope, get_bot(scope, bot_id))
      _neither -> pin_bot(scope, get_bot_by_slug(scope, @default_slug))
    end
  end

  defp pin_bot(_scope, {:error, :not_found}), do: {:error, :not_found}
  defp pin_bot(_scope, {:ok, %Bot{status: :archived}}), do: {:error, :bot_archived}
  defp pin_bot(_scope, {:ok, %Bot{current_version_id: nil}}), do: {:error, :no_published_version}

  defp pin_bot(_scope, {:ok, %Bot{} = bot}),
    do: {:ok, %{bot_id: bot.id, bot_version_id: bot.current_version_id}}

  defp pin_version(scope, version_id) do
    query =
      from v in BotVersion,
        join: b in Bot,
        on: b.id == v.bot_id,
        where: v.id == ^version_id and b.user_id == ^owner_id(scope),
        select: {v, b}

    case Repo.one(query) do
      nil ->
        {:error, :not_found}

      {%BotVersion{status: :published} = v, %Bot{status: :active}} ->
        {:ok, %{bot_id: v.bot_id, bot_version_id: v.id}}

      {_version, %Bot{status: :archived}} ->
        {:error, :bot_archived}

      {%BotVersion{}, _bot} ->
        {:error, :version_not_published}
    end
  rescue
    Ecto.Query.CastError -> {:error, :not_found}
  end

  @doc """
  The published version a conversation pins, with its skills.

  Unscoped by design: this runs inside the agent process for a conversation
  that `AgentsDemo.Agents.FactoryRouter` already loaded through the caller's
  scope, and the join to the conversation is what constrains it.
  """
  def pinned_version(conversation_id) do
    Repo.one(
      from v in BotVersion,
        join: c in Conversation,
        on: c.bot_version_id == v.id,
        where: c.id == ^conversation_id,
        preload: :skills
    )
  end

  ## Defaults

  @doc """
  Every account gets one published bot, so every conversation compiles the
  same way and there is no "no bot" path. Idempotent on the `default` slug.
  """
  def ensure_default_bot(%Scope{} = scope) do
    case get_bot_by_slug(scope, @default_slug) do
      {:ok, bot} ->
        {:ok, bot}

      {:error, :not_found} ->
        with {:ok, bot} <- create_bot(scope, default_definition()) do
          publish_draft(scope, bot.id)
        end
    end
  end

  @doc "The definition of the default assistant: the platform's own behaviour as a bot."
  def default_definition do
    %{
      "name" => "Default assistant",
      "slug" => @default_slug,
      "description" => "A general assistant with memory files and web lookup.",
      "version" => %{
        "behavior" => %{
          "instructions" => """
          You are a helpful AI assistant with access to a persistent memory system and web search capabilities.

          You can read, write, and manage files in the /Memories directory.
          You can search the web for current information using the web_lookup tool.

          Be friendly, helpful, and demonstrate your capabilities when appropriate.
          When users ask about current information, recent events, or facts that may have changed,
          use the web_lookup tool to get accurate, up-to-date information.
          """
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

  defp insert_draft(%Bot{id: bot_id}, number, attrs) do
    bot_id
    |> BotVersion.new_draft(number)
    |> BotVersion.draft_changeset(attrs)
    |> Repo.insert()
  end

  # The draft to edit: the existing one, or a copy of the current version.
  defp ensure_draft(%Bot{draft_version: %BotVersion{} = draft}),
    do: {:ok, Repo.preload(draft, :skills)}

  defp ensure_draft(%Bot{} = bot) do
    number = next_number(bot)

    attrs =
      case bot.current_version do
        %BotVersion{} = current -> current |> Repo.preload(:skills) |> copy_attrs()
        nil -> %{}
      end

    with {:ok, draft} <- insert_draft(bot, number, attrs),
         {:ok, _bot} <- point(bot, draft_version_id: draft.id) do
      {:ok, Repo.preload(draft, :skills)}
    end
  end

  # A version's content as draft attrs: exactly what `draft_changeset/2`
  # casts, taken from the canonical snapshot so copying and fingerprinting
  # agree on what "the content" is.
  defp copy_attrs(%BotVersion{} = version) do
    %{"areas" => areas, "skills" => skills} = Snapshot.canonical(version)
    Map.put(areas, "skills", skills)
  end

  defp next_number(%Bot{id: bot_id}) do
    (Repo.one(from v in BotVersion, where: v.bot_id == ^bot_id, select: max(v.number)) || 0) + 1
  end

  defp maybe_retire(%BotVersion{} = previous, opts, now) do
    if Keyword.get(opts, :retire_previous, false) do
      previous |> BotVersion.retire_changeset(now) |> Repo.update()
    else
      {:ok, previous}
    end
  end

  defp maybe_retire(nil, _opts, _now), do: {:ok, nil}

  defp retirable(%Bot{current_version_id: id}, %BotVersion{id: id}),
    do: {:error, :version_is_current}

  defp retirable(_bot, %BotVersion{status: :published}), do: :ok
  defp retirable(_bot, %BotVersion{}), do: {:error, :version_not_published}

  defp no_draft(%Bot{draft_version_id: nil}), do: :ok
  defp no_draft(%Bot{}), do: {:error, :draft_exists}

  defp no_history(%Bot{id: bot_id}) do
    published? =
      Repo.exists?(
        from v in BotVersion, where: v.bot_id == ^bot_id and v.status in ^[:published, :retired]
      )

    used? = Repo.exists?(from c in Conversation, where: c.bot_id == ^bot_id)

    if published? or used?, do: {:error, :has_history}, else: :ok
  end

  defp point(%Bot{} = bot, changes) do
    bot |> Bot.versions_changeset(Map.new(changes)) |> Repo.update()
  end

  defp lock_bot(%Scope{} = scope, id) do
    Bot
    |> scope_query(scope)
    |> where([b], b.id == ^id)
    |> lock("FOR UPDATE")
    |> preload(^@preloads)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      bot -> {:ok, bot}
    end
  rescue
    Ecto.Query.CastError -> {:error, :not_found}
  end

  # Attrs arrive with atom keys from code and string keys from the API; the
  # changesets take either, but popping "version" out needs one convention.
  defp normalize(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
  end

  defp scope_query(query, %Scope{} = scope) do
    from q in query, where: q.user_id == ^owner_id(scope)
  end

  defp owner_id(%Scope{user: user}), do: user.id
end
