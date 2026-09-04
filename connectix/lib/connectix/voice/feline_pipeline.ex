defmodule Connectix.Voice.FelinePipeline do
  @moduledoc """
  Assembles the Feline processor list around `Connectix.Voice.SagentsBridge`
  for both surfaces the bot can be reached on: the browser (pipecat client
  over `/voice/ws`) and a SIP phone call.

  Not started as a supervised child on its own port: `/voice/ws` is mounted
  directly in `ConnectixWeb.Endpoint`, same origin, same port as everything
  else (see the endpoint's `voice_ws/2` plug) — matching this app's own rule
  that 4001 is the origin and does not move. `Feline.Application` (the
  dependency's own OTP app) still starts normally as part of the release's
  application list; nothing here needs to supervise Feline itself, only build
  the per-connection pipeline.

  ## One middle, two ends

  `processors/3` is everything between the ears and the mouth, and is
  identical for both surfaces — the same STT, the same bridge into Sagents,
  the same TTS. Only the head and tail differ, because only the transport
  differs. That is the whole point: a phone call and a browser call are the
  same conversation with the same agent, not two features that resemble each
  other.

  ## Why the SIP path runs at 8 kHz

  Feline does no resampling anywhere; the transport hands it correctly-shaped
  PCM or nothing works. A SIP call is G.711 at 8 kHz, so the SIP pipeline is
  told to run at 8 kHz end to end (`params:`) and no resampling is needed on
  either leg. Deepgram accepts `linear16` at 8000 and Cartesia synthesizes at
  whatever rate it is asked for.

  The browser path deliberately keeps Feline's 16 kHz/24 kHz defaults — the
  pipecat client negotiates those, and there is no reason to degrade a
  browser call to telephone bandwidth.

  ## Why RTVI is browser-only

  `Feline.RTVI.Processor`/`Reporter` translate the pipecat *client* protocol
  (`InputTransportMessageFrame` in, `OutputTransportMessageFrame` out). A SIP
  call has no such client, so they are omitted from that path rather than
  included and left inert.
  """

  alias Connectix.Config
  alias Connectix.Voice.{SagentsBridge, SipAudioSink}
  alias Feline.Processors.{AssistantCollector, SentenceAggregator}
  alias Feline.Services.Cartesia.TTS, as: CartesiaTTS
  alias Feline.Services.Deepgram.STT, as: DeepgramSTT
  alias Feline.Transports.WebSocket, as: Transport

  # 8 kHz in and out: the SIP leg's native rate, so nothing resamples.
  @sip_params [audio_in_sample_rate: 8_000, audio_out_sample_rate: 8_000]

  @doc """
  The transport-independent middle of the pipeline: ears → Sagents → mouth.

  `opts` are passed through to `Connectix.Voice.SagentsBridge`; the one that
  matters is `:greeting`, which makes the bot speak first.
  """
  @spec processors(Connectix.Accounts.Scope.t(), term(), keyword()) :: [tuple() | module()]
  def processors(scope, conversation_id, opts \\ []) do
    bridge_opts =
      opts
      |> Keyword.take([:greeting, :turns])
      |> Keyword.merge(scope: scope, conversation_id: conversation_id)

    [
      Feline.Audio.EnergyVAD,
      Feline.Turns.UserTurnProcessor,
      {DeepgramSTT, api_key: Config.deepgram_api_key()},
      {SagentsBridge, bridge_opts},
      SentenceAggregator,
      {CartesiaTTS, api_key: Config.cartesia_api_key()},
      AssistantCollector
    ]
  end

  @doc """
  Builds the `bot` function `Feline.Transports.WebSocket.Handler.init/1`
  calls with the connection's raw transport pid. Returns `{:ok, pipeline_task}`
  per Feline's own contract.

  `bot/2` closes over an already-resolved `scope` and `conversation_id` — see
  `ConnectixWeb.Endpoint`'s `voice_ws/2` for where those come from (the same
  conversation the chat LiveView has open, so a voice turn and a typed turn
  land in the same transcript).
  """
  @spec bot(Connectix.Accounts.Scope.t(), term()) :: (pid() -> {:ok, pid()})
  def bot(scope, conversation_id) do
    fn transport ->
      Feline.Pipeline.Task.start_link(
        processors:
          [Transport.Input.spec(transport), Feline.RTVI.Processor] ++
            processors(scope, conversation_id) ++
            [Feline.RTVI.Reporter, Transport.Output.spec(transport)]
      )
    end
  end

  @doc """
  Starts the pipeline for a SIP call. Audio is injected by `owner` with
  `Feline.Pipeline.Task.queue_frame/3` and comes back to it as
  `{:bot_audio, pcm, rate}` from `Connectix.Voice.SipAudioSink` — there is no
  transport processor at either end, which is what Feline's `Pipeline.Task`
  is designed for.
  """
  @spec sip_pipeline(Connectix.Accounts.Scope.t(), term(), pid(), keyword()) ::
          {:ok, pid()} | {:error, term()}
  def sip_pipeline(scope, conversation_id, owner, opts \\ []) do
    Feline.Pipeline.Task.start_link(
      processors: processors(scope, conversation_id, opts) ++ [SipAudioSink.spec(owner)],
      params: @sip_params
    )
  end
end
