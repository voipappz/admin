defmodule Connectix.WebRtc.SipBridgeTest do
  @moduledoc """
  What the SIP UA promises without a network: that it tells the truth about
  registration, and refuses to dial when it has none.

  Everything here runs against the singleton already in the supervision tree
  and sends no packets. The parts that need a registrar — the digest retry, the
  INVITE dialog — are exercised by hand against a real account; this pins the
  behaviour that was wrong *before* any of that, and that a reader cannot see
  by looking at a passing call.
  """

  use ExUnit.Case, async: false

  alias Connectix.WebRtc.SipBridge

  describe "registration honesty" do
    test "a UA that has not registered says so" do
      # `status` is a *call* state and teardown resets it; `registered?` is what
      # the registrar actually decided. Conflating them let a REGISTER answered
      # `403 Forbidden` report itself as registered, and the first visible
      # symptom was a `404` on the next INVITE — which reads as "no such
      # number" and sends you looking in entirely the wrong place.
      state = SipBridge.get_state()

      assert is_boolean(state.registered?)
      refute state.registered?, "the test suite never registers, so this must be false"
    end

    test "the call status and the registration verdict are separate fields" do
      state = SipBridge.get_state()

      assert Map.has_key?(state, :status)
      assert Map.has_key?(state, :registered?)
    end
  end

  describe "dial/2 without a registration" do
    test "refuses instead of emitting an INVITE that cannot succeed" do
      # Dialing unregistered does not fail honestly: the registrar answers the
      # INVITE `404 Not Found` because it does not know the caller. Refusing
      # here is what lets the panel say "not registered" rather than showing a
      # number-not-found error for an account problem.
      assert {:error, reason} = SipBridge.dial("1000")
      assert reason in [:not_registered, :sip_not_configured]
    end

    test "refuses a full SIP URI on the same grounds" do
      assert {:error, reason} = SipBridge.dial("sip:1000@example.com")
      assert reason in [:not_registered, :sip_not_configured]
    end

    test "refusing does not leave the UA mid-call" do
      _ = SipBridge.dial("1000")
      state = SipBridge.get_state()

      assert state.status in [:idle, :registered]
      assert is_nil(state.call_id)
    end
  end
end
