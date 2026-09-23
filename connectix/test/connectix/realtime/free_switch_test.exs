defmodule Connectix.Realtime.FreeSwitchTest do
  use ExUnit.Case, async: true

  alias Connectix.Realtime.FreeSwitch

  describe "settings/1 — ESL_URL" do
    test "nil when unset" do
      assert FreeSwitch.settings(nil) == nil
    end

    test "host and port, defaulting the port to 8021" do
      assert %{host: "switch", port: 8021, password: nil} = FreeSwitch.settings("esl://switch")
      assert %{host: "switch", port: 9021} = FreeSwitch.settings("esl://switch:9021")
    end

    test "the password is the userinfo, with or without the colon" do
      assert %{password: "s3cret"} = FreeSwitch.settings("esl://:s3cret@switch:8021")
      assert %{password: "s3cret"} = FreeSwitch.settings("esl://s3cret@switch:8021")
    end

    test "a url with no host is not a switch" do
      assert FreeSwitch.settings("esl://") == nil
    end

    test "carries the default events" do
      assert FreeSwitch.settings("esl://switch").events == FreeSwitch.default_events()
    end
  end

  describe "event_command/1" do
    # `mod_event_socket` reads the words left to right and treats every word
    # after CUSTOM as a subclass — so `CUSTOM callcenter::info HEARTBEAT` would
    # subscribe to a subclass called HEARTBEAT and never see a heartbeat.
    test "plain names first, then one CUSTOM with every subclass" do
      assert FreeSwitch.event_command(["CUSTOM callcenter::info", "HEARTBEAT"]) ==
               "HEARTBEAT CUSTOM callcenter::info"

      assert FreeSwitch.event_command([
               "CUSTOM callcenter::info",
               "HEARTBEAT",
               "CUSTOM sofia::register",
               "CHANNEL_HANGUP_COMPLETE"
             ]) == "HEARTBEAT CHANNEL_HANGUP_COMPLETE CUSTOM callcenter::info sofia::register"
    end

    test "no CUSTOM entries means no CUSTOM word" do
      assert FreeSwitch.event_command(["HEARTBEAT"]) == "HEARTBEAT"
    end

    test "duplicates collapse" do
      assert FreeSwitch.event_command(["HEARTBEAT", "HEARTBEAT", "CUSTOM a::b", "CUSTOM a::b"]) ==
               "HEARTBEAT CUSTOM a::b"
    end
  end

  describe "address/1" do
    test "names the switch and never the password" do
      settings = FreeSwitch.settings("esl://:s3cret@switch:8021")
      assert FreeSwitch.address(settings) == "esl://switch:8021"
      assert FreeSwitch.address(nil) == nil
    end
  end

  describe "connect/1" do
    test "refuses without a password rather than being denied by the switch" do
      assert FreeSwitch.connect(%{host: "127.0.0.1", port: 1, password: nil, events: []}) ==
               {:error, :no_password}
    end

    test "a closed port is an error, not a crash" do
      # Port 1 is never an Event Socket.
      assert {:error, _reason} =
               FreeSwitch.connect(%{host: "127.0.0.1", port: 1, password: "pw", events: []})
    end
  end
end
