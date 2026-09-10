defmodule Connectix.HeartbeatTest do
  @moduledoc """
  The push says WHY, which is the whole reason it beats a `curl` healthcheck:
  a healthcheck can only report a status code, so a full disk and a dead cable
  relay arrive as the same red dot.
  """

  use ExUnit.Case, async: false

  alias Connectix.Heartbeat

  defp with_env(pairs, fun) do
    previous = Map.new(pairs, fn {k, _v} -> {k, System.get_env(k)} end)

    Enum.each(pairs, fn
      {k, nil} -> System.delete_env(k)
      {k, v} -> System.put_env(k, v)
    end)

    try do
      fun.()
    after
      Enum.each(previous, fn
        {k, nil} -> System.delete_env(k)
        {k, v} -> System.put_env(k, v)
      end)
    end
  end

  describe "enabled?/0" do
    test "inert without a push url, so a deployment with no monitor is untouched" do
      with_env([{"UPTIME_KUMA_PUSH_URL", nil}], fn ->
        refute Heartbeat.enabled?()
        assert Heartbeat.children() == []
      end)
    end

    test "starts once a url is configured" do
      with_env([{"UPTIME_KUMA_PUSH_URL", "https://kuma.example.com/api/push/abc123"}], fn ->
        assert Heartbeat.enabled?()
        assert Heartbeat.children() == [Heartbeat]
      end)
    end

    # An empty string is how a deploy manifest spells "I have no value for
    # this", and it must not read as a configured URL.
    test "an empty url is unconfigured, not a url" do
      with_env([{"UPTIME_KUMA_PUSH_URL", ""}], fn -> refute Heartbeat.enabled?() end)
    end
  end

  describe "report/0" do
    test "names the failing check rather than reporting a bare status" do
      # No cable relay in the test env, so this is the real failure path.
      {status, message} = Heartbeat.report()

      assert status in [:up, :down]
      assert is_binary(message)
      assert message != ""

      if status == :down do
        assert message =~ ~r/cable relay|event store|disk/
      end
    end

    test "a healthy report still carries the number worth glancing at" do
      # Whatever this machine's state, the message is never empty and never a
      # bare "down" — Kuma shows it on the monitor.
      {_status, message} = Heartbeat.report()
      assert String.length(message) > 2
    end
  end
end
