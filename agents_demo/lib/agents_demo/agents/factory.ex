defmodule AgentsDemo.Agents.Factory do
  @behaviour Sagents.Factory

  @moduledoc """
  Builds a `%Sagents.Agent{}` from a compiled bot version.

  Everything the agent *is* comes from `config.spec`, a
  `AgentsDemo.Bots.CompiledSpec` produced from the version the conversation
  pins: the prompt is the spec's prompt, the model is the spec's model, the
  tools are the spec's capabilities, the middleware is the platform stack plus
  whatever the selected Skills add, and approval and limits are the spec's
  policy. This module makes no database queries and reads no bot data —
  the router and compiler did that — so the same spec always yields the same
  agent.

  The platform stack (conversation title, summarisation, user context,
  current time, ask-user-question, tool-call patching, sub-agent support) is
  not selectable: it is how every agent runs. `HumanInTheLoop` is last
  because Sagents requires it to be; `Haltable` lets a capability end a run.
  """

  alias AgentsDemo.Agents.DemoSetup
  alias AgentsDemo.Agents.FactoryConfig
  alias AgentsDemo.Bots.CompiledSpec
  alias AgentsDemo.Config
  alias AgentsDemo.Middleware.InjectCurrentTime
  alias AgentsDemo.Skills.Capability
  alias AgentsDemo.Skills.Context
  alias AgentsDemo.Skills.Skill
  alias LangChain.ChatModels.ChatAnthropic
  alias Sagents.Agent
  alias Sagents.Middleware.ConversationTitle
  alias Sagents.Middleware.HumanInTheLoop

  require Logger

  @impl Sagents.Factory
  def create_agent(agent_id, %FactoryConfig{spec: %CompiledSpec{} = spec} = c) do
    model = build_model(spec)

    context = %Context{
      scope: c.scope,
      agent_id: agent_id,
      model: model,
      filesystem_scope: filesystem_scope(c, spec),
      timezone: c.timezone
    }

    Agent.new(
      %{
        agent_id: agent_id,
        scope: c.scope,
        model: model,
        base_system_prompt: spec.prompt,
        middleware: build_middleware(c, spec, context),
        name: "Bot #{spec.bot_id}",
        tools: Enum.map(spec.capabilities, &Capability.to_function/1),
        tool_context: c.tool_context,
        max_runs: spec.limits.max_runs,
        async_tool_timeout: spec.limits.tool_timeout_ms
      },
      replace_default_middleware: true
    )
    |> case do
      {:ok, agent} -> {:ok, agent, []}
      {:error, _reason} = err -> err
    end
  end

  # ---------------------------------------------------------------------------
  # Model
  # ---------------------------------------------------------------------------

  # Only a provider reference lives in the spec; the key comes from the
  # environment at build time and never touches bot data.
  defp build_model(%CompiledSpec{model: model}) do
    ChatAnthropic.new!(
      %{
        model: model.name || Config.main_model(),
        api_key: Config.anthropic_api_key!(),
        stream: true,
        cache_control: %{"type" => "ephemeral"},
        thinking: %{
          type: "enabled",
          budget_tokens: model.thinking_budget_tokens || Config.thinking_budget_tokens()
        }
      }
      |> maybe_put(:temperature, model.temperature)
      |> maybe_put(:max_tokens, model.max_output_tokens)
    )
  end

  defp title_model do
    ChatAnthropic.new!(%{
      model: Config.title_model(),
      api_key: Config.anthropic_api_key!(),
      temperature: 1,
      stream: false
    })
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  # ---------------------------------------------------------------------------
  # Filesystem — only when a Skill needs it
  # ---------------------------------------------------------------------------

  defp filesystem_scope(%FactoryConfig{scope: %{user: %{id: user_id}}}, %CompiledSpec{} = spec)
       when not is_nil(user_id) do
    if Enum.any?(spec.skills, &(&1.id == "memory_files")) do
      case DemoSetup.ensure_user_filesystem(user_id) do
        {:ok, scope_key} ->
          scope_key

        {:error, reason} ->
          Logger.warning(
            "Factory could not ensure user filesystem (user_id=#{user_id}): #{inspect(reason)}. " <>
              "Falling back to agent-scoped filesystem."
          )

          nil
      end
    end
  end

  defp filesystem_scope(_config, _spec), do: nil

  # ---------------------------------------------------------------------------
  # Middleware
  # ---------------------------------------------------------------------------

  defp build_middleware(%FactoryConfig{} = c, %CompiledSpec{} = spec, %Context{} = context) do
    from_skills = Enum.flat_map(spec.skills, &Skill.middleware(&1.module, &1.settings, context))

    platform_head = [
      {ConversationTitle, [chat_model: title_model(), fallbacks: []]},
      {Sagents.Middleware.SubAgent,
       [
         block_middleware: [
           AgentsDemo.Middleware.WebToolMiddleware,
           AgentsDemo.Middleware.InjectCurrentTime,
           AgentsDemo.Middleware.UserContextMiddleware,
           Sagents.Middleware.Summarization,
           Sagents.Middleware.ConversationTitle,
           Sagents.Middleware.AskUserQuestion
         ]
       ]},
      {AgentsDemo.Middleware.UserContextMiddleware, [scope: c.scope]},
      {InjectCurrentTime, [timezone: c.timezone]}
    ]

    platform_tail = [
      Sagents.Middleware.Summarization,
      Sagents.Middleware.PatchToolCalls,
      Sagents.Middleware.AskUserQuestion,
      Sagents.Middleware.Haltable
    ]

    # HumanInTheLoop MUST be last: during resume it executes every tool call
    # from the interrupted message and hands later interrupts to middleware
    # after it only.
    (from_skills ++ platform_head ++ platform_tail)
    |> HumanInTheLoop.maybe_append(spec.interrupt_on)
  end
end
