defmodule AgentsDemo.Bots.Compiler do
  @moduledoc """
  Turns a `BotVersion` into a `CompiledSpec`: deterministic, side-effect free,
  and the only place bot data meets code.

  Order of work, each step able to fail with a report the author can act on:

  1. resolve every selected Skill through the catalog (`AgentsDemo.Skills`)
     and validate its settings against the Skill's schema;
  2. collect the capabilities those Skills expose — an id offered twice is an
     error, not a silent override;
  3. apply `safety.forbidden_tools`: a forbidden capability is removed before
     the model can see it;
  4. assemble the prompt: the version's instructions first, whole, then each
     Skill's instructions in selection order under a `## Skill:` heading, so
     the compiled prompt preview shows exactly what the model reads;
  5. flatten approval policy into `interrupt_on`: every tool named in
     `safety.interrupt_on` plus every capability declaring `approval: :human`.

  The same version compiles to the same spec every time; `Bots.Runtime`
  relies on that to cache by fingerprint.
  """

  alias AgentsDemo.Bots.BotVersion
  alias AgentsDemo.Bots.CompiledSpec
  alias AgentsDemo.Bots.Validator.Report
  alias AgentsDemo.Skills
  alias AgentsDemo.Skills.Capability
  alias AgentsDemo.Skills.Skill

  @separator "\n\n"

  @spec compile(BotVersion.t()) :: {:ok, CompiledSpec.t()} | {:error, Report.t()}
  def compile(%BotVersion{} = version) do
    with {:ok, skills} <- resolve_skills(version.skills),
         {:ok, capabilities} <- collect_capabilities(skills) do
      forbidden = (version.safety && version.safety.forbidden_tools) || []
      capabilities = Enum.reject(capabilities, &(&1.id in forbidden))
      segments = prompt_segments(version, skills)

      {:ok,
       %CompiledSpec{
         bot_version_id: version.id,
         bot_id: version.bot_id,
         fingerprint: version.fingerprint,
         prompt: Enum.map_join(segments, @separator, & &1.text),
         prompt_segments: segments,
         model: model(version.model),
         skills: skills,
         capabilities: capabilities,
         interrupt_on: interrupt_on(version.safety, capabilities),
         forbidden_tools: forbidden,
         limits: version.limits || struct(AgentsDemo.Bots.Version.Limits),
         availability: version.availability || struct(AgentsDemo.Bots.Version.Availability),
         audiences: version.audiences || struct(AgentsDemo.Bots.Version.Audiences),
         handoff: version.handoff || struct(AgentsDemo.Bots.Version.Handoff),
         memory: version.memory || struct(AgentsDemo.Bots.Version.Memory),
         output: version.output || struct(AgentsDemo.Bots.Version.Output)
       }}
    else
      {:error, issues} when is_list(issues) -> {:error, %Report{valid?: false, errors: issues}}
    end
  end

  defp resolve_skills(skills) do
    skills
    |> Enum.sort_by(&{&1.position, &1.skill_id})
    |> Enum.with_index()
    |> Enum.reduce({[], []}, fn {skill, index}, {resolved, issues} ->
      path = "skills[#{index}]"

      case Skills.validate_settings(skill.skill_id, skill.skill_version, skill.settings || %{}) do
        {:ok, settings} ->
          {:ok, mod} = Skills.fetch(skill.skill_id, skill.skill_version)

          {[
             %{id: skill.skill_id, version: skill.skill_version, module: mod, settings: settings}
             | resolved
           ], issues}

        {:error, {:unknown_skill, id}} ->
          {resolved,
           [issue(:unknown_skill, "#{path}.skill_id", "#{id} is not in the catalog") | issues]}

        {:error, {:incompatible_skill_version, id, current}} ->
          {resolved,
           [
             issue(
               :incompatible_skill_version,
               "#{path}.skill_version",
               "#{id} is at #{current}; select a compatible version"
             )
             | issues
           ]}

        {:error, {:no_settings, id}} ->
          {resolved,
           [
             issue(:invalid_skill_settings, "#{path}.settings", "#{id} takes no settings")
             | issues
           ]}

        {:error, %Ecto.Changeset{} = changeset} ->
          {resolved,
           [
             issue(:invalid_skill_settings, "#{path}.settings", changeset_message(changeset))
             | issues
           ]}
      end
    end)
    |> case do
      {resolved, []} -> {:ok, Enum.reverse(resolved)}
      {_resolved, issues} -> {:error, Enum.reverse(issues)}
    end
  end

  defp collect_capabilities(skills) do
    capabilities =
      Enum.flat_map(skills, fn skill -> Skill.capabilities(skill.module, skill.settings) end)

    duplicates =
      capabilities
      |> Enum.frequencies_by(& &1.id)
      |> Enum.filter(fn {_id, n} -> n > 1 end)
      |> Enum.map(fn {id, _n} -> id end)

    case duplicates do
      [] ->
        {:ok, capabilities}

      ids ->
        {:error,
         Enum.map(
           ids,
           &issue(
             :duplicate_capability,
             "skills",
             "capability #{&1} is offered by more than one skill"
           )
         )}
    end
  end

  defp prompt_segments(version, skills) do
    instructions = (version.behavior && version.behavior.instructions) || ""

    base =
      if String.trim(instructions) == "",
        do: [],
        else: [%{source: "instructions", text: String.trim(instructions)}]

    from_skills =
      for skill <- skills,
          text = Skill.instructions(skill.module, skill.settings),
          is_binary(text) and String.trim(text) != "" do
        %{
          source: "skill:#{skill.id}",
          text: "## Skill: #{skill.module.name()}\n\n" <> String.trim(text)
        }
      end

    base ++ from_skills
  end

  defp model(nil),
    do: %{
      provider: "anthropic",
      name: nil,
      temperature: nil,
      thinking_budget_tokens: nil,
      max_output_tokens: nil
    }

  defp model(model) do
    %{
      provider: model.provider,
      name: model.name,
      temperature: model.temperature,
      thinking_budget_tokens: model.thinking_budget_tokens,
      max_output_tokens: model.max_output_tokens
    }
  end

  defp interrupt_on(safety, capabilities) do
    named = (safety && safety.interrupt_on) || []
    gated = for %Capability{approval: :human, id: id} <- capabilities, do: id

    Map.new(named ++ gated, &{&1, true})
  end

  defp changeset_message(changeset) do
    changeset
    |> Ecto.Changeset.traverse_errors(fn {msg, _opts} -> msg end)
    |> Enum.map_join("; ", fn {field, msgs} -> "#{field} #{Enum.join(msgs, ", ")}" end)
  end

  defp issue(code, path, message), do: %{code: code, path: path, message: message}
end
