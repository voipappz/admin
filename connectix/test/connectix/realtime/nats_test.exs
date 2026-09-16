defmodule Connectix.Realtime.NatsTest do
  use ExUnit.Case, async: true

  alias Connectix.Realtime.Nats

  describe "settings/1" do
    test "nil when unset" do
      assert Nats.settings(nil) == nil
    end

    test "host and port, defaulting the port" do
      assert Nats.settings("nats://nats:4222") == %{host: "nats", port: 4222}
      assert Nats.settings("nats://broker") == %{host: "broker", port: 4222}
    end

    test "user:pass userinfo becomes credentials" do
      assert Nats.settings("nats://default:s3cret@nats:4222") == %{
               host: "nats",
               port: 4222,
               username: "default",
               password: "s3cret",
               auth_required: true
             }
    end

    test "bare userinfo is a token" do
      assert Nats.settings("nats://tok@nats:4222") == %{
               host: "nats",
               port: 4222,
               token: "tok",
               auth_required: true
             }
    end
  end
end
