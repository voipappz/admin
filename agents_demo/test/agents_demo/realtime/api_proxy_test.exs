defmodule AgentsDemo.Realtime.ApiProxyTest do
  @moduledoc """
  The `verify` reply contract with the node, pinned without a socket.

  The socket half is not tested here — it is the same Mint plumbing as
  `CableClient` and needs a node. What can drift silently is the reading of the
  envelope: which status and body mean "yes", "no", and "this node does not
  know the action". The last one matters most, because misreading it turns an
  old image into a timeout that looks like a dead node.
  """
  # async: false — the extra state subscriptions are read from EVENT_STREAMS at
  # call time, and setting a variable is process-global.
  use ExUnit.Case, async: false

  alias AgentsDemo.Realtime.ApiProxy

  @api_identifier Jason.encode!(%{channel: "ApiProxy"})
  @call_events_identifier Jason.encode!(%{channel: "CallEvents"})

  describe "the singleton cable connection" do
    test "subscribes to API replies and CallEvents exactly once for the application" do
      assert ApiProxy.identifiers() == [@api_identifier, @call_events_identifier]
    end

    test "classifies CallEvents separately from request replies" do
      event = %{"action" => "user.answer", "user_uuid" => "user-a"}
      reply = %{"id" => "request-1", "status" => 200}

      assert ApiProxy.classify(@call_events_identifier, event) == {:event, event}
      assert ApiProxy.classify(@api_identifier, reply) == {:reply, reply}
      assert ApiProxy.classify("unknown", event) == :ignore
    end
  end

  describe "extra state streams (EVENT_STREAMS)" do
    setup do
      previous = System.get_env("EVENT_STREAMS")
      on_exit(fn ->
        if previous, do: System.put_env("EVENT_STREAMS", previous), else: System.delete_env("EVENT_STREAMS")
      end)

      :ok
    end

    test "adds nothing when unset" do
      System.delete_env("EVENT_STREAMS")

      assert ApiProxy.state_identifiers() == []
      assert ApiProxy.identifiers() == [@api_identifier, @call_events_identifier]
    end

    test "subscribes to each named stream, after the two it always holds" do
      System.put_env("EVENT_STREAMS", "user:agent-1,environment:env-1")

      assert ApiProxy.identifiers() == [
               @api_identifier,
               @call_events_identifier,
               Jason.encode!(%{channel: "StateChannel", scope: "user", id: "agent-1"}),
               Jason.encode!(%{channel: "StateChannel", scope: "environment", id: "env-1"})
             ]
    end

    test "records a state frame instead of feeding it to the pop evaluator" do
      # These streams are subscribed to answer "did this frame reach us". Only
      # CallEvents and a signed-in user's own stream may cause a pop.
      identifier = Jason.encode!(%{channel: "StateChannel", scope: "user", id: "agent-1"})
      message = %{"event" => "agent-state-change", "id" => "agent-1"}

      assert ApiProxy.classify(identifier, message) == {:record, message}
    end

    test "matches the channel by decoding, not by the exact identifier string" do
      # The node echoes back the identifier it was sent. Comparing strings would
      # make this depend on Jason's key order, which is not part of the contract.
      reordered = ~s({"scope":"user","id":"agent-1","channel":"StateChannel"})
      message = %{"event" => "agent-state-change"}

      assert ApiProxy.classify(reordered, message) == {:record, message}
    end

    test "ignores a channel it does not know" do
      identifier = Jason.encode!(%{channel: "DashboardLive", id: "d-1"})

      assert ApiProxy.classify(identifier, %{"a" => 1}) == :ignore
    end
  end

  describe "decode_verify/2" do
    test "200 ok:true carries the three claims and nothing else" do
      body = ~s({"ok":true,"user_uuid":"u-1","account_uuid":"a-1","environment_uuid":null})

      assert {:ok, claims} = ApiProxy.decode_verify(200, body)
      assert claims == %{"user_uuid" => "u-1", "account_uuid" => "a-1", "environment_uuid" => nil}
    end

    test "401 ok:false is the node's verdict" do
      assert {:error, :invalid} = ApiProxy.decode_verify(401, ~s({"ok":false,"error":"invalid"}))
    end

    test "the unknown-action 400 is recognised by its prefix" do
      # Verbatim from the channel before it learned `verify`. The list of
      # actions in the parentheses is the part that changes, so it is not
      # matched.
      body = ~s|{"error":"unknown action \\"verify\\" (expected \\"request\\")"}|
      assert {:error, :unsupported} = ApiProxy.decode_verify(400, body)
    end

    test "anything else is unexpected, not a refusal" do
      # A 503 (proxy disabled), a 200 with no `ok`, or a body that is not
      # JSON: none of these is the node saying no, so none may become
      # `:invalid` — that would cache a negative for a token nobody judged.
      assert {:error, :unexpected} = ApiProxy.decode_verify(503, ~s({"error":"disabled"}))
      assert {:error, :unexpected} = ApiProxy.decode_verify(200, ~s({"user_uuid":"u-1"}))
      assert {:error, :unexpected} = ApiProxy.decode_verify(200, "<html>")
      assert {:error, :unexpected} = ApiProxy.decode_verify(nil, nil)
    end
  end
end
