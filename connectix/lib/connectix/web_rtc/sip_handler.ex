defmodule Connectix.WebRtc.SipHandler do
  @moduledoc """
  The UAS callback module `Connectix.WebRtc.Transport`'s UDP listener requires
  structurally, even though this bridge only places outbound calls (UAC) for
  now — `Parrot.Sip.Transport.StateMachine.start_udp/1` needs a handler
  regardless of whether inbound calls are supported.

  Answering an inbound INVITE (someone calling the bridged extension back) is
  future work — refuse everything cleanly rather than leaving it unhandled.
  """
  use Parrot.UasHandler

  require Logger

  @impl true
  def handle_invite(_request, state) do
    Logger.info("WebRtc.SipHandler: inbound INVITE refused — no UAS support yet")
    {:respond, 480, "Temporarily Unavailable", %{}, "", state}
  end

  @impl true
  def handle_ack(_request, state), do: {:noreply, state}

  # The far end hung up. Answer 200 here — parrot owns the transaction — and
  # tell the UA which dialog ended, so the call is torn down on our side too.
  # Without the relay the BYE was acknowledged and then ignored: the panel
  # stayed on the call and the media leg kept streaming into a closed socket.
  @impl true
  def handle_bye(request, state) do
    Connectix.WebRtc.SipBridge.remote_bye(request.headers["call-id"])
    {:respond, 200, "OK", %{}, "", state}
  end

  @impl true
  def handle_register(_request, state), do: {:respond, 501, "Not Implemented", %{}, "", state}
end
