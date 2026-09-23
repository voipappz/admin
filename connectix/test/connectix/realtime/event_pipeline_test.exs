defmodule Connectix.Realtime.EventPipelineTest do
  # NOT async. The rule file is cached in one `:persistent_term` for the node
  # and these tests swap it, so running them beside anything that reads a rule
  # leaves the other test looking at this one's file.
  use ExUnit.Case, async: false

  alias Connectix.Realtime.EventPipeline
  alias Connectix.Realtime.FreeSwitch
  alias Connectix.Realtime.PopRule

  describe "route/2" do
    # Every handler is this process, so the hand-off is whichever cast arrives.
    defp ctx, do: %{events: self(), screen_pop: self(), user_streams: self()}

    test "every frame goes to the pop evaluator, which stores it and gates it" do
      EventPipeline.route(%{"action" => "bridge-agent-start", "id" => "e1"}, ctx())
      assert_receive {:"$gen_cast", {:event, %{"action" => "bridge-agent-start", "id" => "e1"}}}

      EventPipeline.route(%{"action" => "CHANNEL_HANGUP_COMPLETE"}, ctx())
      assert_receive {:"$gen_cast", {:event, %{"action" => "CHANNEL_HANGUP_COMPLETE"}}}
    end
  end

  describe "configuration, from the rule file" do
    setup do
      previous = %{"ESL_URL" => System.get_env("ESL_URL")}
      customer = Application.get_env(:connectix, :customer_rule)

      on_exit(fn ->
        Enum.each(previous, fn {k, v} -> restore(k, v) end)
        Application.put_env(:connectix, :customer_rule, customer)
        PopRule.reload()
      end)

      :ok
    end

    defp with_rule(yaml, fun) do
      path = Path.join(System.tmp_dir!(), "rule_#{System.unique_integer([:positive])}.yaml")
      File.write!(path, yaml)
      # The switch is the CUSTOMER's layer: this stands in for the mounted
      # file, over the shipped shared policy.
      Application.put_env(:connectix, :customer_rule, path)
      PopRule.reload()

      try do
        fun.()
      after
        File.rm(path)
      end
    end

    test "the switch, its credential and its events all come from the file" do
      System.put_env("FS_HOST_PROBE", "192.0.2.10")
      System.put_env("FS_PASSWORD_PROBE", "s3cret")
      System.delete_env("ESL_URL")

      with_rule("""
      service_type: screen_pop
      freeswitch:
        host: ${FS_HOST_PROBE}
        port: 9021
        password: ${FS_PASSWORD_PROBE}
        events:
          - HEARTBEAT
          - CUSTOM callcenter::info
      triggers:
        - bridge-agent-start
      """, fn ->
        # ${VAR} is expanded, which is how the credential stays out of a file
        # that lives in git.
        assert FreeSwitch.settings() == %{
                 host: "192.0.2.10",
                 port: 9021,
                 password: "s3cret",
                 events: ["HEARTBEAT", "CUSTOM callcenter::info"]
               }

        assert EventPipeline.events() == ["HEARTBEAT", "CUSTOM callcenter::info"]
        assert EventPipeline.enabled?()
      end)
    end

    test "an unset host variable is not set, rather than the literal text" do
      System.delete_env("NOT_SET_ANYWHERE")
      System.delete_env("ESL_URL")

      with_rule("""
      service_type: screen_pop
      freeswitch:
        host: ${NOT_SET_ANYWHERE}
        password: pw
      triggers:
        - bridge-agent-start
      """, fn ->
        # Not a hostname called "${NOT_SET_ANYWHERE}".
        assert PopRule.freeswitch().host == nil
        assert FreeSwitch.settings() == nil
        refute EventPipeline.enabled?()
      end)
    end

    test "a file that names no host falls back to ESL_URL, keeping the file's events" do
      with_rule("""
      service_type: screen_pop
      freeswitch:
        events:
          - CUSTOM callcenter::info
      triggers:
        - bridge-agent-start
      """, fn ->
        System.put_env("ESL_URL", "esl://:pw@127.0.0.1:8021")

        assert FreeSwitch.settings() == %{
                 host: "127.0.0.1",
                 port: 8021,
                 password: "pw",
                 events: ["CUSTOM callcenter::info"]
               }

        assert EventPipeline.enabled?()
      end)
    end

    test "with no events named anywhere, the defaults apply" do
      with_rule("""
      service_type: screen_pop
      freeswitch:
        events: []
      triggers:
        - bridge-agent-start
      """, fn ->
        System.put_env("ESL_URL", "esl://:pw@127.0.0.1:8021")
        assert EventPipeline.events() == FreeSwitch.default_events()
      end)
    end

    test "a password alone is not a switch: no host, no pipeline" do
      System.delete_env("ESL_URL")

      with_rule("""
      service_type: screen_pop
      freeswitch:
        password: pw
      triggers:
        - bridge-agent-start
      """, fn ->
        refute EventPipeline.enabled?()
        assert EventPipeline.events() == []
      end)
    end

    test "the live customer's file names its switch" do
      # The file the connectix destination actually mounts, not a fixture.
      path = Path.join(:code.priv_dir(:connectix), "pocketflow/customers/connectix.yaml")
      Application.put_env(:connectix, :customer_rule, path)
      PopRule.reload()

      assert PopRule.freeswitch().host == "194.36.89.216"
      assert PopRule.freeswitch().port == 8021
    end
  end

  # BOTH CLAUSES, and the nil one first. Without it `on_exit` called
  # `System.put_env(key, nil)`, which raises inside the cleanup — so the
  # variable was never restored and the NEXT test read this one's temp rule
  # file, which by then was deleted.
  defp restore(key, nil), do: System.delete_env(key)
  defp restore(key, value), do: System.put_env(key, value)
end
