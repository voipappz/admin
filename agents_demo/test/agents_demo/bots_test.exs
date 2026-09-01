defmodule AgentsDemo.BotsTest do
  use AgentsDemo.DataCase

  import AgentsDemo.AccountsFixtures
  import AgentsDemo.BotsFixtures
  import AgentsDemo.ConversationsFixtures

  alias AgentsDemo.Bots
  alias AgentsDemo.Bots.Bot
  alias AgentsDemo.Bots.BotVersion
  alias AgentsDemo.Bots.Snapshot
  alias AgentsDemo.Bots.Validator
  alias AgentsDemo.Repo

  setup do
    %{scope: user_scope_fixture()}
  end

  describe "create_bot/2" do
    test "creates the bot and draft v1 together", %{scope: scope} do
      assert {:ok, %Bot{} = bot} =
               Bots.create_bot(scope, %{
                 "name" => "Nimbus Support",
                 "version" => valid_version_attrs()
               })

      assert bot.slug == "nimbus-support"
      assert bot.status == :active
      assert bot.current_version == nil
      assert %BotVersion{number: 1, status: :draft} = bot.draft_version
      assert bot.draft_version_id == bot.draft_version.id
    end

    test "rolls the bot back when the draft is invalid", %{scope: scope} do
      before = length(Bots.list_bots(scope))

      assert {:error, %Ecto.Changeset{}} =
               Bots.create_bot(scope, %{
                 "name" => "Broken",
                 "version" => %{"skills" => [%{"skill_id" => "nope", "skill_version" => "1.0.0"}]}
               })

      assert length(Bots.list_bots(scope)) == before
    end

    test "a name is required and unique per owner", %{scope: scope} do
      assert {:error, changeset} = Bots.create_bot(scope, %{})
      assert "can't be blank" in errors_on(changeset).name

      bot_fixture(scope, name: "Twice")
      assert {:error, changeset} = Bots.create_bot(scope, %{"name" => "Twice"})
      assert errors_on(changeset).name == ["you already have a bot with that name"]
    end
  end

  describe "publish_draft/3" do
    test "freezes the draft and makes it current in one step", %{scope: scope} do
      bot = bot_fixture(scope)

      assert {:ok, %Bot{} = published} = Bots.publish_draft(scope, bot.id)
      assert published.draft_version == nil
      assert %BotVersion{number: 1, status: :published} = version = published.current_version
      assert published.current_version_id == version.id
      assert version.fingerprint =~ ~r/^sha256:[0-9a-f]{64}$/
      assert version.published_by_user_id == scope.user.id
      assert %DateTime{} = version.published_at
    end

    test "refuses an invalid draft with the report, changing nothing", %{scope: scope} do
      bot = bot_fixture(scope, version: %{"behavior" => %{"instructions" => ""}})

      assert {:error, %Validator.Report{valid?: false, errors: errors}} =
               Bots.publish_draft(scope, bot.id)

      assert Enum.any?(errors, &(&1.code == :no_instructions))

      assert {:ok, %Bot{current_version: nil, draft_version: %BotVersion{}}} =
               Bots.get_bot(scope, bot.id)
    end

    test "without a draft there is nothing to publish", %{scope: scope} do
      bot = published_bot_fixture(scope)
      assert {:error, :no_draft} = Bots.publish_draft(scope, bot.id)
    end

    test "a second publish supersedes but keeps the previous version published", %{scope: scope} do
      bot = published_bot_fixture(scope)
      v1 = bot.current_version

      {:ok, _draft} =
        Bots.update_draft(scope, bot.id, %{"behavior" => %{"instructions" => "Version two."}})

      assert {:ok, bot} = Bots.publish_draft(scope, bot.id)
      assert bot.current_version.number == 2
      assert Repo.get!(BotVersion, v1.id).status == :published
    end

    test "retire_previous: true retires the replaced version", %{scope: scope} do
      bot = published_bot_fixture(scope)
      v1 = bot.current_version

      {:ok, _draft} =
        Bots.update_draft(scope, bot.id, %{"behavior" => %{"instructions" => "Two."}})

      assert {:ok, _bot} = Bots.publish_draft(scope, bot.id, retire_previous: true)
      assert Repo.get!(BotVersion, v1.id).status == :retired
    end
  end

  describe "immutability" do
    test "a published version refuses edits in the changeset", %{scope: scope} do
      bot = published_bot_fixture(scope)

      changeset =
        BotVersion.draft_changeset(bot.current_version, %{
          "behavior" => %{"instructions" => "changed"}
        })

      refute changeset.valid?
      assert changeset.errors[:status]
    end

    test "the database refuses a change to a published version", %{scope: scope} do
      bot = published_bot_fixture(scope)

      assert_raise Postgrex.Error, ~r/create a new draft instead/, fn ->
        Repo.update_all(
          from(v in BotVersion, where: v.id == ^bot.current_version_id),
          set: [change_note: "sneaky"]
        )
      end
    end

    test "the database refuses removing a published version's skills", %{scope: scope} do
      bot = published_bot_fixture(scope)

      assert_raise Postgrex.Error, ~r/create a new draft instead/, fn ->
        Repo.delete_all(
          from(s in AgentsDemo.Bots.BotVersionSkill,
            where: s.bot_version_id == ^bot.current_version_id
          )
        )
      end
    end

    test "the database refuses turning a published version back into a draft", %{scope: scope} do
      bot = published_bot_fixture(scope)

      assert_raise Postgrex.Error, ~r/cannot become a draft/, fn ->
        Repo.update_all(
          from(v in BotVersion, where: v.id == ^bot.current_version_id),
          set: [status: "draft"]
        )
      end
    end
  end

  describe "drafts" do
    test "update_draft/3 on a published bot creates draft v2 as a copy", %{scope: scope} do
      bot = published_bot_fixture(scope)

      assert {:ok, %BotVersion{number: 2, status: :draft} = draft} =
               Bots.update_draft(scope, bot.id, %{"change_note" => "tweak"})

      assert draft.behavior.instructions == bot.current_version.behavior.instructions
      assert Enum.map(draft.skills, & &1.skill_id) == ["web_lookup"]

      {:ok, bot} = Bots.get_bot(scope, bot.id)
      assert bot.draft_version_id == draft.id
      assert bot.current_version.number == 1
    end

    test "create_draft/2 refuses a second draft", %{scope: scope} do
      bot = published_bot_fixture(scope)
      assert {:ok, %BotVersion{number: 2}} = Bots.create_draft(scope, bot.id)
      assert {:error, :draft_exists} = Bots.create_draft(scope, bot.id)
    end

    test "delete_draft/2 removes it and clears the pointer", %{scope: scope} do
      bot = published_bot_fixture(scope)
      {:ok, draft} = Bots.create_draft(scope, bot.id)

      assert {:ok, :ok} = Bots.delete_draft(scope, bot.id)
      assert Repo.get(BotVersion, draft.id) == nil
      assert {:ok, %Bot{draft_version_id: nil}} = Bots.get_bot(scope, bot.id)
      assert {:error, :no_draft} = Bots.delete_draft(scope, bot.id)
    end

    test "skills are validated against the catalog", %{scope: scope} do
      bot = bot_fixture(scope)

      assert {:error, changeset} =
               Bots.update_draft(scope, bot.id, %{
                 "skills" => [%{"skill_id" => "web_lookup", "skill_version" => "2.0.0"}]
               })

      assert %{skills: skills} = errors_on(changeset)
      assert Enum.any?(skills, &match?(%{skill_version: ["is incompatible" <> _]}, &1))
    end
  end

  describe "fingerprints" do
    test "are stable for the same content and differ when it changes", %{scope: scope} do
      a = published_bot_fixture(scope, name: "A")
      b = published_bot_fixture(scope, name: "B")
      assert a.current_version.fingerprint == b.current_version.fingerprint

      c =
        published_bot_fixture(scope,
          name: "C",
          version: valid_version_attrs(%{"limits" => %{"max_runs" => 3}})
        )

      refute c.current_version.fingerprint == a.current_version.fingerprint
    end

    test "ignore ids, numbers and lifecycle", %{scope: scope} do
      bot = published_bot_fixture(scope)
      {:ok, draft} = Bots.create_draft(scope, bot.id)
      assert Snapshot.fingerprint(draft) == bot.current_version.fingerprint
    end
  end

  describe "deleting and archiving" do
    test "a bot with only a draft can be deleted", %{scope: scope} do
      bot = bot_fixture(scope)
      assert {:ok, %Bot{}} = Bots.delete_bot(scope, bot.id)
      assert {:error, :not_found} = Bots.get_bot(scope, bot.id)
    end

    test "a bot with history cannot", %{scope: scope} do
      bot = published_bot_fixture(scope)
      assert {:error, :has_history} = Bots.delete_bot(scope, bot.id)
    end

    test "an archived bot takes no new conversations", %{scope: scope} do
      bot = published_bot_fixture(scope)
      {:ok, bot} = Bots.archive_bot(scope, bot.id)
      assert bot.status == :archived
      assert {:error, :bot_archived} = Bots.resolve_pin(scope, %{bot_id: bot.id})

      {:ok, bot} = Bots.unarchive_bot(scope, bot.id)
      assert {:ok, %{bot_version_id: _id}} = Bots.resolve_pin(scope, %{bot_id: bot.id})
    end

    test "retire_version/3 keeps the current version and only retires published ones", %{
      scope: scope
    } do
      bot = published_bot_fixture(scope)
      assert {:error, :version_is_current} = Bots.retire_version(scope, bot.id, 1)

      {:ok, _draft} =
        Bots.update_draft(scope, bot.id, %{"behavior" => %{"instructions" => "Two."}})

      {:ok, _bot} = Bots.publish_draft(scope, bot.id)
      assert {:ok, %BotVersion{status: :retired}} = Bots.retire_version(scope, bot.id, 1)
      assert {:error, :version_not_published} = Bots.retire_version(scope, bot.id, 1)
    end
  end

  describe "resolve_pin/2" do
    test "with nothing pins the default bot", %{scope: scope} do
      {:ok, default} = Bots.get_bot_by_slug(scope, "default")
      assert {:ok, %{bot_id: bot_id, bot_version_id: version_id}} = Bots.resolve_pin(scope, %{})
      assert bot_id == default.id
      assert version_id == default.current_version_id
    end

    test "an explicit version must be published", %{scope: scope} do
      bot = bot_fixture(scope)

      assert {:error, :version_not_published} =
               Bots.resolve_pin(scope, %{bot_version_id: bot.draft_version_id})

      assert {:error, :no_published_version} = Bots.resolve_pin(scope, %{bot_id: bot.id})
    end

    test "another owner's bot is not found", %{scope: scope} do
      other = user_scope_fixture()
      bot = published_bot_fixture(other)
      assert {:error, :not_found} = Bots.resolve_pin(scope, %{bot_id: bot.id})

      assert {:error, :not_found} =
               Bots.resolve_pin(scope, %{bot_version_id: bot.current_version_id})

      assert {:error, :not_found} = Bots.get_bot(scope, bot.id)
    end
  end

  describe "ensure_default_bot/1" do
    test "every new account has a published default bot", %{scope: scope} do
      assert {:ok, %Bot{slug: "default", current_version: %BotVersion{status: :published}}} =
               Bots.get_bot_by_slug(scope, "default")

      assert {:ok, %Bot{} = same} = Bots.ensure_default_bot(scope)
      assert length(Bots.list_bots(scope)) == 1
      assert same.slug == "default"
    end
  end

  describe "pinned_version/1" do
    test "returns the version a conversation pins, even after a newer publish", %{scope: scope} do
      bot = published_bot_fixture(scope)
      conversation = conversation_fixture(%{scope: scope, bot_id: bot.id})
      v1_id = bot.current_version_id

      {:ok, _draft} =
        Bots.update_draft(scope, bot.id, %{"behavior" => %{"instructions" => "Two."}})

      {:ok, _bot} = Bots.publish_draft(scope, bot.id)

      assert %BotVersion{id: ^v1_id, skills: [_skill]} = Bots.pinned_version(conversation.id)
      assert {:ok, %{^v1_id => 1}} = Bots.conversation_counts(scope, bot.id)
    end
  end
end
