defmodule AgentsDemo.Skills.Skill do
  @moduledoc """
  A Skill: a curated, reusable behaviour bundle a bot version can select.

  A Skill is code. It declares a stable id and a semantic version, a settings
  schema (a struct module whose `new/1` validates what a bot may store for
  it), the capabilities it exposes to the model, the instructions
  it contributes to the prompt, and the Sagents middleware it needs at run
  time. A bot version stores only `{id, version, settings}`; the registry in
  `AgentsDemo.Skills` maps the id to the module.

  `middleware/2` receives a `AgentsDemo.Skills.Context` because middleware
  needs run-time facts the compiler must not know — the agent id, the built
  model, the owner's filesystem — while everything else here is pure.
  """

  alias AgentsDemo.Skills.Capability
  alias AgentsDemo.Skills.Context

  @callback id() :: String.t()
  @callback version() :: String.t()
  @callback name() :: String.t()
  @callback description() :: String.t()
  @callback settings_schema() :: module() | nil
  @callback capabilities(settings :: struct() | map()) :: [Capability.t()]
  @callback instructions(settings :: struct() | map()) :: String.t() | nil
  @callback middleware(settings :: struct() | map(), Context.t()) :: [
              module() | {module(), keyword()}
            ]
  @callback evaluation_cases() :: [map()]

  @optional_callbacks capabilities: 1, instructions: 1, middleware: 2, evaluation_cases: 0

  @doc "Capabilities a Skill exposes, `[]` when it declares none."
  def capabilities(module, settings) do
    if function_exported?(module, :capabilities, 1), do: module.capabilities(settings), else: []
  end

  @doc "The Skill's prompt contribution, `nil` when it has none."
  def instructions(module, settings) do
    if function_exported?(module, :instructions, 1), do: module.instructions(settings), else: nil
  end

  @doc "Middleware the Skill adds at run time, `[]` when none."
  def middleware(module, settings, %Context{} = context) do
    if function_exported?(module, :middleware, 2),
      do: module.middleware(settings, context),
      else: []
  end

  @doc "Scripted conversations that prove the Skill, `[]` when none."
  def evaluation_cases(module) do
    if function_exported?(module, :evaluation_cases, 0), do: module.evaluation_cases(), else: []
  end
end
