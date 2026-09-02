defmodule AgentsDemo.Bots.CompiledSpec do
  @moduledoc """
  A bot version, resolved: every catalog reference turned into code, every
  setting typed, the prompt assembled, the policy flattened into what the
  runtime enforces. Produced by `AgentsDemo.Bots.Compiler`, consumed by
  `AgentsDemo.Agents.Factory`, shown (redacted) by the API's preflight and
  the Studio's compiled-prompt preview.

  Nothing here is looked up again at run time: the Factory reads this struct
  and the request, and that is all.
  """

  alias AgentsDemo.Bots.Version
  alias AgentsDemo.Skills.Capability

  @enforce_keys [:bot_version_id, :prompt]
  defstruct bot_version_id: nil,
            bot_id: nil,
            fingerprint: nil,
            prompt: "",
            prompt_segments: [],
            model: %{
              provider: "anthropic",
              name: nil,
              temperature: nil,
              thinking_budget_tokens: nil,
              max_output_tokens: nil
            },
            skills: [],
            capabilities: [],
            interrupt_on: %{},
            forbidden_tools: [],
            limits: %Version.Limits{},
            availability: %Version.Availability{},
            audiences: %Version.Audiences{},
            handoff: %Version.Handoff{},
            memory: %Version.Memory{},
            output: %Version.Output{}

  @type skill :: %{
          id: String.t(),
          version: String.t(),
          module: module(),
          settings: struct() | map()
        }

  @type t :: %__MODULE__{
          bot_version_id: String.t(),
          bot_id: String.t() | nil,
          fingerprint: String.t() | nil,
          prompt: String.t(),
          prompt_segments: [%{source: String.t(), text: String.t()}],
          model: map(),
          skills: [skill()],
          capabilities: [Capability.t()],
          interrupt_on: %{optional(String.t()) => true},
          forbidden_tools: [String.t()],
          limits: Version.Limits.t(),
          availability: Version.Availability.t(),
          audiences: Version.Audiences.t(),
          handoff: Version.Handoff.t(),
          memory: Version.Memory.t(),
          output: Version.Output.t()
        }

  @doc """
  The spec as inspectable data with nothing executable and nothing secret:
  modules become ids, settings become plain maps.
  """
  def redacted(%__MODULE__{} = spec) do
    %{
      bot_version_id: spec.bot_version_id,
      fingerprint: spec.fingerprint,
      prompt: spec.prompt,
      prompt_segments: spec.prompt_segments,
      model: spec.model,
      skills:
        Enum.map(spec.skills, &%{id: &1.id, version: &1.version, settings: plain(&1.settings)}),
      capabilities:
        Enum.map(
          spec.capabilities,
          &Map.take(&1, [:id, :description, :risk, :approval, :idempotent, :timeout_ms])
        ),
      interrupt_on: Map.keys(spec.interrupt_on),
      forbidden_tools: spec.forbidden_tools,
      limits: plain(spec.limits),
      availability: plain(spec.availability),
      audiences: plain(spec.audiences),
      handoff: plain(spec.handoff)
    }
  end

  defp plain(%_module{} = struct),
    do: struct |> Map.from_struct() |> Map.delete(:__meta__) |> plain()

  defp plain(map) when is_map(map), do: Map.new(map, fn {k, v} -> {k, plain(v)} end)
  defp plain(list) when is_list(list), do: Enum.map(list, &plain/1)
  defp plain(other), do: other
end
