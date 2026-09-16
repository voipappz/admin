defmodule Connectix.Realtime.EventPipelineTest do
  use ExUnit.Case, async: true

  alias Connectix.Realtime.EventPipeline

  describe "route/3" do
    # Every handler is this process, so the routing decision is whichever cast
    # arrives — which is the whole question these assert.
    defp ctx, do: %{events: self(), screen_pop: self(), user_streams: self()}

    test "the firehose goes to the pop evaluator, by either of its two subjects" do
      # `node:<uuid>` is relayed onto `call_events` unchanged, so both are the
      # same stream and both must reach the same place.
      for subject <- ["call_events", "node:test1", "node.0f9a"] do
        EventPipeline.route(subject, %{"subject" => subject}, ctx())
        assert_receive {:"$gen_cast", {:event, %{"subject" => ^subject}}}
      end
    end

    test "a state subject carries its scope and id to the user streams" do
      EventPipeline.route("state.user.cb1b0a46", %{"e" => 1}, ctx())
      assert_receive {:"$gen_cast", {:state, "user", "cb1b0a46", %{"e" => 1}}}

      EventPipeline.route("state.call.c89919fd", %{"e" => 2}, ctx())
      assert_receive {:"$gen_cast", {:state, "call", "c89919fd", %{"e" => 2}}}
    end

    test "a user's notifications and dashboard state name their user in the subject" do
      EventPipeline.route("notifications:be5bc5f0", %{"n" => 1}, ctx())
      assert_receive {:"$gen_cast", {:notification, "be5bc5f0", %{"n" => 1}}}

      EventPipeline.route("dashboard_user:be5bc5f0", %{"d" => 1}, ctx())
      assert_receive {:"$gen_cast", {:user_state, "be5bc5f0", %{"d" => 1}}}
    end

    test "a subject nobody claims is stored rather than dropped" do
      # It was named in NATS_SUBJECTS, so somebody wanted it kept.
      EventPipeline.route("recording.live?", %{"r" => 1}, ctx())
      assert_receive {:"$gen_cast", {:record, "StateChannel", %{"r" => 1}}}
    end
  end

  describe "enabled?/0" do
    test "requires both the URL and at least one subject" do
      url = System.get_env("NATS_URL")
      subjects = System.get_env("NATS_SUBJECTS")

      on_exit(fn ->
        restore("NATS_URL", url)
        restore("NATS_SUBJECTS", subjects)
      end)

      System.delete_env("NATS_URL")
      System.delete_env("NATS_SUBJECTS")
      refute EventPipeline.enabled?()

      System.put_env("NATS_URL", "nats://127.0.0.1:4222")
      refute EventPipeline.enabled?()

      System.put_env("NATS_SUBJECTS", " call_events, state.user.* ,,")
      assert EventPipeline.enabled?()
      assert Connectix.Config.nats_subjects() == ["call_events", "state.user.*"]
    end
  end

  defp restore(key, nil), do: System.delete_env(key)
  defp restore(key, value), do: System.put_env(key, value)
end
