defmodule Connectix.Realtime.EventPipelineTest do
  # NOT async. The rule file is cached in one `:persistent_term` for the node
  # and these tests swap it, so running them beside anything that reads a rule
  # leaves the other test looking at this one's file.
  use ExUnit.Case, async: false

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

  describe "configuration, from the rule file" do
    setup do
      previous = %{
        "NATS_URL" => System.get_env("NATS_URL"),
        "NATS_SUBJECTS" => System.get_env("NATS_SUBJECTS")
      }

      customer = Application.get_env(:connectix, :customer_rule)

      on_exit(fn ->
        Enum.each(previous, fn {k, v} -> restore(k, v) end)
        Application.put_env(:connectix, :customer_rule, customer)
        Connectix.Realtime.PopRule.reload()
      end)

      :ok
    end

    defp with_rule(yaml, fun) do
      path =
        Path.join(System.tmp_dir!(), "rule_#{System.unique_integer([:positive])}.yaml")

      File.write!(path, yaml)
      # The broker and its subjects are the CUSTOMER's layer: this stands in
      # for the mounted file, over the shipped shared policy.
      Application.put_env(:connectix, :customer_rule, path)
      Connectix.Realtime.PopRule.reload()

      try do
        fun.()
      after
        File.rm(path)
      end
    end

    test "the broker and the streams both come from the file" do
      System.put_env("NATS_PASSWORD_PROBE", "s3cret")

      with_rule("""
      service_type: screen_pop
      nats:
        url: nats://user:${NATS_PASSWORD_PROBE}@broker:4222
        subjects:
          - node:test1
          - state.>
      triggers:
        - bridge-agent-start
      """, fn ->
        # ${VAR} is expanded, which is how the credential stays out of a file
        # that lives in git.
        assert EventPipeline.url() == "nats://user:s3cret@broker:4222"
        assert EventPipeline.subjects() == ["node:test1", "state.>"]
        assert EventPipeline.enabled?()
      end)
    end

    test "an unset variable is not set, rather than the literal text" do
      System.delete_env("NOT_SET_ANYWHERE")

      with_rule("""
      service_type: screen_pop
      nats:
        url: ${NOT_SET_ANYWHERE}
        subjects:
          - node:test1
      triggers:
        - bridge-agent-start
      """, fn ->
        System.delete_env("NATS_URL")
        # Not a hostname called "${NOT_SET_ANYWHERE}".
        assert EventPipeline.url() == nil
        refute EventPipeline.enabled?()
      end)
    end

    test "a file that names nothing falls back to the environment" do
      with_rule("""
      service_type: screen_pop
      triggers:
        - bridge-agent-start
      """, fn ->
        System.put_env("NATS_URL", "nats://127.0.0.1:4222")
        System.put_env("NATS_SUBJECTS", " call_events , state.> ,,call_events")

        assert EventPipeline.url() == "nats://127.0.0.1:4222"
        assert EventPipeline.subjects() == ["call_events", "state.>"]
        assert EventPipeline.enabled?()
      end)
    end

    test "subjects alone are not enough: no broker, no pipeline" do
      with_rule("""
      service_type: screen_pop
      nats:
        subjects:
          - node:test1
      triggers:
        - bridge-agent-start
      """, fn ->
        System.delete_env("NATS_URL")
        assert EventPipeline.subjects() == ["node:test1"]
        refute EventPipeline.enabled?()
      end)
    end

    test "the live customer's file names its streams" do
      # The file the connectix destination actually mounts, not a fixture:
      # verified on 2026-09-17 that a real queue call arrives on this subject.
      path = Path.join(:code.priv_dir(:connectix), "pocketflow/customers/connectix.yaml")
      Application.put_env(:connectix, :customer_rule, path)
      Connectix.Realtime.PopRule.reload()

      assert "node:test1" in Connectix.Realtime.PopRule.subjects()
    end
  end

  # BOTH CLAUSES, and the nil one first. Without it `on_exit` called
  # `System.put_env(key, nil)`, which raises inside the cleanup — so the
  # variable was never restored and the NEXT test read this one's temp rule
  # file, which by then was deleted. One missing clause, two failures, neither
  # of them where the bug was.
  defp restore(key, nil), do: System.delete_env(key)
  defp restore(key, value), do: System.put_env(key, value)
end
