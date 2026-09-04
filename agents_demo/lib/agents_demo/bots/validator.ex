defmodule Connectix.Bots.Validator do
  @moduledoc """
  Whether a version is fit to publish.

  Produces one report — `valid?`, `errors`, `warnings`, each issue with a
  stable `code`, a `path` into the version and a message — and every caller
  reads that same report: publishing, the API's preflight endpoint, and
  later the Studio. Rules cannot drift by client because there is one set.

  Field-level validity comes from the changesets; this module adds the rules
  that span areas ("handoff is enabled but no handoff Skill is selected").
  """

  alias Connectix.Bots.BotVersion

  defmodule Report do
    @moduledoc "The outcome of validating a version."
    defstruct valid?: true, errors: [], warnings: []

    @type issue :: %{code: atom(), path: String.t(), message: String.t()}
    @type t :: %__MODULE__{valid?: boolean(), errors: [issue()], warnings: [issue()]}
  end

  @spec validate(BotVersion.t()) :: Report.t()
  def validate(%BotVersion{} = version) do
    issues =
      []
      |> changeset_errors(version)
      |> instructions_present(version)
      |> handoff_consistent(version)
      |> compiles(version)

    errors = for {:error, issue} <- issues, do: issue
    warnings = for {:warning, issue} <- issues, do: issue

    %Report{valid?: errors == [], errors: Enum.reverse(errors), warnings: Enum.reverse(warnings)}
  end

  # Re-validate the version by re-applying its own areas through the same
  # `apply_draft/2` used on edit, so a version that would fail to save also
  # fails to publish. The error shape is `%{area => %{field => [msg]}}`.
  defp changeset_errors(issues, version) do
    attrs =
      version
      |> Map.take(BotVersion.areas())
      |> Map.new(fn {area, struct} -> {Atom.to_string(area), Map.from_struct(struct)} end)

    case BotVersion.apply_draft(%{version | status: :draft}, attrs) do
      {:ok, _} ->
        issues

      {:error, errors} ->
        errors
        |> flatten_errors("")
        |> Enum.reduce(issues, fn {path, message}, acc ->
          [{:error, issue(:invalid_field, path, message)} | acc]
        end)
    end
  end

  defp instructions_present(issues, %BotVersion{behavior: behavior, skills: skills}) do
    instructions = behavior && behavior.instructions

    cond do
      is_binary(instructions) and String.trim(instructions) != "" ->
        issues

      skills != [] ->
        [
          {:warning,
           issue(
             :no_instructions,
             "behavior.instructions",
             "no instructions; the bot relies on its skills' instructions alone"
           )}
          | issues
        ]

      true ->
        [
          {:error,
           issue(
             :no_instructions,
             "behavior.instructions",
             "instructions or at least one skill are required"
           )}
          | issues
        ]
    end
  end

  defp handoff_consistent(issues, %BotVersion{handoff: %{enabled: true}, skills: skills}) do
    if Enum.any?(skills, &(&1.skill_id == "human_handoff")) do
      issues
    else
      [
        {:error,
         issue(
           :handoff_without_skill,
           "handoff.enabled",
           "handoff is enabled but the human_handoff skill is not selected"
         )}
        | issues
      ]
    end
  end

  defp handoff_consistent(issues, _version), do: issues

  # The compiler is the authority on whether the catalog references resolve
  # and the settings are valid; its report folds into this one.
  defp compiles(issues, version) do
    case Connectix.Bots.Compiler.compile(version) do
      {:ok, _spec} -> issues
      {:error, %Report{errors: errors}} -> Enum.map(errors, &{:error, &1}) ++ issues
    end
  end

  defp flatten_errors(map, prefix) when is_map(map) do
    Enum.flat_map(map, fn {key, value} -> flatten_errors(value, join(prefix, key)) end)
  end

  defp flatten_errors(list, prefix) when is_list(list) do
    if Enum.all?(list, &is_binary/1) do
      Enum.map(list, &{prefix, &1})
    else
      list
      |> Enum.with_index()
      |> Enum.flat_map(fn {value, index} -> flatten_errors(value, "#{prefix}[#{index}]") end)
    end
  end

  defp join("", key), do: to_string(key)
  defp join(prefix, key), do: "#{prefix}.#{key}"

  defp issue(code, path, message), do: %{code: code, path: path, message: message}
end
