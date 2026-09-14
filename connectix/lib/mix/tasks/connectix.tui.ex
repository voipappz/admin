defmodule Mix.Tasks.Connectix.Tui do
  @shortdoc "Live terminal cockpit: what this portal is receiving, and who is wired up"

  @moduledoc """
  The cockpit — the store's totals, the cable subscriptions the node confirmed,
  one row per signed-in agent, the last socket closes, and the events as they
  land.

      mix connectix.tui                        # attach to the running portal
      mix connectix.tui --node connectix@host  # attach elsewhere
      mix connectix.tui --local                # boot the app here and show it

  By default it does NOT boot the application: it connects to the portal that
  is already running (`connectix@127.0.0.1`, the name `Connectix.Mnesia` gives
  it) and reads over RPC, so the sessions and cable clients shown are the ones
  the browsers are actually on. When that node does not answer it falls back
  to booting the app in this process and says so in the status pane.

  No NIF and no native dependency. `q` or Ctrl-C quits.
  """

  use Mix.Task

  @impl Mix.Task
  def run(args) do
    {opts, _rest, _bad} = OptionParser.parse(args, switches: [node: :string, local: :boolean])

    # Code only — the application is started below only when nothing is
    # running to attach to.
    Mix.Task.run("compile")

    if opts[:local] do
      local("running against this process (--local)")
    else
      case Connectix.Tui.Source.attach(opts[:node] || Connectix.Tui.default_node()) do
        {{:remote, _node} = source, nil} ->
          Connectix.Tui.Runtime.run(Connectix.Tui.App, source: source, notice: nil)

        {:local, why} ->
          local(why)
      end
    end
  end

  defp local(notice) do
    Mix.Task.run("app.start")
    Connectix.Tui.local(notice)
  end
end
