defmodule Connectix.Bots.Runtime do
  @moduledoc """
  Compiled specs for the runtime, cached by fingerprint.

  A published version is immutable and fingerprinted, so its compiled spec
  can live in `:persistent_term` for the life of the node: compiling once per
  version rather than once per session start. Drafts have no fingerprint and
  compile every time — they change.
  """

  alias Connectix.Bots.BotVersion
  alias Connectix.Bots.Compiler

  @spec spec_for(BotVersion.t()) :: {:ok, Connectix.Bots.CompiledSpec.t()} | {:error, term()}
  def spec_for(%BotVersion{fingerprint: nil} = version), do: Compiler.compile(version)

  def spec_for(%BotVersion{fingerprint: fingerprint} = version) do
    key = {__MODULE__, version.id, fingerprint}

    case :persistent_term.get(key, nil) do
      nil ->
        with {:ok, spec} <- Compiler.compile(version) do
          :persistent_term.put(key, spec)
          {:ok, spec}
        end

      spec ->
        {:ok, spec}
    end
  end

  @doc "Forget a cached spec (tests, or a version retired from a running node)."
  def forget(%BotVersion{id: id, fingerprint: fingerprint}) do
    :persistent_term.erase({__MODULE__, id, fingerprint})
    :ok
  end
end
