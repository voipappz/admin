if Mix.env() == :test do
  defmodule Connectix.Channels.WhatsApp.TestAdapter do
    @moduledoc """
    An `Anu` adapter for tests: instead of calling Meta, it forwards the
    message it would have sent to a process the test registers.

    `Anu.Adapters.Test` sends to `self()`, which is the wrong mailbox here —
    delivery runs inside the `Task` that `Connectix.Channels.deliver/2`
    starts. Tests call `receive_here/0` in their setup and then
    `assert_receive {:whatsapp, %Anu.Message{}}`.
    """

    @behaviour Anu.Adapter

    @key :whatsapp_test_receiver

    @doc "Send every outbound WhatsApp message to the calling process."
    def receive_here, do: Application.put_env(:agents_demo, @key, self())

    @impl true
    def deliver(%Anu.Message{} = message, _client) do
      case Application.get_env(:agents_demo, @key) do
        pid when is_pid(pid) -> send(pid, {:whatsapp, message})
        _none -> :ok
      end

      {:ok, %Anu.Response{id: "test_#{System.unique_integer([:positive])}", status: "accepted"}}
    end
  end
end
