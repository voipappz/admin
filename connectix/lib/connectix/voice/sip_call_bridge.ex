defmodule Connectix.Voice.SipCallBridge do
  @moduledoc """
  Puts the bot on the phone.

  It stands exactly where `Connectix.WebRtc.Peer` stands — registered in
  `Connectix.WebRtc.Registry` under the same `:bridge` key, answering the same
  two casts — so `Connectix.WebRtcMediaPipeline`, `BrowserSink` and
  `BrowserSource` cannot tell the difference and needed no changes at all. A
  call is bridged to the browser or to the bot by which process is sitting in
  that slot, and nothing else.

      SIP  --{:play, alaw}-->  this  --InputAudioRawFrame-->  Deepgram → Sagents
      SIP  <--{:browser_pcma}-- this  <--{:bot_audio, pcm}--  Cartesia ← Sagents

  ## The pipeline starts on answer, not on dial

  `Connectix.Voice.SagentsBridge`'s greeting is pushed from `handle_setup`,
  i.e. the moment the pipeline starts. Starting it at dial time would have the
  bot greet a phone that is still ringing, and Cartesia would synthesize into
  a call nobody had picked up. So the process registers at dial time — the
  media pipeline's registry lookup happens then and must succeed — but the
  Feline pipeline is started by `answered/1`, from the `200 OK`.

  ## Pacing is here, not in the pipeline

  Cartesia emits audio in chunks of whatever length it likes, and RTP wants a
  packet every 20 ms. So TTS audio is buffered and drained on a timer, one
  160-byte A-law frame per tick, with silence sent when the buffer is empty to
  keep `BrowserSource`'s packet-counted RTP clock in step with wall-clock.

  A barge-in drops the buffer: the caller talked over a sentence, so the rest
  of that sentence must not play after they stop.
  """

  use GenServer
  require Logger

  alias Connectix.Voice.{Alaw, FelinePipeline}
  alias Feline.Frames.All.InputAudioRawFrame
  alias Feline.Pipeline.Task, as: PipelineTask

  # One RTP packet per 20 ms, matching the SIP leg.
  @tick_ms 20
  @sip_rate 8_000

  # ── Public API ──────────────────────────────────────────────────────────────

  def start_link(opts) do
    key = Keyword.get(opts, :key, :bridge)
    GenServer.start_link(__MODULE__, opts, name: {:via, Registry, {Connectix.WebRtc.Registry, key}})
  end

  @doc "The callee picked up: start the bot and the outbound clock."
  @spec answered(GenServer.server()) :: :ok
  def answered(bridge), do: GenServer.cast(bridge, :answered)

  # ── GenServer ────────────────────────────────────────────────────────────────

  @impl true
  def init(opts) do
    Process.flag(:trap_exit, true)

    {:ok,
     %{
       scope: Keyword.fetch!(opts, :scope),
       conversation_id: Keyword.fetch!(opts, :conversation_id),
       pipeline_opts: Keyword.take(opts, [:greeting, :turns]),
       task: nil,
       sip_src: nil,
       frames_in: 0,
       out: <<>>,
       timer: nil,
       next_tick: nil,
       warned_rate?: false
     }}
  end

  @impl true
  def handle_cast(:answered, %{task: task} = state) when not is_nil(task), do: {:noreply, state}

  def handle_cast(:answered, state) do
    case FelinePipeline.sip_pipeline(
           state.scope,
           state.conversation_id,
           self(),
           state.pipeline_opts
         ) do
      {:ok, task} ->
        Logger.info("[call] bot pipeline up for conversation #{state.conversation_id}")
        {:noreply, start_clock(%{state | task: task})}

      error ->
        # The call is up; the bot is not. Say so loudly — the caller will hear
        # silence and nothing else explains it.
        Logger.error("[call] bot pipeline failed to start: #{inspect(error)}")
        {:noreply, state}
    end
  end

  # `Connectix.WebRtc.BrowserSource` attaching, exactly as it does to a Peer.
  def handle_cast({:forward_to, sip_src}, state) do
    {:noreply, %{state | sip_src: sip_src}}
  end

  # SIP audio in. A-law → PCM → the pipeline's ears.
  def handle_cast({:play, payload}, %{task: task} = state) when not is_nil(task) do
    frame = %InputAudioRawFrame{
      audio: Alaw.decode(payload),
      sample_rate: @sip_rate,
      num_channels: 1
    }

    PipelineTask.queue_frame(task, frame, :downstream)
    Connectix.Telemetry.call_audio(:in)

    # Deepgram closes an idle socket after about ten seconds, so "no
    # transcription" has two very different causes that look identical from the
    # outside: the caller said nothing, or their audio never reached us at all.
    # Saying so once, on the first frame, separates them without narrating
    # every one of the fifty that arrive each second.
    if state.frames_in == 0 do
      Logger.info("[call] inbound audio reaching the bot (#{byte_size(payload)} bytes/frame)")
    end

    {:noreply, %{state | frames_in: state.frames_in + 1}}
  end

  # Audio before the pipeline exists (ringing, or a failed start) has nowhere
  # to go. Dropping it is correct; buffering it would greet the bot with a
  # backlog of ringback the moment it starts.
  def handle_cast({:play, _payload}, state), do: {:noreply, state}

  def handle_cast(_other, state), do: {:noreply, state}

  @impl true
  def handle_info({:bot_audio, pcm, rate}, state) do
    state = warn_once_on_rate(state, rate)
    {:noreply, %{state | out: state.out <> Alaw.encode(pcm)}}
  end

  def handle_info(:bot_interrupted, state), do: {:noreply, %{state | out: <<>>}}

  def handle_info(:tick, state) do
    {frame, out} = Alaw.pop_frame(state.out)
    payload = frame || Alaw.silence_frame()

    if state.sip_src do
      send(state.sip_src, {:browser_pcma, payload})
      # Counted whether it carries speech or the silence frame: a caller hearing
      # nothing while this ticks means the bot produced no audio, which is a
      # different fault from the frames never leaving.
      Connectix.Telemetry.call_audio(:out)
    end

    {:noreply, schedule_tick(%{state | out: out})}
  end

  # The Feline task is linked; if it dies the call keeps its audio path but
  # goes quiet. Log it rather than taking the call down under the caller.
  def handle_info({:EXIT, pid, reason}, %{task: pid} = state) do
    Logger.error("[call] bot pipeline exited: #{inspect(reason)}")
    {:noreply, %{state | task: nil}}
  end

  def handle_info(_other, state), do: {:noreply, state}

  @impl true
  def terminate(_reason, state) do
    if state.timer, do: Process.cancel_timer(state.timer)
    if state.task && Process.alive?(state.task), do: PipelineTask.cancel(state.task)
    :ok
  end

  # ── Outbound clock ───────────────────────────────────────────────────────────

  defp start_clock(state) do
    schedule_tick(%{state | next_tick: System.monotonic_time(:millisecond)})
  end

  # Deadline-based rather than a flat 20 ms sleep, so the packet rate does not
  # drift over a long call.
  defp schedule_tick(state) do
    next = state.next_tick + @tick_ms
    delay = max(next - System.monotonic_time(:millisecond), 0)
    %{state | timer: Process.send_after(self(), :tick, delay), next_tick: next}
  end

  # The pipeline asks Cartesia for 8 kHz, so this should never fire. If it
  # does, play it anyway: wrong-speed speech is diagnosable by ear, silence
  # would just look like the bot never answered.
  defp warn_once_on_rate(%{warned_rate?: false} = state, rate) when rate != @sip_rate do
    Logger.warning("[call] TTS audio at #{rate} Hz, expected #{@sip_rate} — playing unresampled")
    %{state | warned_rate?: true}
  end

  defp warn_once_on_rate(state, _rate), do: state
end
