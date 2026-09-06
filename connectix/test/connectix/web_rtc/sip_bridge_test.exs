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

  # What the first real bot call (2026-09-06) taught, each pinned as a
  # callback driven directly — no registrar, no media, no network. The states
  # carry no remote tag and no INVITE transaction id, so `signal_hangup/1` has
  # nothing to send; what is under test is the state machine's verdict.
  describe "the media leg dying mid-call" do
    # One `:enetunreach` on an RTP packet crashed the media pipeline, the
    # linked MediaSession exited, and the catch-all EXIT clause stopped the
    # UA: no BYE, registration lost on restart, agent bridge and every Feline
    # processor taken down with it. A dead media leg is a failed call.
    test "ends the call and leaves the UA registered" do
      media = dead_pid()

      s = %SipBridge{
        status: :in_call,
        registered?: true,
        media_session: media,
        call_id: "c1",
        callee_uri: "sip:1000@example.com"
      }

      crash = {:membrane_child_crash, :udp, %RuntimeError{message: ":enetunreach"}}
      assert {:noreply, after_exit} = SipBridge.handle_info({:EXIT, media, crash}, s)

      assert after_exit.registered?, "the registration is not what failed"
      assert after_exit.status == :registered
      assert is_nil(after_exit.call_id)
      assert is_nil(after_exit.media_session)
    end

    test "an exit from any other linked process still stops the UA" do
      other = dead_pid()
      assert {:stop, :boom, _s} = SipBridge.handle_info({:EXIT, other, :boom}, %SipBridge{})
    end
  end

  describe "a BYE from the far end" do
    # parrot answers the BYE itself; `SipHandler.handle_bye/2` relays the
    # call-id here. Before the relay, a remote hang-up was acknowledged and
    # then ignored — the panel stayed on the call.
    test "ends the call it names" do
      s = %SipBridge{
        status: :in_call,
        registered?: true,
        call_id: "c1",
        callee_uri: "sip:1000@example.com"
      }

      assert {:noreply, ended} = SipBridge.handle_cast({:remote_bye, "c1"}, s)
      assert ended.status == :registered
      assert is_nil(ended.call_id)
    end

    test "for a dialog that is not the current call changes nothing" do
      s = %SipBridge{status: :in_call, call_id: "c2", callee_uri: "sip:1000@example.com"}
      assert {:noreply, ^s} = SipBridge.handle_cast({:remote_bye, "c1"}, s)
    end
  end

  describe "a retransmitted 200 to the INVITE" do
    # The far end retransmits its 200 until it sees our ACK. Re-running the
    # whole answer path on each one restarted media setup and re-stamped the
    # call record; the only correct response is another ACK.
    test "leaves a call that is already up untouched" do
      s = %SipBridge{status: :in_call, remote_tag: "r1", call_id: "c1", callee_uri: "sip:1000@example.com"}

      # No To tag at all: not our dialog's 200, so not even an ACK goes out —
      # which keeps this test off the network. A matching tag would re-ACK
      # and return the same state.
      assert ^s = SipBridge.dispatch(200, :invite, %{headers: %{}, body: ""}, s)
    end
  end

  describe "the UAS handler" do
    # parrot selects the callback with `function_exported?/3`, which does not
    # load the module, and nothing calls `SipHandler` before the first inbound
    # request. Under interactive code loading it was not loaded when the far
    # end's BYE arrived, and parrot answered 501 for a clause that exists.
    # `Transport.init/1` now loads it; this asks parrot's exact question.
    test "is loaded before the first inbound request can arrive" do
      assert function_exported?(Connectix.WebRtc.SipHandler, :handle_bye, 2),
             "SipHandler is not loaded — parrot will answer 501 to the far end's BYE"
    end
  end

  describe "the dialog route set" do
    # From the trace of the second bot call: the 200 carried
    # `Record-Route: <sip:35.157.19.1;lr=on;ftag=…>`, our ACK carried no Route
    # and went straight to the Contact behind that proxy, and FreeSWITCH ended
    # the call at 32 s with `408 ACK Timeout`. parrot leaves the header as the
    # raw string, so parsing it is the part worth pinning.
    @recorded "<sip:35.157.19.1;lr=on;ftag=ebff35df3c0fb568e110e2ad>"

    test "is the 200's Record-Route values, reversed, ready for a Route header" do
      response = %{headers: %{"record-route" => @recorded}}
      assert SipBridge.route_set_from(response) == [@recorded]

      two = %{headers: %{"record-route" => "<sip:first.example;lr>, <sip:second.example;lr>"}}
      assert SipBridge.route_set_from(two) == ["<sip:second.example;lr>", "<sip:first.example;lr>"]
    end

    test "is empty when the far end recorded no route" do
      assert SipBridge.route_set_from(%{headers: %{}}) == []
      assert SipBridge.route_set_from(%{headers: %{"record-route" => nil}}) == []
    end

    test "names the first hop as where an in-dialog request is sent" do
      assert SipBridge.route_hop([@recorded]) == {"35.157.19.1", 5060}
      assert SipBridge.route_hop(["<sip:proxy.example:5080;lr>"]) == {"proxy.example", 5080}
      assert SipBridge.route_hop([]) == nil
      assert SipBridge.route_hop(nil) == nil
    end
  end

  # A pid that has already exited, so an EXIT message about it is honest and
  # nothing here can accidentally signal a live process.
  defp dead_pid do
    pid = spawn(fn -> :ok end)
    ref = Process.monitor(pid)
    assert_receive {:DOWN, ^ref, :process, ^pid, _reason}
    pid
  end
end
