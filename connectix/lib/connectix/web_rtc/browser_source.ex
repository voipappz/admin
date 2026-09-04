defmodule Connectix.WebRtc.BrowserSource do
  @moduledoc """
  Membrane source feeding the **browser mic** into the SIP leg. Attaches to the
  `Connectix.WebRtc.Peer` (leg A), which forwards each PCMA payload as
  `{:browser_pcma, payload}`; we emit it as a packetized G.711 buffer that the
  RTP G.711 payloader sends on to Kamailio. Push flow control — the browser
  paces the packets (~20 ms each).
  """
  use Membrane.Source
  require Logger

  alias Membrane.{Buffer, G711, RemoteStream}

  def_output_pad(:output,
    accepted_format: %RemoteStream{type: :packetized, content_format: G711},
    flow_control: :push
  )

  def_options(key: [spec: atom(), default: :bridge, description: "WebRtc peer registry key"])

  @impl true
  def handle_init(_ctx, opts), do: {[], %{key: opts.key, count: 0}}

  @impl true
  def handle_playing(_ctx, state) do
    case Connectix.WebRtc.Peer.whereis(state.key) do
      nil -> Logger.warning("BrowserSource: no WebRTC peer at #{inspect(state.key)}")
      peer -> Connectix.WebRtc.Peer.forward_to(peer, self())
    end

    {[stream_format: {:output, %RemoteStream{type: :packetized, content_format: G711}}], state}
  end

  @impl true
  def handle_info({:browser_pcma, payload}, _ctx, state) do
    # Each PCMA packet is 20 ms (160 samples @ 8 kHz). RTP needs a monotonic
    # timestamp, so stamp pts in 20 ms steps — without it the RTP header
    # generator crashes computing (nil * clock_rate).
    pts = Membrane.Time.milliseconds(state.count * 20)
    buffer = %Buffer{payload: payload, pts: pts}
    {[buffer: {:output, buffer}], %{state | count: state.count + 1}}
  end

  def handle_info(_other, _ctx, state), do: {[], state}
end
