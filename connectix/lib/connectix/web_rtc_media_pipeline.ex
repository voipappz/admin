defmodule Connectix.WebRtcMediaPipeline do
  @moduledoc """
  Leg B of the SIP↔WebRTC gateway: the **SIP side** to Kamailio. Selected with
  `audio_source: :webrtc` on the parrot UA; parrot's MediaSession hands us the
  negotiated RTP ports, so we own that socket and bridge it to the browser leg
  (`Connectix.WebRtc.Peer`, leg A) — both G.711 A-law, so it's a pure payload relay:

      Kamailio RTP (PCMA) → depayload → BrowserSink → Peer → browser
      browser → Peer → BrowserSource → payload → RTP (PCMA) → Kamailio

  """
  use Membrane.Pipeline
  require Logger

  alias Connectix.WebRtc.{BrowserSink, BrowserSource}
  alias Membrane.RTP

  @impl true
  def handle_init(_ctx, opts) do
    opts = Map.new(opts)

    Logger.info(
      "WebRtcMediaPipeline: session #{opts.session_id} ↔ Kamailio " <>
        "#{opts.remote_rtp_address}:#{opts.remote_rtp_port}"
    )

    ssrc = :rand.uniform(0xFFFFFFFF)
    dest_ip = parse_ip(opts.remote_rtp_address)
    # Which browser peer (leg A) to bridge. Defaults to the single active call;
    # parameterized so independent legs (e.g. two extensions) can coexist.
    key = Map.get(opts, :key, :bridge)

    spec = [
      child(:udp, %Membrane.UDP.Endpoint{
        local_port_no: opts.local_rtp_port,
        destination_port_no: opts.remote_rtp_port,
        destination_address: dest_ip,
        # Symmetric RTP (rtpengine "latch"): outbound follows the source of the last
        # inbound packet, so NAT'd peers get two-way audio. Public option → no core
        # change, upgrade-safe.
        latch?: true
      }),
      child(:rtp, %RTP.SessionBin{fmt_mapping: %{8 => {"PCMA", 8000}}}),

      # Inbound: Kamailio RTP → rtp session (depayload happens on :new_rtp_stream).
      get_child(:udp)
      |> via_in(Pad.ref(:rtp_input, make_ref()))
      |> get_child(:rtp),

      # Outbound: browser mic (PCMA, leg A) → RTP payload → Kamailio.
      child(:from_browser, %BrowserSource{key: key})
      |> via_in(Pad.ref(:input, ssrc), options: [payloader: RTP.G711.Payloader])
      |> get_child(:rtp)
      |> via_out(Pad.ref(:rtp_output, ssrc), options: [encoding: :PCMA])
      |> get_child(:udp)
    ]

    {[spec: spec], %{session_id: opts.session_id, ssrc: ssrc, key: key}}
  end

  # Inbound Kamailio RTP stream → depayload → browser (leg A), built once the SSRC is known.
  @impl true
  def handle_child_notification({:new_rtp_stream, ssrc, _pt, _ext}, :rtp, _ctx, state) do
    Logger.info("WebRtcMediaPipeline #{state.session_id}: SIP RTP stream #{ssrc} → browser")

    spec = [
      get_child(:rtp)
      |> via_out(Pad.ref(:output, ssrc), options: [depayloader: RTP.G711.Depayloader])
      |> child({:to_browser, ssrc}, %BrowserSink{key: state.key})
    ]

    {[spec: spec], state}
  end

  def handle_child_notification(_msg, _child, _ctx, state), do: {[], state}

  defp parse_ip(addr) do
    case addr |> to_string() |> String.to_charlist() |> :inet.parse_address() do
      {:ok, ip} -> ip
      _ -> raise "WebRtcMediaPipeline: bad remote RTP address #{inspect(addr)}"
    end
  end
end
