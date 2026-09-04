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

  @impl true
  def handle_bye(_request, state), do: {:respond, 200, "OK", %{}, "", state}

  @impl true
  def handle_register(_request, state), do: {:respond, 501, "Not Implemented", %{}, "", state}
end
