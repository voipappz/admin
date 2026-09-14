defmodule Connectix.Tui do
  @moduledoc """
  Entry points for the cockpit.

      mix connectix.tui                 # attach to connectix@127.0.0.1, else local
      mix connectix.tui --local         # this process only
      bin/connectix eval Connectix.Tui.attach   # inside a release container

  The release form is what `make tui YAML=config/deploy.x.yml` runs through
  kamal (`app exec -i --reuse` on the host that file names): the
  TUI modules ship in the release, `eval` starts a bare VM beside the running
  one, and `attach/1` connects to it by name — nothing is started in the
  portal itself.
  """

  alias Connectix.Tui.{App, Runtime, Source}

  @default_node "connectix@127.0.0.1"

  @doc "Attach to the running portal and drive the cockpit off it."
  def attach(target \\ @default_node) do
    quiet()
    {source, notice} = Source.attach(target)
    Runtime.run(App, source: source, notice: notice)
  end

  @doc "Run the cockpit against this process (the application must be started)."
  def local(notice \\ nil) do
    quiet()
    Runtime.run(App, source: :local, notice: notice)
  end

  @doc false
  def default_node, do: @default_node

  # A TUI owns the terminal: one log line lands in the middle of a frame and
  # smears it. Silence Logger AND remove the default handler, or anything
  # writing to stdout still gets through.
  defp quiet do
    _ = Logger.configure(level: :none)
    _ = :logger.remove_handler(:default)
    _ = :logger.set_primary_config(:level, :none)
    :ok
  end
end
