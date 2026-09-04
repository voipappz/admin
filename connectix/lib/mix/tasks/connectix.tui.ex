defmodule Mix.Tasks.Connectix.Tui do
  @shortdoc "Live terminal cockpit: what this portal is receiving"

  @moduledoc """
  The cockpit — the store's totals, the cable subscriptions the node confirmed,
  and the events as they land.

      mix connectix.tui      # or: make tui-events

  No NIF and no native dependency: raw terminal mode comes from OTP's
  `:shell.start_interactive({:noshell, :raw})`, with an `stty` fallback.

  It boots the full application, so the portal it shows is the one this process
  is running — not a remote one. To inspect a portal that is ALREADY running,
  use `make iex`, which attaches to that node instead.

  `q` or Ctrl-C quits.
  """

  use Mix.Task

  @impl Mix.Task
  def run(_args) do
    # A TUI owns the terminal: one log line lands in the middle of a frame and
    # smears it. Silence Logger AND remove the default handler, or anything
    # writing to stdout still gets through.
    _ = Logger.configure(level: :none)
    _ = :logger.remove_handler(:default)
    _ = :logger.set_primary_config(:level, :none)

    Mix.Task.run("app.start")
    Connectix.Tui.Runtime.run(Connectix.Tui.App)
  end
end
