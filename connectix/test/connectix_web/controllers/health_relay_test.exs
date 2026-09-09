defmodule ConnectixWeb.HealthRelayTest do
  @moduledoc """
  Health must not call a dead relay healthy.

  NO RELAY MEANS NO EVENTS. CallEvents and the per-user state streams both
  arrive over it, so a portal without one cannot pop a screen, verify a token,
  or open `/ws/events` — while `/auth` keeps working over the HTTP fallback,
  which is why the failure presents as "login succeeds, then the socket 401s".

  The check used to read `not enabled? or ready?`, which PASSED whenever the
  relay was disabled — the one state where nothing can possibly work. On
  nimbus-connectix that reported `api_relay: ok` for an hour while every
  socket upgrade was refused for want of a secret to mint cable tokens with.
  """

  use ExUnit.Case, async: false
  import Plug.Test

  defp report do
    conn(:get, "/health")
    |> ConnectixWeb.HealthController.report(%{})
    |> then(&Jason.decode!(&1.resp_body))
  end

  defp without_cable(fun) do
    previous = System.get_env("CABLE_URL")
    System.delete_env("CABLE_URL")

    try do
      fun.()
    after
      if previous, do: System.put_env("CABLE_URL", previous)
    end
  end

  test "a disabled relay is down, and says why" do
    without_cable(fn ->
      refute Connectix.Realtime.ApiProxy.enabled?()

      body = report()
      relay = body["checks"]["api_relay"]

      assert relay["status"] == "down",
             "a portal with no relay cannot consume events; health must not call that ok"

      assert relay["detail"] =~ "cannot consume events"
      assert relay["detail"] =~ "relay disabled"

      assert body["status"] == "degraded"
      refute body["ready"]
    end)
  end

  test "the cable check is down for the same reason" do
    without_cable(fn ->
      assert report()["checks"]["cable"]["status"] == "down"
    end)
  end
end
