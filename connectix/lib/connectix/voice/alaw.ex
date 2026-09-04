defmodule Connectix.Voice.Alaw do
  @moduledoc """
  G.711 A-law ↔ linear PCM, and the 20 ms framing the SIP leg needs.

  The SIP leg is PCMA: 160 bytes per 20 ms packet, 8 kHz, mono. Feline is
  s16le PCM and does no conversion of any kind — it expects the transport to
  hand it correctly-shaped audio. This module is that conversion, and it is
  pure so it can be tested without a call.

  The lookup tables are `Membrane.G711.LUT`'s, already a dependency via
  `membrane_g711_plugin` — the same tables `Membrane.G711.Decoder`/`Encoder`
  use. We call them directly rather than putting Membrane elements in the
  path because the audio is crossing a process boundary here, not a pipeline
  pad.
  """

  alias Membrane.G711.LUT

  # 8 kHz × 20 ms × 1 byte/sample (A-law is 8-bit).
  @frame_bytes 160

  @doc "Bytes in one 20 ms A-law frame."
  @spec frame_bytes() :: pos_integer()
  def frame_bytes, do: @frame_bytes

  @doc """
  A-law → signed 16-bit little-endian PCM. One input byte becomes two output
  bytes, so a 160-byte SIP packet becomes 320 bytes of PCM.
  """
  @spec decode(binary()) :: binary()
  def decode(alaw) when is_binary(alaw) do
    for <<sample::8 <- alaw>>, into: <<>> do
      <<LUT.alaw_decode(sample)::integer-signed-little-16>>
    end
  end

  @doc """
  Signed 16-bit little-endian PCM → A-law. A trailing odd byte is dropped
  rather than raising: TTS chunk boundaries are arbitrary, and a half sample
  at the end of a chunk is not worth taking a live call down for.
  """
  @spec encode(binary()) :: binary()
  def encode(pcm) when is_binary(pcm) do
    for <<sample::integer-signed-little-16 <- pcm>>, into: <<>> do
      <<LUT.alaw_encode(sample)>>
    end
  end

  @doc """
  One 20 ms frame of A-law silence.

  Sent on every tick the outbound buffer is empty. That is not cosmetic:
  `Connectix.WebRtc.BrowserSource` derives each buffer's RTP presentation
  timestamp from a packet *count* (`count * 20 ms`), so a skipped packet
  makes the RTP clock lag wall-clock for the rest of the call. Keeping the
  cadence unbroken keeps the two in step.
  """
  @spec silence_frame() :: binary()
  def silence_frame, do: :binary.copy(<<LUT.alaw_encode(0)>>, @frame_bytes)

  @doc """
  Pop one 20 ms frame off the front of an A-law buffer.

  Returns `{nil, buffer}` when there is not yet a whole frame — Cartesia's
  chunk boundaries are arbitrary and never 20 ms aligned, so partial frames
  are the normal case, not an error.
  """
  @spec pop_frame(binary()) :: {binary() | nil, binary()}
  def pop_frame(<<frame::binary-size(@frame_bytes), rest::binary>>), do: {frame, rest}
  def pop_frame(buffer) when is_binary(buffer), do: {nil, buffer}
end
