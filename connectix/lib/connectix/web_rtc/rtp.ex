defmodule Connectix.WebRtc.Rtp do
  @moduledoc """
  Pure RTP framing for the WebRTC bridge's SIP→browser direction.

  Building the outbound packet and advancing the `(sequence_number, timestamp)`
  counters is separated from `Connectix.WebRtc.Peer`'s ExWebRTC plumbing so the
  wraparound arithmetic — the easy place to slip an audio-corrupting off-by-one —
  is unit-testable without a live PeerConnection.

  G.711 (PCMA, payload type 8) @ 8 kHz, 20 ms frames → 160 samples/packet. The
  sequence number is a 16-bit counter; the timestamp is a 32-bit counter that
  advances by the samples-per-frame each packet. Both wrap, per RFC 3550.
  """

  import Bitwise

  alias ExRTP.Packet

  @payload_type 8
  @samples_per_frame 160
  @seq_mask 0xFFFF
  @ts_mask 0xFFFFFFFF

  @type counters :: %{seq: non_neg_integer(), ts: non_neg_integer(), ssrc: non_neg_integer()}

  @doc "Samples carried per 20 ms G.711 frame (8 kHz · 0.02 s)."
  @spec samples_per_frame() :: pos_integer()
  def samples_per_frame, do: @samples_per_frame

  @doc """
  Build the next outbound RTP packet for `payload` and return it together with the
  advanced counters. The sequence number wraps at 16 bits, the timestamp at 32
  bits (incremented by `samples_per_frame/0`).
  """
  @spec next_frame(binary(), counters()) :: {Packet.t(), counters()}
  def next_frame(payload, %{seq: seq, ts: ts, ssrc: ssrc} = counters) when is_binary(payload) do
    packet =
      Packet.new(payload,
        payload_type: @payload_type,
        sequence_number: seq,
        timestamp: ts,
        ssrc: ssrc,
        marker: false
      )

    {packet, %{counters | seq: seq + 1 &&& @seq_mask, ts: ts + @samples_per_frame &&& @ts_mask}}
  end
end
