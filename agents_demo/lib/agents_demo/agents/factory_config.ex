defmodule AgentsDemo.Agents.FactoryConfig do
  @moduledoc """
  Typed configuration consumed by `AgentsDemo.Agents.Factory.create_agent/2`.

  Two kinds of input meet here and are kept apart on purpose:

  - **the compiled bot version** (`spec`), resolved by
    `AgentsDemo.Agents.FactoryRouter` from the conversation's pin — this
    decides what the agent *is*: prompt, model, tools, policy, limits;
  - **request options** (`timezone`, `tool_context`) — per-request
    presentation that may *narrow* behaviour but can never add a tool, lift
    a limit or weaken a control. The cast list below is the whole surface a
    caller can influence; anything else in `request_opts` is dropped.

  `from_inputs/1` performs no lookups. Loading is the router's job.
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias AgentsDemo.Bots.CompiledSpec

  @primary_key false
  embedded_schema do
    # IANA timezone for InjectCurrentTime. "UTC" when the caller has none.
    field :timezone, :string, default: "UTC"

    # Caller-supplied, non-authoritative context exposed to tools through
    # LLMChain.custom_context. Identity never travels here.
    field :tool_context, :map, default: %{}

    field :scope, :any, virtual: true
    field :conversation_id, :any, virtual: true
    field :conversation, :any, virtual: true
    field :spec, :any, virtual: true
  end

  @cast_fields ~w(timezone tool_context)a

  @doc "Start a build from request inputs. Returns a changeset to extend and `build/1`."
  def from_inputs(%{} = inputs) do
    attrs = %{
      timezone: Map.get(inputs, :timezone),
      tool_context: Map.get(inputs, :tool_context, %{})
    }

    %__MODULE__{}
    |> cast(attrs, @cast_fields)
    |> put_change(:scope, Map.get(inputs, :scope))
    |> put_change(:conversation_id, Map.get(inputs, :conversation_id))
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
  def with_conversation(%Ecto.Changeset{} = cs, conversation),
    do: put_change(cs, :conversation, conversation)

  @doc "Attach the compiled version the conversation pins."
  def with_spec(%Ecto.Changeset{} = cs, %CompiledSpec{} = spec), do: put_change(cs, :spec, spec)

  @doc "Finalize: requires scope, conversation id and a compiled spec."
  def build(%Ecto.Changeset{} = cs) do
    cs
    |> validate_required([:scope, :conversation_id])
    |> validate_change(:tool_context, fn :tool_context, ctx ->
      if is_map(ctx), do: [], else: [tool_context: "must be a map"]
    end)
    |> validate_spec()
    |> apply_action(:build)
  end

  defp validate_spec(cs) do
    case get_field(cs, :spec) do
      %CompiledSpec{} -> cs
      _missing -> add_error(cs, :spec, "conversation has no compiled bot version")
    end
  end
end
