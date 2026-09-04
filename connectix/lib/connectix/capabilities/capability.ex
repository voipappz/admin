defmodule Connectix.Capabilities.Capability do
  @moduledoc """
  The contract every capability implementation fulfils.

  `args_schema/0` names a module with `json_schema/0` (what the model sees)
  and `cast/1` (what the implementation receives: typed, validated).
  `call/2` receives those arguments and a `Context` carrying the scope the
  call runs for — the implementation must authorise against it; the model
  cannot supply or change it.

  Return `{:ok, result}` with a bounded, JSON-encodable result the model may
  read, `{:error, message}` with a short message safe to show the model, or
  `{:interrupt, message, data}` to pause or halt the run (see
  `Sagents.Middleware.Haltable`).
  """

  defmodule Context do
    @moduledoc "What a capability call runs as: identity first, everything else after."
    @enforce_keys [:scope]
    defstruct [:scope, :conversation_id, :agent_id, :capability]

    @type t :: %__MODULE__{
            scope: Connectix.Accounts.Scope.t(),
            conversation_id: term(),
            agent_id: String.t() | nil,
            capability: Connectix.Skills.Capability.t() | nil
          }
  end

  @callback args_schema() :: module()
  @callback call(args :: struct() | map(), Context.t()) ::
              {:ok, term()}
              | {:ok, term(), term()}
              | {:error, String.t()}
              | {:interrupt, String.t(), map()}
end
