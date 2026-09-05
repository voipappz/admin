defmodule Connectix.MnesiaStorageTest do
  @moduledoc """
  That running the suite cannot destroy a developer's data.

  `MNESIA_DIR` is set on the container, and `docker-compose.yml` loads `.env`
  for every service — so `MIX_ENV=test` in that same container would adopt the
  *same disc schema* the dev server is using. `ConnCase` setup then calls
  `Connectix.Mnesia.reset_domain_for_test!/0`, which clears conversations,
  users and the id sequence.

  That is not hypothetical: it happened. Conversations vanished mid-session and
  duplicate operator users accumulated, while a test run was in flight, and the
  loss was mistaken for a persistence bug for some time.

  `Connectix.Mnesia.persist?/0` is therefore false under test regardless of the
  variable. This test is the tripwire on that guard: delete it and the suite
  silently starts eating the dev database again.
  """

  use ExUnit.Case, async: true

  test "the compile-time environment is what gates persistence, and it is test" do
    assert Connectix.Config.test?()
  end

  test "domain tables are RAM-only under test, even with MNESIA_DIR set" do
    for table <- [:sagents_conversations, :sagents_display_messages, :users, :connectix_seq] do
      assert :mnesia.table_info(table, :disc_copies) == [],
             """
             #{table} has a disc copy under MIX_ENV=test.

             The suite clears this table in setup. On disc, that clears whatever
             the dev server is using — see this module's docs.
             """
    end
  end

  test "clearing domain tables is confined to the test-only entry point" do
    # The clearing functions exist for deterministic setup and must stay
    # unreachable from application code; a stray call in a store's `init/1`
    # would empty the database on every boot.
    callers =
      Path.wildcard("lib/**/*.ex")
      |> Enum.filter(fn file ->
        file
        |> File.read!()
        |> String.contains?(["reset_domain_for_test!(", "clear_tables!("])
      end)
      |> Enum.reject(&String.ends_with?(&1, "lib/connectix/mnesia.ex"))
      |> Enum.reject(&String.ends_with?(&1, "lib/connectix/portal/store.ex"))

    assert callers == [],
           "application code calls a table-clearing function: #{inspect(callers)}"
  end
end
