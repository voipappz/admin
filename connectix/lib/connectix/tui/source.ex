defmodule Connectix.Tui.Source do
  @moduledoc """
  Where the cockpit's numbers come from: this BEAM, or the portal that is
  actually running.

  The cockpit used to boot its own copy of the application, which made it a
  cockpit for a portal nobody was using — its own cable connections, its own
  empty session registry. The sessions worth looking at are on the node that
  the browsers are connected to, so by default the TUI attaches to that node
  (`connectix@127.0.0.1`, the name `Connectix.Mnesia` gives it) and asks it
  over RPC. `:local` remains for a box with nothing running.
  """

  @type t :: :local | {:remote, node()}

  @timeout 8_000

  @spec call(t(), module(), atom(), list()) :: term()
  def call(:local, mod, fun, args), do: apply(mod, fun, args)

  def call({:remote, node}, mod, fun, args) do
    case :rpc.call(node, mod, fun, args, @timeout) do
      {:badrpc, reason} -> raise "rpc to #{node} failed: #{inspect(reason)}"
      result -> result
    end
  end

  @doc "A label for the status pane."
  def label(:local), do: "this process"
  def label({:remote, node}), do: to_string(node)

  @doc """
  Start distribution and connect to the running portal. Returns the source to
  use: `{:remote, node}` when the portal answered, `:local` otherwise, with
  the reason as the second element so the operator is told why.
  """
  @spec attach(String.t()) :: {t(), String.t() | nil}
  def attach(target) when is_binary(target) do
    node = String.to_atom(target)

    with :ok <- start_distribution(),
         true <- Node.connect(node) do
      {{:remote, node}, nil}
    else
      false -> {:local, "#{target} did not answer — showing this process instead"}
      {:error, reason} -> {:local, "distribution failed (#{inspect(reason)}) — showing this process instead"}
    end
  end

  defp start_distribution do
    if Node.alive?() do
      :ok
    else
      name = :"tui-#{System.unique_integer([:positive])}@127.0.0.1"

      case Node.start(name, :longnames) do
        {:ok, _} ->
          set_cookie()
          :ok

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  # A release exports RELEASE_COOKIE for its own scripts; without it the BEAM
  # reads ~/.erlang.cookie, which is what `make iex` relies on in dev.
  defp set_cookie do
    case System.get_env("RELEASE_COOKIE") do
      nil -> :ok
      "" -> :ok
      cookie -> Node.set_cookie(String.to_atom(cookie))
    end
  end
end
