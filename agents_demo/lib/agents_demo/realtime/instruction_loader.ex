defmodule AgentsDemo.Realtime.InstructionLoader do
  @moduledoc """
  Loads Ruby-owned screen-pop instructions over the existing NATS ask path.

  This runs when a verified user's environment first becomes active, never for
  each call event. Ruby answers `screen_pop.instructions.load`; Crystal remains
  the runtime event source.
  """

  alias AgentsDemo.Realtime.Bus

  @subject "screen_pop.instructions.load"

  @spec load(String.t()) :: {:ok, map()} | {:error, term()}
  def load(environment_uuid) when is_binary(environment_uuid) and environment_uuid != "" do
    Bus.request(@subject, %{environment_uuid: environment_uuid})
  end

  def load(_environment_uuid), do: {:error, :missing_environment}

  @doc false
  def subject, do: @subject
end
