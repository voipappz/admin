defmodule AgentsDemo.Agents.FactoryConfig do
  @moduledoc """
  Typed configuration consumed by `AgentsDemo.Agents.Factory.create_agent/2`.

  Two kinds of input meet here and are kept apart on purpose:

  - **the compiled bot version** (`spec`), resolved by
    `AgentsDemo.Agents.FactoryRouter` from the conversation's pin — this
    decides what the agent *is*: prompt, model, tools, policy, limits;
  - **request options** (`timezone`, `tool_context`) — per-request
    presentation that may *narrow* behaviour but can never add a tool, lift
    a limit or weaken a control. `from_inputs/1` reads exactly those two
    keys; anything else in `request_opts` is dropped.

  `from_inputs/1` performs no lookups. Loading is the router's job. A plain
  struct: `build/1` validates it and returns `{:ok, config}` or
  `{:error, %{field => [message]}}`.
  """

  alias AgentsDemo.Bots.CompiledSpec

  defstruct timezone: "UTC",
            tool_context: %{},
            scope: nil,
            conversation_id: nil,
            conversation: nil,
            spec: nil

  @doc "Start a build from request inputs. Returns a struct to extend and `build/1`."
  def from_inputs(%{} = inputs) do
    %__MODULE__{
      # IANA timezone for InjectCurrentTime. "UTC" when the caller has none.
      timezone: Map.get(inputs, :timezone) || "UTC",
      # Caller-supplied, non-authoritative context exposed to tools through
      # LLMChain.custom_context. Identity never travels here.
      tool_context: Map.get(inputs, :tool_context, %{}),
      scope: Map.get(inputs, :scope),
      conversation_id: Map.get(inputs, :conversation_id)
    }
  end

  @doc "Build from a LiveView socket's assigns."
  def from_socket_assigns(assigns) when is_map(assigns) do
    from_inputs(%{
      scope: Map.fetch!(assigns, :current_scope),
      conversation_id: Map.get(assigns, :conversation_id),
      timezone: Map.get(assigns, :timezone),
      tool_context: Map.get(assigns, :tool_context, %{})
    })
  end

  @doc "Attach the loaded conversation."
  def with_conversation(%__MODULE__{} = config, conversation),
    do: %{config | conversation: conversation}

  @doc "Attach the compiled version the conversation pins."
  def with_spec(%__MODULE__{} = config, %CompiledSpec{} = spec), do: %{config | spec: spec}

  @doc "Finalize: requires scope, conversation id and a compiled spec."
  def build(%__MODULE__{} = config) do
    errors =
      %{}
      |> check(:scope, is_nil(config.scope), "can't be blank")
      |> check(:conversation_id, config.conversation_id in [nil, ""], "can't be blank")
      |> check(:tool_context, not is_map(config.tool_context), "must be a map")
      |> check(
        :spec,
        not match?(%CompiledSpec{}, config.spec),
        "conversation has no compiled bot version"
      )

    if map_size(errors) == 0, do: {:ok, config}, else: {:error, errors}
  end

  defp check(errors, _field, false, _msg), do: errors
  defp check(errors, field, true, msg), do: Map.update(errors, field, [msg], &(&1 ++ [msg]))
end
