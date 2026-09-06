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

  describe "a registration refresh during a call" do
    # The UA re-REGISTERs every 60s to keep the binding and the NAT pinhole
    # open. That timer does not know or care that a call is up, so every
    # registration outcome has to be harmless to one — and none of this is
    # visible from a call that succeeds, because the first refresh lands a
    # minute in. A call shorter than that looked perfect while every longer
    # one broke.
    setup do
      %{
        in_call: %SipBridge{
          status: :in_call,
          registered?: true,
          call_id: "call-abc",
          callee_uri: "sip:1000@example.com",
          remote_tag: "remote-1",
          local_tag: "local-1",
          invite_cseq: 3,
          cseq: 4,
          reg_cseq: 2
        }
      }
    end

    test "a 200 leaves the call's status alone", %{in_call: s} do
      after_refresh = SipBridge.dispatch(200, :register, nil, s)

      assert after_refresh.status == :in_call,
             "a refresh took the call off the panel — no hang-up control, and " <>
               "the invite_timeout guard stops matching"

      assert after_refresh.registered?
    end

    test "a 200 does not rewind the dialog's CSeq", %{in_call: s} do
      after_refresh = SipBridge.dispatch(200, :register, nil, s)

      assert after_refresh.cseq == s.cseq,
             "the in-dialog CSeq moved; the BYE that follows would be out of order"

      assert after_refresh.invite_cseq == s.invite_cseq
    end

    test "a refused refresh does not tear the call down", %{in_call: s} do
      after_refusal = SipBridge.dispatch(403, :register, %{reason_phrase: "Forbidden"}, s)

      assert after_refusal.status == :in_call
      assert after_refusal.call_id == "call-abc"
      refute after_refusal.registered?, "the registrar refused; say so"
    end

    test "an auth challenge on the refresh is not read as the INVITE's auth loop", %{in_call: s} do
      # The INVITE's own digest retry sets its flag and leaves it set until the
      # 200. A registrar challenges every REGISTER, so with one shared flag the
      # refresh's ordinary 401 was the "second 401" — and giving up called
      # `fail/3`, which ends the call while the far end keeps ringing.
      mid_call = %{s | invite_auth_retried: true, reg_auth_retried: false}

      after_challenge =
        SipBridge.dispatch(401, :register, %{headers: %{}, reason_phrase: "Unauthorized"}, mid_call)

      assert after_challenge.status == :in_call
      assert after_challenge.call_id == "call-abc"
    end

    test "the two transactions keep separate CSeq counters", %{in_call: s} do
      # A REGISTER mints its own Call-ID, so it is not in the INVITE's dialog
      # and its sequence is its own. Sharing one counter is what let a refresh
      # rewind the dialog.
      challenged =
        SipBridge.dispatch(
          401,
          :register,
          %{headers: %{"www-authenticate" => nil}, reason_phrase: "Unauthorized"},
          s
        )

      assert challenged.cseq == s.cseq, "the dialog's counter moved on a REGISTER challenge"
    end
  end

  describe "call_in_progress?/1" do
    test "an INVITE that has gone out but not been answered counts" do
      # `status` is still :calling and there is no remote tag yet, but the
      # dialog is forming: a registration outcome must not speak for it.
      assert SipBridge.call_in_progress?(%SipBridge{status: :calling, call_id: "c1"})
      assert SipBridge.call_in_progress?(%SipBridge{status: :ringing, call_id: "c1"})
    end

    test "a registered idle UA does not" do
      refute SipBridge.call_in_progress?(%SipBridge{status: :registered, registered?: true})
      refute SipBridge.call_in_progress?(%SipBridge{status: :idle})
    end
  end
end
