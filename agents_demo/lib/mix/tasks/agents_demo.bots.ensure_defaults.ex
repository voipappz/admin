defmodule Mix.Tasks.AgentsDemo.Bots.EnsureDefaults do
  @shortdoc "Gives every existing account its default bot"

  @moduledoc """
  New accounts get a published default bot at registration
  (`AgentsDemo.Accounts.register_user/1`). Accounts that predate that — a
  development database, or the first deploy of this change — get theirs here.
  Idempotent: an account that already has one is left alone.

      mix agents_demo.bots.ensure_defaults
  """

  use Mix.Task

  alias AgentsDemo.Accounts.Scope
  alias AgentsDemo.Accounts.User
  alias AgentsDemo.Bots
  alias AgentsDemo.Repo

  @requirements ["app.start"]

  @impl Mix.Task
  def run(_args) do
    for user <- Repo.all(User) do
      case Bots.ensure_default_bot(Scope.for_user(user)) do
        {:ok, bot} ->
          Mix.shell().info("#{user.email}: #{bot.slug} v#{bot.current_version.number}")

        {:error, reason} ->
          Mix.shell().error("#{user.email}: #{inspect(reason)}")
      end
    end
  end
end
