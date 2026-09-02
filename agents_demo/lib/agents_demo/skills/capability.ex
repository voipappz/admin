defmodule AgentsDemo.Skills.Capability do
  @moduledoc """
  One code-owned operation the model may call, with its policy attached.

  A capability names the module that implements it
  (`AgentsDemo.Capabilities.Capability`) and declares what a control needs to
  know without reading code: its risk, whether a human must approve it,
  whether it is idempotent, how long it may run, and which result keys are
  sensitive. `to_function/2` turns it into the `LangChain.Function` the agent
  sees, wrapping the call so that:

  - arguments are cast and validated by the capability's schema before the
    module runs (`parse_args`), so a malformed call is rejected to the model
    without side effects;
  - the call always receives the scope, conversation and agent it runs for,
    taken from the agent's context, never from the model;
  - a raised error becomes a bounded, redacted tool error rather than a crash.
  """

  alias AgentsDemo.Capabilities.Capability, as: Impl
  alias LangChain.Function

  @enforce_keys [:id, :module, :description]
  defstruct id: nil,
            module: nil,
            description: nil,
            risk: :read,
            approval: :none,
            idempotent: true,
            timeout_ms: 30_000,
            redact: []

  @type risk :: :read | :write | :external | :destructive | :financial
  @type t :: %__MODULE__{
          id: String.t(),
          module: module(),
          description: String.t(),
          risk: risk(),
          approval: :none | :human,
          idempotent: boolean(),
          timeout_ms: pos_integer(),
          redact: [String.t()]
        }

  @doc "The `LangChain.Function` for a capability, bound to nothing but its policy."
  @spec to_function(t()) :: Function.t()
  def to_function(%__MODULE__{} = capability) do
    schema = capability.module.args_schema()

    Function.new!(%{
      name: capability.id,
      description: capability.description,
      parameters_schema: schema.json_schema(),
      parse_args: &parse_args(schema, &1),
      function: fn args, context -> invoke(capability, args, context) end
    })
  end

  defp parse_args(schema, args) when is_map(args) do
    case schema.cast(args) do
      {:ok, typed} ->
        {:ok, typed}

      {:error, %{} = errors} ->
        {:error, "invalid arguments: " <> errors(errors)}
    end
  end

  defp parse_args(_schema, _args), do: {:error, "arguments must be an object"}

  defp invoke(%__MODULE__{} = capability, args, context) do
    call_context = %Impl.Context{
      scope: Map.get(context, :scope),
      conversation_id: Map.get(context, :conversation_id),
      agent_id: Map.get(context, :agent_id),
      capability: capability
    }

    if is_nil(call_context.scope) do
      {:error, "#{capability.id}: no scope; refusing to run"}
    else
      task =
        Task.async(fn ->
          try do
            capability.module.call(args, call_context)
          rescue
            exception -> {:__raised__, exception}
          catch
            kind, value -> {:__raised__, {kind, value}}
          end
        end)

      case Task.yield(task, capability.timeout_ms) || Task.shutdown(task, :brutal_kill) do
        {:ok, {:__raised__, reason}} -> {:error, "#{capability.id}: failed (#{redact(reason)})"}
        {:ok, result} -> result
        nil -> {:error, "#{capability.id}: timed out after #{capability.timeout_ms}ms"}
        {:exit, _reason} -> {:error, "#{capability.id}: failed (internal error)"}
      end
    end
  end

  # Errors reach the model as text; a message or a struct dump could carry a
  # token or a customer record, so only the exception's name does.
  defp redact(%{__exception__: true} = exception),
    do: exception.__struct__ |> Module.split() |> List.last()

  defp redact(_reason), do: "internal error"

  defp errors(errors) do
    Enum.map_join(errors, "; ", fn {field, msgs} -> "#{field} #{Enum.join(msgs, ", ")}" end)
  end
end
