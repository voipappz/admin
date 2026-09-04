defmodule Connectix.Conversations.AgentState do
  @moduledoc "The persisted Sagents state for a conversation (plain struct, one Mnesia row)."
  @derive Jason.Encoder
  defstruct [:id, :conversation_id, :state_data, :version, :inserted_at, :updated_at]
end
