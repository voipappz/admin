defmodule Connectix.BotsFixtures do
  @moduledoc """
  Test helpers for `Connectix.Bots`. All take the owner's scope first.
  """

  alias Connectix.Bots

  @doc "Draft configuration that validates and publishes."
  def valid_version_attrs(attrs \\ %{}) do
    Map.merge(
      %{
        "behavior" => %{"instructions" => "You are a test bot. Be brief."},
        "skills" => [%{"skill_id" => "web_lookup", "skill_version" => "1.0.0", "position" => 0}]
      },
      attrs
    )
  end

  @doc "A bot with draft v1, unpublished."
  def bot_fixture(scope, attrs \\ %{}) do
    unique = System.unique_integer([:positive])

    attrs =
      Map.merge(
        %{"name" => "Bot #{unique}", "version" => valid_version_attrs()},
        Map.new(attrs, fn {k, v} -> {to_string(k), v} end)
      )

    {:ok, bot} = Bots.create_bot(scope, attrs)
    bot
  end

  @doc "A bot whose v1 is published and current."
  def published_bot_fixture(scope, attrs \\ %{}) do
    bot = bot_fixture(scope, attrs)
    {:ok, bot} = Bots.publish_draft(scope, bot.id)
    bot
  end
end
