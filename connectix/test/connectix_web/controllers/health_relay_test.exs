defmodule ConnectixWeb.HealthRelayTest do
  @moduledoc """
  Health must not call a silent portal healthy.

  NO BROKER MEANS NO EVENTS. Every user's state, every notification and the
  whole call firehose arrive on one subscription, so a portal without it pops
  no screens and stores nothing — while every other check stays green, because
  nothing else depends on it. That is the shape of failure this check exists
  for: not a crash, just silence that looks like a quiet switch.

  The earlier version of this check read `not enabled? or ready?`, which PASSED
  whenever the transport was DISABLED — the one state where nothing can
  possibly work. On nimbus-connectix that reported the relay ok for an hour
  while every socket upgrade was refused. The same trap is avoided here by
  reporting an unconfigured broker as down rather than as absent.
  """

  use ExUnit.Case, async: false
  import Plug.Test

  defp report do
    conn(:get, "/health")
    |> ConnectixWeb.HealthController.report(%{})
    |> then(&Jason.decode!(&1.resp_body))
  end

  defp without(vars, fun) do
    previous = Map.new(vars, &{&1, System.get_env(&1)})
    Enum.each(vars, &System.delete_env/1)

    try do
      fun.()
    after
      Enum.each(previous, fn
        {key, nil} -> System.delete_env(key)
        {key, value} -> System.put_env(key, value)
      end)
    end
  end

  test "an unconfigured broker is down, and says what that costs" do
    without(["NATS_URL", "NATS_SUBJECTS"], fn ->
      refute Connectix.Realtime.EventPipeline.enabled?()

      body = report()
      nats = body["checks"]["nats"]

      assert nats["status"] == "down",
             "a portal with no broker consumes nothing; health must not call that ok"

      assert nats["detail"] =~ "no events"

      assert body["status"] == "degraded"
      refute body["ready"]
    end)
  end

  test "a broker named but not subscribed is down too" do
    # Configured-but-not-subscribed is the failure worth seeing: the URL is
    # right, the subjects are named, and the producer never got a subscription.
    without([], fn ->
      System.put_env("NATS_URL", "nats://127.0.0.1:4222")
      System.put_env("NATS_SUBJECTS", "node:test1")

      on_exit(fn ->
        System.delete_env("NATS_URL")
        System.delete_env("NATS_SUBJECTS")
      end)

      assert Connectix.Realtime.EventPipeline.enabled?()

      nats = report()["checks"]["nats"]
      assert nats["status"] == "down"
      assert nats["detail"] =~ "not up"
    end)
  end
end
