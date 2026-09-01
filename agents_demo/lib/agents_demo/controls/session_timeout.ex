defmodule AgentsDemo.Controls.SessionTimeout do
  @moduledoc """
  Whether a conversation has been silent long enough that a deterministic
  flow should start over. Pure: takes the clock.
  """

  alias AgentsDemo.Bots.Version.Limits
  alias AgentsDemo.Conversations.Conversation

  @spec expired?(Conversation.t(), Limits.t() | nil, DateTime.t()) :: boolean()
  def expired?(_conversation, nil, _now), do: false
  def expired?(_conversation, %Limits{session_idle_timeout_seconds: nil}, _now), do: false
  def expired?(%Conversation{last_user_message_at: nil}, _limits, _now), do: false

  def expired?(
        %Conversation{last_user_message_at: last},
        %Limits{session_idle_timeout_seconds: seconds},
        now
      ) do
    DateTime.diff(now, last, :second) >= seconds
  end
end
