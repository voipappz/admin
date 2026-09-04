defmodule Connectix.WebRtc.BrowserSink do
  @moduledoc """
  Membrane sink carrying the **SIP audio** (depayloaded G.711 from Kamailio) out
  to the browser. Each buffer's PCMA payload is handed to the `Connectix.WebRtc.Peer`
  (leg A) via `play/2`, which wraps it in an RTP packet on the browser's PCMA
  track. No transcoding — both legs are G.711.
  """
  use Membrane.Sink
  require Logger

  alias Membrane.{G711, RemoteStream}

  def_input_pad(:input,
    accepted_format: %RemoteStream{type: :packetized, content_format: G711},
    flow_control: :auto
  )

  def_options(key: [spec: atom(), default: :bridge, description: "WebRtc peer registry key"])

  @impl true
  def handle_init(_ctx, opts), do: {[], %{key: opts.key, peer: nil}}

  @impl true
  def handle_playing(_ctx, state) do
    peer = Connectix.WebRtc.Peer.whereis(state.key)
    if is_nil(peer), do: Logger.warning("BrowserSink: no WebRTC peer at #{inspect(state.key)}")
    {[], %{state | peer: peer}}
  end

  @impl true
  def handle_buffer(:input, buffer, _ctx, state) do
    if state.peer, do: Connectix.WebRtc.Peer.play(state.peer, buffer.payload)
    {[], state}
  end
end
