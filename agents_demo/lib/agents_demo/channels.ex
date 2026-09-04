defmodule Connectix.Channels do
  @moduledoc """
  Delivery of agent replies to the channel a conversation arrived on.

  Adding a channel is two steps: write a module implementing
  `Connectix.Channels.Channel`, and list it in config.

      config :agents_demo, :channels, [Connectix.Channels.WhatsApp]

  There is deliberately one dispatch point. Papercups, which this borrows
  from, instead pipes a message through a hardcoded `notify(:slack)`,
  `notify(:sms)`, `notify(:gmail)`… chain, and repeats that chain at every
  call site — so adding a channel means finding and editing all of them.
  Here `deliver/2` is the only place that knows channels exist.

  Delivery is fire-and-forget. A channel that is slow, broken, or rate-limited
  must never delay the reply the user is already reading in the browser.
  """

  require Logger

  alias Connectix.Conversations.Conversation

  @doc """
  Hand `message` to whichever channel owns `conversation`.

  Returns the message unchanged so it can sit in a pipeline.
  """
  @spec deliver(struct(), Conversation.t()) :: struct()
  def deliver(message, %Conversation{source: source} = conversation) do
    for module <- configured(), module.source() == source do
      Task.start(fn ->
        case module.deliver(message, conversation) do
          :ok ->
            :ok

          {:error, reason} ->
            Logger.error("#{inspect(module)} delivery failed: #{inspect(reason)}")
        end
      end)
    end

    message
  end

  @doc """
  The channel modules currently enabled.
  """
  @spec configured() :: [module()]
  def configured, do: Application.get_env(:agents_demo, :channels, [])
end
