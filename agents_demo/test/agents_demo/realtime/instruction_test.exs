defmodule AgentsDemo.Realtime.InstructionTest do
  use ExUnit.Case, async: true

  alias AgentsDemo.Realtime.Instruction

  @environment_uuid "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
  @user_uuid "11111111-2222-3333-4444-555555555555"
  @url "https://crm.example.com/static-answer"

  defp instruction(overrides \\ %{}) do
    Map.merge(
      %{
        "service_uuid" => "screen-pop-service-1",
        "service_type" => "screen_pop",
        "triggers" => ["user.answer"],
        "environment_uuid" => @environment_uuid,
        "profile" => %{"record_url" => @url, "pop_on" => "answer"},
        "steps" => [%{"key" => "pop", "node" => "screen_pop_pop", "on" => %{}}]
      },
      overrides
    )
  end

  defp event(overrides \\ %{}) do
    Map.merge(
      %{
        "type" => "callcenter",
        "action" => "user.answer",
        "id" => "event-1",
        "call_uuid" => "call-1",
        "user_uuid" => @user_uuid,
        "environment_uuid" => @environment_uuid
      },
      overrides
    )
  end

  describe "load-time instructions from Ruby" do
    test "accepts the static user.answer -> tab:new instruction for the requested environment" do
      payload = %{"instructions" => [instruction()]}

      assert Instruction.load(payload, @environment_uuid) == [instruction()]
    end

    test "keeps only instructions for the requested environment" do
      other = instruction(%{"service_uuid" => "other", "environment_uuid" => "other-env"})

      assert Instruction.load(%{"instructions" => [other, instruction()]}, @environment_uuid) == [
               instruction()
             ]
    end

    test "drops malformed, unknown-node, and unsafe-url instructions independently" do
      invalid = [
        Map.delete(instruction(), "service_uuid"),
        instruction(%{"steps" => [%{"key" => "close", "node" => "tab_close", "on" => %{}}]}),
        put_in(instruction(), ["profile", "record_url"], "http://crm.example.com/contact/42"),
        put_in(instruction(), ["profile", "record_url"], "javascript:alert(1)"),
        put_in(instruction(), ["profile", "record_url"], "https://user:secret@crm.example.com/contact/42"),
        "not-a-map"
      ]

      assert Instruction.load(%{"instructions" => invalid ++ [instruction()]}, @environment_uuid) == [
               instruction()
             ]
    end

    test "a malformed response loads no executable instructions" do
      assert Instruction.load(%{}, @environment_uuid) == []
      assert Instruction.load(%{"instructions" => "wrong"}, @environment_uuid) == []
      assert Instruction.load("wrong", @environment_uuid) == []
    end
  end

  describe "runtime event matching" do
    test "matches user.answer and returns the target user plus the stripped browser command" do
      assert Instruction.match([instruction()], event()) ==
               {:ok, "screen-pop-service-1:user.answer:event-1", @user_uuid,
                %{"action" => "tab:new", "url" => @url}}
    end

    test "uses call_uuid as the stable event identity when id is absent" do
      event = event() |> Map.delete("id")

      assert {:ok, dedupe_id, @user_uuid, _command} = Instruction.match([instruction()], event)
      assert dedupe_id == "screen-pop-service-1:user.answer:call-1"
    end

    test "drops missing identities and events without a stable id" do
      for bad <- [
            Map.delete(event(), "user_uuid"),
            Map.put(event(), "user_uuid", ""),
            Map.delete(event(), "environment_uuid"),
            event() |> Map.delete("id") |> Map.delete("call_uuid")
          ] do
        assert {:error, _reason} = Instruction.match([instruction()], bad)
      end
    end

    test "does not match another event or environment" do
      assert Instruction.match([instruction()], event(%{"action" => "user.ringing"})) ==
               {:error, :no_instruction}

      assert Instruction.match([instruction()], event(%{"environment_uuid" => "other-env"})) ==
               {:error, :no_instruction}
    end

    test "never derives the target user from the instruction" do
      refute Map.has_key?(instruction(), "user_uuid")

      assert {:ok, _id, "event-user", _command} =
               Instruction.match([instruction()], event(%{"user_uuid" => "event-user"}))
    end
  end
end
