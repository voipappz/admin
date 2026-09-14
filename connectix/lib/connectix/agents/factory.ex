defmodule Connectix.Agents.Factory do
  @behaviour Sagents.Factory

  @moduledoc """
  Builds a `%Sagents.Agent{}` from a compiled bot version.

  Everything the agent *is* comes from `config.spec`, a
  `Connectix.Bots.CompiledSpec` produced from the version the conversation
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

  alias Connectix.Agents.DemoSetup
  alias Connectix.Agents.FactoryConfig
  alias Connectix.Bots.CompiledSpec
  alias Connectix.Config
  alias Connectix.Middleware.InjectCurrentTime
  alias Connectix.Skills.Capability
  alias Connectix.Skills.Context
  alias Connectix.Skills.Skill
  alias LangChain.ChatModels.{ChatAnthropic, ChatGoogleAI, ChatGrok, ChatOpenAI}
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
  # environment at build time and never touches bot data. The provider is the
  # model name's (`Config.model_provider/1`), so the same spec runs on
  # Anthropic, Google, OpenAI or OpenRouter by changing one variable. Extended thinking
  # and prompt caching are Anthropic features and are set only there.
  defp build_model(%CompiledSpec{model: model}) do
    name = model.name || Config.main_model()

    common =
      %{model: name, stream: true}
      |> maybe_put(:temperature, model.temperature)
      |> maybe_put(:max_tokens, model.max_output_tokens)

    case Config.model_provider(name) do
      :anthropic ->
        ChatAnthropic.new!(
          Map.merge(common, %{
            api_key: Config.anthropic_api_key!(),
            cache_control: %{"type" => "ephemeral"},
            thinking: %{
              type: "enabled",
              budget_tokens: model.thinking_budget_tokens || Config.thinking_budget_tokens()
            }
          })
        )

      :google ->
        ChatGoogleAI.new!(Map.put(common, :api_key, Config.google_api_key!()))

      :xai ->
        ChatGrok.new!(Map.put(common, :api_key, Config.xai_api_key!()))

      :openai ->
        ChatOpenAI.new!(Map.put(common, :api_key, Config.openai_api_key!()))

      :openrouter ->
        ChatOpenAI.new!(openrouter(common))
    end
  end

  # OpenRouter speaks OpenAI's chat API at its own address, so it is the
  # OpenAI model pointed elsewhere, with its own key.
  defp openrouter(common) do
    Map.merge(common, %{api_key: Config.openrouter_api_key!(), endpoint: Config.openrouter_endpoint()})
  end

  defp title_model do
    name = Config.title_model()
    common = %{model: name, temperature: 1, stream: false}

    case Config.model_provider(name) do
      :anthropic -> ChatAnthropic.new!(Map.put(common, :api_key, Config.anthropic_api_key!()))
      :google -> ChatGoogleAI.new!(Map.put(common, :api_key, Config.google_api_key!()))
      :xai -> ChatGrok.new!(Map.put(common, :api_key, Config.xai_api_key!()))
      :openai -> ChatOpenAI.new!(Map.put(common, :api_key, Config.openai_api_key!()))
      :openrouter -> ChatOpenAI.new!(openrouter(common))
    end
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
           Connectix.Middleware.WebToolMiddleware,
           Connectix.Middleware.InjectCurrentTime,
           Connectix.Middleware.UserContextMiddleware,
           Sagents.Middleware.Summarization,
           Sagents.Middleware.ConversationTitle,
           Sagents.Middleware.AskUserQuestion
         ]
       ]},
      {Connectix.Middleware.UserContextMiddleware, [scope: c.scope]},
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
