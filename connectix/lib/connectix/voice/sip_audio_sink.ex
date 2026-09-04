defmodule Connectix.Voice.SipAudioSink do
  @moduledoc """
  Tail of the SIP-side Feline pipeline: takes the bot's synthesized speech and
  hands it to the `Connectix.Voice.SipCallBridge` that owns the call.

  This is the SIP analogue of `Feline.Transports.WebSocket.Output`, minus the
  pipecat wire protocol. It does no conversion and no pacing — the owner does
  both, because pacing has to survive this processor being torn down and
  restarted mid-call.

  Two frames matter:

    * `TTSAudioRawFrame` — the bot speaking. Forwarded as raw PCM.
    * `InterruptionFrame` — barge-in. Forwarded as a flush *before* being
      passed on, so the buffered tail of a sentence the caller talked over is
      dropped rather than played after they stop.
  """

  use Feline.Processor

  alias Feline.Frames.All.{InterruptionFrame, TTSAudioRawFrame}

  @impl true
  def init(opts), do: {:ok, %{owner: Keyword.fetch!(opts, :owner)}}

  @doc "Pipeline entry for this processor, owned by `owner`."
  @spec spec(pid()) :: {module(), keyword()}
  def spec(owner), do: {__MODULE__, owner: owner}

  @impl true
  def handle_frame(%TTSAudioRawFrame{audio: pcm, sample_rate: rate}, :downstream, _ctx, state) do
    send(state.owner, {:bot_audio, pcm, rate})
    {:ok, state}
  end

  def handle_frame(%InterruptionFrame{} = frame, direction, _ctx, state) do
    send(state.owner, :bot_interrupted)
    {:push, frame, direction, state}
  end

  def handle_frame(frame, direction, _ctx, state), do: {:push, frame, direction, state}
end
