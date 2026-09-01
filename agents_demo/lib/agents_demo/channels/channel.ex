defmodule AgentsDemo.Channels.Channel do
  @moduledoc """
  What a channel has to provide.

  Two callbacks: which `source` value it owns, and how to send one message.
  Inbound traffic is not part of this behaviour — each channel receives it
  however its provider dictates (a webhook plug, a poller, a socket), and the
  only contract there is that it ends in a persisted message.
  """

  alias AgentsDemo.Conversations.Conversation

  @doc """
  The `sagents_conversations.source` value this channel is responsible for.
  """
  @callback source() :: String.t()

  @doc """
  Send one message out. Runs in its own task; raising only kills that task.
  """
  @callback deliver(message :: struct(), conversation :: Conversation.t()) ::
              :ok | {:error, term()}
end
