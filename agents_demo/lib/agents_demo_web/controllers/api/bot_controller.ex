defmodule ConnectixWeb.Api.BotController do
  @moduledoc """
  Bots over HTTP: identity, drafts, publication, versions.

  The API calls the same `Connectix.Bots` functions the UI does, so it has
  exactly the same validation, authorization and versioning semantics.
  Creating a bot creates its first draft; `PATCH` edits the draft (creating
  one from the current version if needed); publishing is an explicit action
  that freezes the draft and points new conversations at it. A published
  version is never modified in place.
  """

  use ConnectixWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias Connectix.Bots
  alias Connectix.Bots.Bot
  alias Connectix.Bots.BotVersion
  alias Connectix.Bots.Snapshot
  alias Connectix.Bots.Validator
  alias ConnectixWeb.Api.Schemas

  action_fallback ConnectixWeb.Api.FallbackController

  tags(["bots"])

  @id_param [id: [in: :path, type: :string, description: "Bot id", required: true]]

  operation(:index,
    summary: "List your bots",
    description: "Each bot with its current published version and draft, if any.",
    responses: [
      ok: {"The bots", "application/json", Schemas.BotsResponse},
      unauthorized: {"Missing or invalid bearer token", "application/json", Schemas.Error}
    ]
  )

  def index(conn, _params) do
    bots = conn.assigns.current_scope |> Bots.list_bots() |> Enum.map(&render_bot/1)
    json(conn, %{data: bots})
  end

  operation(:show,
    summary: "Fetch one bot",
    parameters: @id_param,
    responses: [
      ok: {"The bot", "application/json", Schemas.BotResponse},
      not_found: {"No such bot", "application/json", Schemas.Error}
    ]
  )

  def show(conn, %{"id" => id}) do
    with {:ok, bot} <- Bots.get_bot(conn.assigns.current_scope, id) do
      json(conn, %{data: render_bot(bot)})
    end
  end

  operation(:create,
    summary: "Create a bot and its first draft",
    request_body: {"The bot", "application/json", Schemas.CreateBotRequest, required: true},
    responses: [
      created: {"The bot with draft v1", "application/json", Schemas.BotResponse},
      unprocessable_entity: {"Invalid attributes", "application/json", Schemas.Error}
    ]
  )

  def create(conn, params) do
    with {:ok, bot} <- Bots.create_bot(conn.assigns.current_scope, params) do
      conn
      |> put_status(:created)
      |> json(%{data: render_bot(bot)})
    end
  end

  operation(:update,
    summary: "Edit a bot's identity and its draft",
    description: """
    `name` and `description` change the bot itself. `version` edits the draft,
    creating one from the current published version when there is none. The
    published version is never touched: run `publish` to make the draft live.
    """,
    parameters: @id_param,
    request_body: {"The changes", "application/json", Schemas.UpdateBotRequest, required: true},
    responses: [
      ok: {"The bot", "application/json", Schemas.BotResponse},
      not_found: {"No such bot", "application/json", Schemas.Error},
      unprocessable_entity: {"Invalid attributes", "application/json", Schemas.Error}
    ]
  )

  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.current_scope
    identity = Map.take(params, ["name", "description"])

    with {:ok, _bot} <- maybe_update_identity(scope, id, identity),
         {:ok, _draft} <- maybe_update_draft(scope, id, params["version"]),
         {:ok, bot} <- Bots.get_bot(scope, id) do
      json(conn, %{data: render_bot(bot)})
    end
  end

  operation(:delete,
    summary: "Delete a bot that has no history",
    description:
      "Only a bot with no published version and no conversation can be deleted; archive the rest.",
    parameters: @id_param,
    responses: [
      no_content: {"Deleted", "application/json", Schemas.Error},
      conflict:
        {"The bot has published versions or conversations", "application/json", Schemas.Error},
      not_found: {"No such bot", "application/json", Schemas.Error}
    ]
  )

  def delete(conn, %{"id" => id}) do
    with {:ok, _bot} <- Bots.delete_bot(conn.assigns.current_scope, id) do
      send_resp(conn, :no_content, "")
    end
  end

  operation(:publish,
    summary: "Publish the draft",
    description: """
    Validates the draft, freezes it with a fingerprint, and makes it the
    version new conversations pin — atomically. Existing conversations keep
    the version they started with. Fails with the validation report when the
    draft is not fit to publish.
    """,
    parameters: @id_param,
    request_body: {"Options", "application/json", Schemas.PublishRequest, required: false},
    responses: [
      ok: {"The bot with its new current version", "application/json", Schemas.BotResponse},
      unprocessable_entity:
        {"No draft, or the draft failed validation", "application/json", Schemas.ValidationError},
      not_found: {"No such bot", "application/json", Schemas.Error}
    ]
  )

  def publish(conn, %{"id" => id} = params) do
    opts = [retire_previous: params["retire_previous"] == true]

    with {:ok, bot} <- Bots.publish_draft(conn.assigns.current_scope, id, opts) do
      json(conn, %{data: render_bot(bot)})
    end
  end

  operation(:preflight,
    summary: "Validate and compile the draft without publishing",
    description: """
    Returns the validation report publishing would act on, plus the compiled
    configuration — the exact prompt, model reference, capabilities and policy
    the model would run with — redacted of anything secret or executable.
    """,
    parameters: @id_param,
    responses: [
      ok: {"Report and compiled configuration", "application/json", Schemas.PreflightResponse},
      not_found: {"No such bot", "application/json", Schemas.Error}
    ]
  )

  def preflight(conn, %{"id" => id}) do
    with {:ok, %{report: report, compiled: compiled, version_number: number}} <-
           Bots.preflight(conn.assigns.current_scope, id) do
      json(conn, %{
        data: %{version_number: number, report: render_report(report), compiled: compiled}
      })
    end
  end

  operation(:create_draft,
    summary: "Start a new draft as a copy of the current version",
    parameters: @id_param,
    responses: [
      created: {"The draft", "application/json", Schemas.BotVersionResponse},
      unprocessable_entity: {"A draft already exists", "application/json", Schemas.Error},
      not_found: {"No such bot", "application/json", Schemas.Error}
    ]
  )

  def create_draft(conn, %{"id" => id}) do
    with {:ok, draft} <- Bots.create_draft(conn.assigns.current_scope, id) do
      conn
      |> put_status(:created)
      |> json(%{data: render_version(draft)})
    end
  end

  operation(:delete_draft,
    summary: "Discard the draft",
    parameters: @id_param,
    responses: [
      no_content: {"Discarded", "application/json", Schemas.Error},
      unprocessable_entity: {"No draft", "application/json", Schemas.Error},
      not_found: {"No such bot", "application/json", Schemas.Error}
    ]
  )

  def delete_draft(conn, %{"id" => id}) do
    with {:ok, :ok} <- Bots.delete_draft(conn.assigns.current_scope, id) do
      send_resp(conn, :no_content, "")
    end
  end

  operation(:archive,
    summary: "Archive a bot",
    description: "No new conversations; existing ones keep running on their pinned versions.",
    parameters: @id_param,
    responses: [
      ok: {"The bot", "application/json", Schemas.BotResponse},
      not_found: {"No such bot", "application/json", Schemas.Error}
    ]
  )

  def archive(conn, %{"id" => id}) do
    with {:ok, bot} <- Bots.archive_bot(conn.assigns.current_scope, id) do
      json(conn, %{data: render_bot(bot)})
    end
  end

  operation(:unarchive,
    summary: "Reopen an archived bot",
    parameters: @id_param,
    responses: [
      ok: {"The bot", "application/json", Schemas.BotResponse},
      not_found: {"No such bot", "application/json", Schemas.Error}
    ]
  )

  def unarchive(conn, %{"id" => id}) do
    with {:ok, bot} <- Bots.unarchive_bot(conn.assigns.current_scope, id) do
      json(conn, %{data: render_bot(bot)})
    end
  end

  operation(:index_versions,
    summary: "List a bot's versions, newest first",
    parameters: @id_param,
    responses: [
      ok: {"The versions", "application/json", Schemas.BotVersionsResponse},
      not_found: {"No such bot", "application/json", Schemas.Error}
    ]
  )

  def index_versions(conn, %{"id" => id}) do
    scope = conn.assigns.current_scope

    with {:ok, versions} <- Bots.list_versions(scope, id),
         {:ok, counts} <- Bots.conversation_counts(scope, id) do
      data = Enum.map(versions, &render_version(&1, conversations: Map.get(counts, &1.id, 0)))
      json(conn, %{data: data})
    end
  end

  operation(:show_version,
    summary: "Fetch one version in full",
    parameters:
      @id_param ++
        [number: [in: :path, type: :integer, description: "Version number", required: true]],
    responses: [
      ok: {"The version", "application/json", Schemas.BotVersionResponse},
      not_found: {"No such bot or version", "application/json", Schemas.Error}
    ]
  )

  def show_version(conn, %{"id" => id, "number" => number}) do
    with {:ok, number} <- parse_number(number),
         {:ok, version} <- Bots.get_version(conn.assigns.current_scope, id, number) do
      json(conn, %{data: render_version(version)})
    end
  end

  operation(:retire_version,
    summary: "Retire a superseded published version",
    description: "It stays for the conversations that pinned it but can no longer be pinned.",
    parameters:
      @id_param ++
        [number: [in: :path, type: :integer, description: "Version number", required: true]],
    responses: [
      ok: {"The version", "application/json", Schemas.BotVersionResponse},
      unprocessable_entity:
        {"The version is current or not published", "application/json", Schemas.Error},
      not_found: {"No such bot or version", "application/json", Schemas.Error}
    ]
  )

  def retire_version(conn, %{"id" => id, "number" => number}) do
    with {:ok, number} <- parse_number(number),
         {:ok, version} <- Bots.retire_version(conn.assigns.current_scope, id, number) do
      json(conn, %{data: render_version(version)})
    end
  end

  defp maybe_update_identity(_scope, _id, identity) when map_size(identity) == 0, do: {:ok, nil}
  defp maybe_update_identity(scope, id, identity), do: Bots.update_bot(scope, id, identity)

  defp maybe_update_draft(_scope, _id, nil), do: {:ok, nil}
  defp maybe_update_draft(scope, id, version), do: Bots.update_draft(scope, id, version)

  defp parse_number(number) do
    case Integer.parse(to_string(number)) do
      {n, ""} when n > 0 -> {:ok, n}
      _not_a_positive_integer -> {:error, :not_found}
    end
  end

  ## Rendering — shared with nothing else on purpose: the API's shape is a
  ## contract, and `Schemas` documents exactly this.

  def render_bot(%Bot{} = bot) do
    %{
      id: bot.id,
      name: bot.name,
      slug: bot.slug,
      description: bot.description,
      status: bot.status,
      current_version: summary(bot.current_version),
      draft_version: summary(bot.draft_version),
      inserted_at: bot.inserted_at,
      updated_at: bot.updated_at
    }
  end

  def render_version(%BotVersion{} = version, opts \\ []) do
    %{"areas" => areas, "skills" => skills} = Snapshot.canonical(version)

    summary(version)
    |> Map.merge(areas)
    |> Map.put(:skills, skills)
    |> Map.put(:change_note, version.change_note)
    |> Map.put(:retired_at, version.retired_at)
    |> Map.put(:conversations, Keyword.get(opts, :conversations))
  end

  defp summary(nil), do: nil

  defp summary(%BotVersion{} = version) do
    %{
      id: version.id,
      number: version.number,
      status: version.status,
      fingerprint: version.fingerprint,
      published_at: version.published_at,
      inserted_at: version.inserted_at,
      updated_at: version.updated_at
    }
  end

  def render_report(%Validator.Report{} = report) do
    %{valid: report.valid?, errors: report.errors, warnings: report.warnings}
  end
end
