defmodule Connectix.Skills.Context do
  @moduledoc """
  Run-time facts handed to a Skill when its middleware is built: things the
  compiler deliberately does not know. `scope` is the identity boundary;
  `model` is the chat model the Factory built; `filesystem_scope` is the
  owner's file store when one is running.
  """

  @enforce_keys [:scope, :agent_id, :model]
  defstruct [:scope, :agent_id, :model, :filesystem_scope, timezone: "UTC"]

  @type t :: %__MODULE__{
          scope: Connectix.Accounts.Scope.t(),
          agent_id: String.t(),
          model: struct(),
          filesystem_scope: term() | nil,
          timezone: String.t()
        }
end
