defmodule Connectix.Realtime.FreeSwitch.FrameTest do
  use ExUnit.Case, async: true

  alias Connectix.Realtime.FreeSwitch.Frame
  alias Connectix.Realtime.PopRule

  # The headers of a real mod_callcenter event, as the Event Socket delivers
  # them in `plain` form (already URL-decoded by the client).
  @bridge %{
    "Event-Name" => "CUSTOM",
    "Event-Subclass" => "callcenter::info",
    "Event-UUID" => "6d0f0b6e-4a29-4a1a-9a5e-4e1a6f7b2c11",
    "Event-Date-Timestamp" => "1790071729079910",
    "CC-Action" => "bridge-agent-start",
    "CC-Queue" => "support@2574.nimbusip.com",
    "CC-Agent" => "88309e98-f698-4b57-898d-a6056c37dd55",
    "CC-Agent-System" => "single_box",
    "CC-Member-UUID" => "0a5d1b0c-7a55-4f3d-9d3e-2b1f4c5d6e7f",
    "CC-Member-Session-UUID" => "39c7885d-7a68-4835-9742-acfc031865a1",
    "CC-Member-CID-Name" => "0527073205",
    "CC-Member-CID-Number" => "0527073205",
    "Unique-ID" => "39c7885d-7a68-4835-9742-acfc031865a1"
  }

  test "a callcenter event becomes the node-shaped frame the pop reads" do
    frame = Frame.from_esl(@bridge)

    # The trigger name every customer yaml already lists.
    assert frame["action"] == "bridge-agent-start"
    assert PopRule.trigger?(frame)

    # The agent, by both paths the shared rule's `agent_fields` name.
    assert PopRule.dig(frame, "meta.CC-Agent") == "88309e98-f698-4b57-898d-a6056c37dd55"
    assert PopRule.dig(frame, "user_uuid") == "88309e98-f698-4b57-898d-a6056c37dd55"

    assert frame["caller_id_number"] == "0527073205"
    assert frame["uuid"] == "39c7885d-7a68-4835-9742-acfc031865a1"
    assert frame["type"] == "call"
    assert frame["create_date"] == 1_790_071_729_079_910
  end

  test "the id is the node's <action>_<session>_<member>_<agent>, the dedupe key" do
    frame = Frame.from_esl(@bridge)

    assert frame["id"] ==
             "bridge-agent-start_39c7885d-7a68-4835-9742-acfc031865a1_" <>
               "0a5d1b0c-7a55-4f3d-9d3e-2b1f4c5d6e7f_88309e98-f698-4b57-898d-a6056c37dd55"
  end

  test "two agents offered one call get two ids; one agent retried gets one" do
    offered = Map.put(@bridge, "CC-Action", "agent-offering")
    a = Frame.from_esl(offered)
    b = Frame.from_esl(Map.put(offered, "CC-Agent", "other-agent"))
    a_again = Frame.from_esl(Map.put(offered, "Event-UUID", "a-retry-has-a-new-event-uuid"))

    refute a["id"] == b["id"]
    assert a["id"] == a_again["id"]
  end

  test "a non-callcenter event keeps FreeSWITCH's own name and its Event-UUID" do
    frame =
      Frame.from_esl(%{
        "Event-Name" => "CHANNEL_HANGUP_COMPLETE",
        "Event-UUID" => "ev-1",
        "Unique-ID" => "chan-1",
        "Caller-Caller-ID-Number" => "0527073205",
        "variable_sip_from_user" => "0527073205"
      })

    assert frame["action"] == "CHANNEL_HANGUP_COMPLETE"
    assert frame["id"] == "ev-1"
    assert frame["uuid"] == "chan-1"
    assert frame["caller_id_number"] == "0527073205"
    # The whole header map rides under meta, where the store's variable_* trim looks.
    assert frame["meta"]["variable_sip_from_user"] == "0527073205"
    refute PopRule.trigger?(frame)
  end

  test "another CUSTOM event is named by its subclass" do
    frame = Frame.from_esl(%{"Event-Name" => "CUSTOM", "Event-Subclass" => "sofia::register"})
    assert frame["action"] == "sofia::register"
  end

  test "absent headers are absent keys, not nils" do
    frame = Frame.from_esl(%{"Event-Name" => "HEARTBEAT"})

    assert frame["action"] == "HEARTBEAT"
    refute Map.has_key?(frame, "user_uuid")
    refute Map.has_key?(frame, "caller_id_number")
    refute Map.has_key?(frame, "id")
    refute Map.has_key?(frame, "create_date")
  end

  test "accepts the client's event struct as well as bare headers" do
    assert Frame.from_esl(%{headers: @bridge}) == Frame.from_esl(@bridge)
  end
end
