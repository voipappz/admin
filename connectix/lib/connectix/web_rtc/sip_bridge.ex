defmodule Connectix.WebRtc.SipBridge do
  @moduledoc """
  SIP UA (UAC only — no inbound calls, no hold/transfer) that dials out with
  `audio_source: :webrtc`, so parrot's `MediaSession` starts
  `Connectix.WebRtcMediaPipeline` for the call's RTP instead of PortAudio —
  bridging the SIP audio to whatever is registered under the pipeline's `:key`
  (always `:bridge` here — one operator, one call at a time, same
  simplification `ConnectixWeb.Plugs.BasicAuth` makes).

  ## Who is on our end of the call

  `dial/2` takes a `:mode`:

    * `:browser` (default) — `Connectix.WebRtc.Peer` holds the slot, so the
      operator's browser is on the call. This is the original behaviour and
      every existing caller keeps it by saying nothing.
    * `:agent` — `Connectix.Voice.SipCallBridge` holds the slot instead, so
      the *bot* is on the call: SIP audio goes to Deepgram, through Sagents,
      and back out as Cartesia speech. The call also becomes a conversation
      (`Connectix.Voice.CallRecord`), so it appears in the same sidebar and
      carries the same transcript as a chat or a browser voice session.

  The two are mutually exclusive because they occupy the same registry key,
  which is the intended constraint rather than a limitation worked around:
  this app is single-call-at-a-time by design.

  Trimmed from `connectix.io/phone`'s `Connectix.SipClient` (~1200 lines):
  kept register/dial/hangup, the 1xx-5xx response dispatch, and the digest
  auth challenge-retry (real accounts require it). Dropped: PortAudio device
  selection, hold/resume/MOH, transfer/REFER, in-process loopback dialing,
  call-history persistence, WAV record/playback, live audio reconfiguration —
  none of those apply to a browser-only bridge.

  Single named process (`__MODULE__`), started once in the supervision tree —
  not per-conversation. Credentials come from `Connectix.Config.sip_credentials/0`
  at `register/0` time, not at boot, so a missing/changed SIP config doesn't
  crash the app and a re-`register/0` picks up an edited `.env` without a
  restart.
  """
  use GenServer
  require Logger

  alias Connectix.Config
  alias Connectix.Voice.CallRecord
  alias Connectix.WebRtc.Transport
  alias Parrot.Media.MediaSessionManager
  alias Parrot.Sip.{Branch, Uri}
  alias Parrot.Sip.Headers.{CallId, Contact, CSeq, From, RecordRoute, To, Via}
  alias Parrot.Sip.Message
  alias Parrot.Sip.Transport.Udp, as: UdpTransport
  alias Parrot.Sip.UAC

  # Comfortably inside the 120s `expires` we ask for: re-registering at half
  # the lifetime keeps both the registrar binding and the NAT pinhole open,
  # which is what makes the UA reachable between calls rather than only just
  # after one. Registering once and assuming it holds is why a dial minutes
  # later kept coming back `not_registered`.
  @reregister_ms 60_000

  @pubsub Connectix.PubSub
  @topic "webrtc_phone"

  # A GenServer crash report prints the whole state, and this state holds the
  # SIP password. It has already been printed once — a media-leg crash on
  # 2026-09-06 dumped it into the container log in clear. Never again.
  @derive {Inspect, except: [:password]}
  defstruct [
    :username,
    :password,
    :domain,
    :server,
    :port,
    :local_ip,
    :local_port,
    :call_id,
    :local_tag,
    :remote_tag,
    :callee_uri,
    :remote_target,
    # The dialog's route set (RFC 3261 §12.1.2): the 200's Record-Route values,
    # reversed, as header-ready strings. Every in-dialog request carries them
    # as `Route` and is SENT to the first one. Without this the ACK went
    # straight to the Contact behind the proxy and never arrived: FreeSWITCH
    # retransmitted the 200 for 32 s and then ended every call with
    # `Reason: 408 "ACK Timeout"`.
    :route_set,
    :media_session,
    :sdp_offer,
    :invite_cseq,
    # The INVITE's client-transaction id, kept so an unanswered call can be
    # CANCELled. Without it the only tool for hanging up was BYE, which is
    # meaningless before a dialog exists — see `do_hangup/1`.
    :invite_uac_id,
    # `:agent` calls only — who the bot is talking as, which conversation the
    # transcript lands in, and the process holding the `:bridge` slot.
    :scope,
    :conversation_id,
    :bridge_pid,
    # Guards the stuck-badge case: a call that is never answered and never
    # rejected would otherwise sit in `:calling` forever with no terminal
    # broadcast. Tagged with the call-id so a late timer for an old call
    # cannot tear down a new one.
    :invite_timer,
    mode: :browser,
    # Re-REGISTER timer. The binding we ask for expires in 120s and the NAT
    # pinhole closes sooner than that, so a UA that registers once is reachable
    # for two minutes and then quietly is not. See `@reregister_ms`.
    reg_timer: nil,
    # Auth retry is tracked per transaction, not once for the UA. REGISTER and
    # INVITE are challenged independently and a registrar challenges EVERY
    # REGISTER, including the periodic refresh — so one shared flag meant the
    # refresh's ordinary 401, landing while an INVITE's own retry had left the
    # flag set, was read as an auth loop and tore down a live call.
    reg_auth_retried: false,
    invite_auth_retried: false,
    # Whether the registrar actually accepted us, tracked apart from `status`
    # because `status` is a *call* state that teardown has to reset. Resetting
    # it to `:registered` used to assert a registration that may never have
    # happened: a REGISTER answered `403 Forbidden` still ended up reported as
    # registered, and the first visible symptom was a baffling `404` on the
    # next INVITE rather than "this account is not registered".
    registered?: false,
    status: :idle,
    # Two CSeq spaces, because these are two transactions. A REGISTER carries
    # its own freshly generated Call-ID (see `base_headers/4`), so it is not in
    # the INVITE's dialog and must not share its sequence: rewinding `cseq` on
    # a refresh made the eventual in-dialog BYE lower than its own INVITE, and
    # RFC 3261 §12.2.2 requires the far end to reject that out of order — so
    # hanging up stopped working and the callee stayed on a dead call.
    cseq: 1,
    reg_cseq: 1
  ]

  # How long to wait for any final response to an INVITE before giving up.
  @invite_timeout_ms 60_000

  # ── Public API ──────────────────────────────────────────────────────────────

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @doc "Subscribe to status broadcasts (`{:webrtc_phone, event, payload}`)."
  def subscribe, do: Phoenix.PubSub.subscribe(@pubsub, @topic)

  @doc "Current UA state (for the ChatLive phone panel)."
  def get_state, do: GenServer.call(__MODULE__, :state)

  @doc "REGISTER against the currently configured `Connectix.Config.sip_credentials/0`."
  def register, do: GenServer.cast(__MODULE__, :register)

  @doc """
  Dial `target` — a full URI (`"sip:1000@host"`), a bare extension (`"1000"`),
  or a phone number (`"0545234585"`); the last two are completed against the
  registered domain.

  Options:

    * `:mode` — `:browser` (default) or `:agent`. See the moduledoc.
    * `:scope` — for `:agent`, whose conversation the call belongs to.
      Defaults to the single Basic Auth operator identity.
    * `:greeting` — for `:agent`, what the bot says when the callee picks up.
  """
  @spec dial(String.t(), keyword()) :: :ok | {:error, term()}
  def dial(target, opts \\ []), do: GenServer.call(__MODULE__, {:dial, target, opts}, 15_000)

  def hangup, do: GenServer.call(__MODULE__, :hangup)

  @doc """
  The far end hung up. Relayed by `Connectix.WebRtc.SipHandler.handle_bye/2`
  after parrot has already answered the BYE with 200 — this only has to end
  the call on our side. `call_id` is the dialog the BYE named.
  """
  def remote_bye(call_id), do: GenServer.cast(__MODULE__, {:remote_bye, call_id})

  # ── GenServer ────────────────────────────────────────────────────────────────

  @impl true
  def init(_opts) do
    # The agent bridge is linked, and its dying must not take the call's SIP
    # signalling down with it.
    Process.flag(:trap_exit, true)

    # A restart resets us to idle. Say so, or a LiveView that was watching a
    # call in progress keeps showing it forever.
    emit(:idle, %{})
    {:ok, %__MODULE__{}}
  end

  @impl true
  def handle_call(:state, _from, s), do: {:reply, s, s}

  def handle_call({:dial, target, opts}, _from, s) do
    case Config.sip_credentials() do
      nil ->
        emit(:failed, %{code: nil, reason: "SIP not configured"})
        {:reply, {:error, :sip_not_configured}, s}

      _creds when not s.registered? ->
        # Dialing unregistered does not fail honestly: the registrar answers
        # the INVITE `404 Not Found` because it does not know the caller, which
        # reads as "that number does not exist" rather than "this account is
        # not registered". Refuse here so the reason survives to the UI.
        emit(:failed, %{code: nil, reason: "not registered"})
        {:reply, {:error, :not_registered}, s}

      creds ->
        s = merge_credentials(s, creds)
        uri = normalize_target(target, s)
        mode = Keyword.get(opts, :mode, :browser)

        case prepare_bridge(mode, uri, opts, s) do
          {:ok, s} -> start_call(uri, s)
          {:error, reason} -> {:reply, {:error, reason}, fail(s, nil, reason)}
        end
    end
  end

  def handle_call(:hangup, _from, s), do: {:reply, :ok, do_hangup(s)}

  @impl true
  def handle_cast(:register, s) do
    case Config.sip_credentials() do
      nil ->
        Logger.warning("WebRtc.SipBridge: register/0 called with no CONNECTIX_SIP_* configured")
        {:noreply, s}

      creds ->
        local_ip = Transport.local_ip()
        local_port = Transport.local_port()

        # A refresh must be invisible to a call in progress. This runs every
        # `@reregister_ms` regardless of what the UA is doing, so touching
        # `status` here would drop a live call out of `:in_call` — taking the
        # hang-up control off the panel and defeating the `:invite_timeout`
        # guard, which only matches `:calling`/`:ringing`.
        in_call? = call_in_progress?(s)

        s =
          s
          |> merge_credentials(creds)
          |> Map.merge(%{
            local_ip: local_ip,
            local_port: local_port,
            reg_cseq: s.reg_cseq + 1,
            reg_auth_retried: false
          })

        s = if in_call?, do: s, else: %{s | status: :connecting}

        unless in_call?, do: emit(:connecting, %{server: s.server})
        do_register(s)
        {:noreply, s}
    end
  end

  # Matched on the call-id so a late BYE for a dialog that is already gone
  # cannot end a newer call. Nothing to send: parrot answered the BYE itself.
  def handle_cast({:remote_bye, call_id}, %{call_id: call_id} = s) when is_binary(call_id) do
    Logger.info("WebRtc.SipBridge: far end hung up #{call_id}")
    emit(:idle, %{})
    {:noreply, reset_call(s, %{"outcome" => "remote_hangup"})}
  end

  def handle_cast({:remote_bye, stale}, s) do
    Logger.debug(fn -> "WebRtc.SipBridge: BYE for #{inspect(stale)} names no current call" end)
    {:noreply, s}
  end

  @impl true
  # Refresh the binding on our own schedule. Cast rather than call `do_register`
  # directly so it takes the identical path a manual `register/0` does — one
  # registration flow, not two that can drift.
  def handle_info(:reregister, s) do
    if s.registered?, do: GenServer.cast(self(), :register)
    {:noreply, %{s | reg_timer: nil}}
  end

  def handle_info({:sip_response, msg}, s), do: {:noreply, on_response(msg, s)}

  # No final response ever arrived. Without this the panel sits on "Calling…"
  # forever with no way back except a restart.
  def handle_info({:invite_timeout, call_id}, %{call_id: call_id} = s)
      when not is_nil(call_id) and s.status in [:calling, :ringing] do
    Logger.warning("WebRtc.SipBridge: no final response to INVITE #{call_id} — giving up")
    {:noreply, fail(s, 408, "no answer")}
  end

  def handle_info({:invite_timeout, _stale}, s), do: {:noreply, s}

  # The agent bridge died: the call survives, but the bot is gone from it.
  def handle_info({:EXIT, pid, reason}, %{bridge_pid: pid} = s) do
    Logger.error("WebRtc.SipBridge: agent bridge exited: #{inspect(reason)}")
    {:noreply, %{s | bridge_pid: nil}}
  end

  # The media leg died. On 2026-09-06 this was ONE `:enetunreach` on an RTP
  # packet: `Membrane.UDP.Endpoint` raises on a send error, the pipeline
  # crashes, parrot's `MediaSession` (linked) exits — and it landed in the
  # catch-all `{:stop, reason, s}` below. So one dropped packet killed the UA:
  # no BYE to the far end, registration gone on restart, the agent bridge and
  # every Feline processor taken down in the cascade. A dead media leg is a
  # failed CALL, not a failed UA: signal the far end, tear the call down, keep
  # the registration.
  #
  # Not retried in place, deliberately. The send failed because the address
  # the RTP socket is bound to no longer routes — `Transport` rebinds the SIP
  # socket for exactly that reason — so a fresh socket on the same address
  # would fail the same way. Ending the call cleanly is the correct outcome.
  def handle_info({:EXIT, pid, reason}, %{media_session: pid} = s) do
    Logger.error("WebRtc.SipBridge: media leg exited mid-call: #{inspect(reason)}")
    signal_hangup(s)
    {:noreply, fail(%{s | media_session: nil}, nil, "media leg died")}
  end

  def handle_info({:EXIT, _pid, :normal}, s), do: {:noreply, s}
  def handle_info({:EXIT, _pid, reason}, s), do: {:stop, reason, s}
  def handle_info(_other, s), do: {:noreply, s}

  defp merge_credentials(s, creds) do
    %{s | username: creds.user, password: creds.pass, domain: creds.domain, server: creds.server, port: creds.port}
  end

  # ── Dial targets ────────────────────────────────────────────────────────────

  @doc """
  Complete a dial target into a SIP URI.

  The phone panel invites bare input ("…or an extension"), and a bare number
  used to go out as the request-URI verbatim, producing an INVITE no
  registrar could route. Anything without a scheme is completed against the
  registered domain; anything with one is left alone.
  """
  @spec normalize_target(String.t(), %__MODULE__{}) :: String.t()
  def normalize_target(target, s) do
    trimmed = target |> to_string() |> String.trim()

    cond do
      trimmed =~ ~r/^sips?:/i -> trimmed
      String.contains?(trimmed, "@") -> "sip:" <> trimmed
      true -> "sip:#{strip_dial_formatting(trimmed)}@#{s.domain}"
    end
  end

  # People type numbers the way they read them; a registrar will not.
  defp strip_dial_formatting(user), do: String.replace(user, ~r/[\s\-().]/, "")

  # ── Call setup ──────────────────────────────────────────────────────────────

  defp prepare_bridge(:browser, _uri, _opts, s) do
    {:ok, %{s | mode: :browser, scope: nil, conversation_id: nil, bridge_pid: nil}}
  end

  defp prepare_bridge(:agent, uri, opts, s) do
    scope = Keyword.get(opts, :scope) || default_scope()

    with {:ok, conversation_id} <- CallRecord.open(scope, uri, nil),
         {:ok, pid} <- start_agent_bridge(scope, conversation_id, opts) do
      {:ok, %{s | mode: :agent, scope: scope, conversation_id: conversation_id, bridge_pid: pid}}
    else
      # A browser Peer already holds the slot: the operator is on a call.
      {:error, {:already_started, _pid}} -> {:error, :bridge_busy}
      {:error, reason} -> {:error, reason}
      other -> {:error, other}
    end
  end

  defp prepare_bridge(mode, _uri, _opts, _s), do: {:error, {:unknown_mode, mode}}

  defp start_agent_bridge(scope, conversation_id, opts) do
    Connectix.Voice.SipCallBridge.start_link(
      scope: scope,
      conversation_id: conversation_id,
      greeting: Keyword.get(opts, :greeting, Config.voice_greeting())
    )
  end

  # The one operator identity, same as the LiveView UI and `/voice/ws`.
  defp default_scope, do: ConnectixWeb.UserAuth.resolve_scope()

  defp start_call(uri, s) do
    case do_dial(uri, s) do
      {:ok, s} ->
        emit(:calling, %{uri: uri})
        CallRecord.stamp(s.scope, s.conversation_id, "dialed_at", %{"sip_call_id" => s.call_id})

        {:reply, :ok,
         %{s | status: :calling, invite_timer: arm_invite_timer(s.call_id)}}

      {:error, reason} = err ->
        {:reply, err, fail(s, nil, inspect(reason))}

      err ->
        {:reply, err, fail(s, nil, inspect(err))}
    end
  end

  defp arm_reregister(s) do
    if s.reg_timer, do: Process.cancel_timer(s.reg_timer)
    %{s | reg_timer: Process.send_after(self(), :reregister, @reregister_ms)}
  end

  @doc false
  # `status` describes the CALL, and registration is a separate transaction that
  # refreshes on its own timer — so every registration outcome has to ask
  # whether it is allowed to speak for `status` at all. `call_id` is checked as
  # well as `status` because it is set the moment an INVITE goes out, closing
  # the window between dialing and the first provisional response.
  def call_in_progress?(s),
    do: s.status in [:calling, :ringing, :in_call] or not is_nil(s.call_id)

  defp registered_unless_in_call(s),
    do: if(call_in_progress?(s), do: s, else: %{s | status: :registered})

  defp idle_unless_in_call(s),
    do: if(call_in_progress?(s), do: s, else: %{s | status: :idle})

  defp arm_invite_timer(call_id),
    do: Process.send_after(self(), {:invite_timeout, call_id}, @invite_timeout_ms)

  # ── Call teardown ───────────────────────────────────────────────────────────

  # Every exit from a call funnels through here, so there is exactly one place
  # that can forget to broadcast a terminal status or leave the agent bridge
  # holding the `:bridge` slot.
  defp reset_call(s, ended_reason) do
    if s.invite_timer, do: Process.cancel_timer(s.invite_timer)
    if s.media_session && Process.alive?(s.media_session), do: GenServer.stop(s.media_session, :normal)

    CallRecord.stamp(s.scope, s.conversation_id, "ended_at", ended_reason)
    stop_agent_bridge(s.bridge_pid)

    %{
      s
      | callee_uri: nil,
        remote_target: nil,
        route_set: nil,
        call_id: nil,
        local_tag: nil,
        remote_tag: nil,
        media_session: nil,
        sdp_offer: nil,
        invite_cseq: nil,
        invite_uac_id: nil,
        invite_timer: nil,
        scope: nil,
        conversation_id: nil,
        bridge_pid: nil,
        mode: :browser,
        invite_auth_retried: false,
        status: if(s.registered?, do: :registered, else: :idle)
    }
  end

  defp stop_agent_bridge(nil), do: :ok

  defp stop_agent_bridge(pid) do
    if Process.alive?(pid), do: GenServer.stop(pid, :normal)
    :ok
  rescue
    _ -> :ok
  catch
    :exit, _ -> :ok
  end

  defp fail(s, code, reason) do
    emit(:failed, %{code: code, reason: reason})
    reset_call(s, %{"outcome" => "failed", "reason" => to_string(reason)})
  end

  # ── SIP flow ────────────────────────────────────────────────────────────────

  defp do_register(s, auth \\ nil) do
    me = self()
    uri = register_uri(s)
    msg = register_msg(uri, s, auth)
    UAC.request(msg, &send(me, {:sip_response, &1}))
  end

  # The REGISTER request-URI (the registrar). The domain when it differs from
  # the connect host — a multi-tenant registrar validates the AOR against the
  # domain, and parrot's UAC routes by the request-URI host.
  defp register_uri(s) do
    if s.domain != s.server, do: "sip:#{s.domain}", else: "sip:#{s.server}:#{s.port}"
  end

  # The INVITE must reach the SAME next-hop as REGISTER. A dialed
  # `sip:user@domain` carries no port -> resolves to the default :5060 and
  # can miss the registrar's real listener. Pin the registrar port when the
  # R-URI has none, keeping the host (the realm) unchanged.
  defp with_registrar_port(uri, s) do
    case Regex.run(~r/^(sip:)([^@]*@)?([^:;>\s]+)(:\d+)?(.*)$/, to_string(uri)) do
      [_, scheme, userat, host, "", rest] -> "#{scheme}#{userat}#{host}:#{s.port}#{rest}"
      _ -> uri
    end
  end

  defp do_dial(uri, s) do
    uri = with_registrar_port(uri, s)
    call_id = gen_call_id(s.domain)

    case MediaSessionManager.prepare_uac_session(
           id: "webrtc-uac-#{call_id}",
           dialog_id: call_id,
           audio_source: :webrtc
         ) do
      {:ok, pid, sdp_offer_raw} ->
        sdp_offer = rewrite_sdp_address(sdp_offer_raw, advertised_ip(s))
        local_tag = From.generate_tag()
        invite_cseq = s.cseq
        s_for_msg = %{s | local_tag: local_tag, cseq: invite_cseq}
        me = self()
        msg = invite_msg(uri, s_for_msg, call_id, sdp_offer)
        uac_id = UAC.request(msg, &send(me, {:sip_response, &1}))

        {:ok,
         %{
           s
           | callee_uri: uri,
             call_id: call_id,
             media_session: pid,
             sdp_offer: sdp_offer,
             local_tag: local_tag,
             invite_cseq: invite_cseq,
             invite_uac_id: uac_id,
             cseq: invite_cseq + 1
         }}

      err ->
        err
    end
  end

  # Hanging up is two different requests depending on how far the call got, and
  # sending the wrong one does nothing useful.
  #
  # A BYE ends an established dialog. Before the callee answers there IS no
  # dialog — no remote tag — so a BYE is answered `481 Call/Transaction Does Not
  # Exist` and the phone keeps ringing. Worse, the INVITE transaction stays
  # alive: when the callee eventually picks up, the 200 OK arrives against
  # freshly reset state and `send_ack/2` reaches `Uri.parse(nil)`, which raises
  # and takes this process down with the call it was supposed to have ended.
  #
  # `remote_tag` is set only by the 200 on the INVITE, so it is exactly the
  # "is there a dialog" question.
  defp do_hangup(s) do
    signal_hangup(s)
    emit(:idle, %{})
    %{reset_call(s, %{"outcome" => "hungup"}) | cseq: s.cseq + 1}
  end

  # Tell the far end the call is over: BYE for an established dialog, CANCEL
  # for an INVITE still in flight, nothing when there is no call. Shared by
  # the operator's hang-up and by a media-leg failure, so both say goodbye.
  defp signal_hangup(s) do
    cond do
      s.remote_tag ->
        bye_uri = s.remote_target || s.callee_uri
        msg = bye_msg(bye_uri, s)

        # parrot's transaction layer sends to the request-URI host, full stop
        # (`UAC.request/3` even takes a `nexthop` it ignores). A dialog with a
        # route set needs the BYE at the proxy, so it goes out directly, the
        # way parrot itself sends ACK. What that costs is Timer E: a BYE lost
        # on the wire is not retransmitted. Accepted — the far end's own RTP
        # timeout ends the call in that case — until the next hop lands in
        # parrot, where it belongs.
        if s.route_set in [nil, []] do
          me = self()
          UAC.request(msg, &send(me, {:sip_response, &1}))
        else
          send_in_dialog(msg, s)
        end

      s.invite_uac_id ->
        Logger.info("WebRtc.SipBridge: cancelling an INVITE that was never answered")
        UAC.cancel(s.invite_uac_id)

      true ->
        :ok
    end
  end

  # ── Response handler ────────────────────────────────────────────────────────

  defp on_response({:response, %{type: :response, status_code: code} = r}, s) do
    method = cseq_method(r.headers["cseq"])
    Logger.info("WebRtc.SipBridge: SIP #{code} #{method}")
    dispatch(code, method, r, s)
  end

  defp on_response(_other, s), do: s

  # Public only so a test can drive the response state machine without a
  # registrar, the same reason `Realtime.ScreenPop.route_event/2` is. What a
  # registration refresh is allowed to do to a call in progress is decided
  # entirely here, and none of it is observable from a call that succeeds.
  @doc false
  def dispatch(code, method, r, s)

  def dispatch(code, method, r, s) when code in [401, 407] do
    retried? = if method == :register, do: s.reg_auth_retried, else: s.invite_auth_retried

    if retried? do
      Logger.warning("WebRtc.SipBridge: second #{code} on #{method} — auth loop, giving up")
      # A registration that cannot authenticate is not a call failure. Routing
      # it through `fail/3` would tear down whatever call is up — which is the
      # opposite of what a refresh should be able to do.
      if method == :register,
        do: %{s | registered?: false, reg_auth_retried: false} |> idle_unless_in_call(),
        else: fail(s, code, "auth loop")
    else
      {challenge_hdr, response_hdr} =
        if code == 407,
          do: {"proxy-authenticate", "proxy-authorization"},
          else: {"www-authenticate", "authorization"}

      challenge = r.headers[challenge_hdr]
      # The refresh's challenge is not news to a call in progress: the panel
      # flashed "authenticating" 58 s into an otherwise perfect call.
      unless method == :register and call_in_progress?(s), do: emit(:authenticating, %{})

      if challenge && s.password do
        me = self()

        case method do
          :register ->
            new_cseq = s.reg_cseq + 1
            auth = digest_auth(challenge, method, register_uri(s), s)
            do_register(%{s | reg_cseq: new_cseq}, auth)
            %{s | reg_cseq: new_cseq, reg_auth_retried: true}

          :invite ->
            new_cseq = s.cseq + 1
            auth = digest_auth(challenge, method, s.callee_uri, s)
            msg = invite_msg(s.callee_uri, %{s | cseq: new_cseq}, s.call_id, s.sdp_offer)
            msg = put_header(msg, response_hdr, auth)
            uac_id = UAC.request(msg, &send(me, {:sip_response, &1}))

            %{
              s
              | cseq: new_cseq,
                invite_cseq: new_cseq,
                invite_uac_id: uac_id,
                invite_auth_retried: true
            }

          _ ->
            s
        end
      else
        s
      end
    end
  end

  def dispatch(200, :register, _r, s) do
    # Mid-call this is a refresh, and the panel must keep showing the call. Only
    # the registration verdict is news; `status` still belongs to the call.
    unless call_in_progress?(s), do: emit(:registered, %{})

    %{s | registered?: true, reg_auth_retried: false}
    |> registered_unless_in_call()
    |> arm_reregister()
  end

  # A refused REGISTER is not a call failure: there is no call to tear down,
  # and routing it through `fail/3` (which calls `reset_call/2`) is exactly
  # what used to overwrite the refusal with `status: :registered`.
  def dispatch(code, :register, r, s) when code >= 400 do
    unless call_in_progress?(s), do: emit(:failed, %{code: code, reason: r.reason_phrase})
    %{s | registered?: false, reg_auth_retried: false} |> idle_unless_in_call()
  end

  # A retransmitted 200: the far end has not seen our ACK. Every 2xx
  # retransmission gets an ACK (RFC 3261 §13.2.2.4) and nothing else happens
  # again — media, pipeline and call record were all set up on the first one.
  # Without this clause a retransmission re-ran the whole answer path.
  def dispatch(200, :invite, r, %{status: :in_call} = s) do
    if to_tag(r) == s.remote_tag, do: send_ack(s, s.remote_tag)
    s
  end

  def dispatch(200, :invite, r, s) do
    remote_tag = to_tag(r)
    sdp_answer = r.body
    remote_target = extract_contact_uri(r) || s.callee_uri
    # The ACK for a 2xx is addressed to the remote target — the Contact the
    # 200 carried — not to the URI we dialed (§13.2.2.4). FreeSWITCH ended the
    # first bot call with `Reason: 408 "ACK Timeout"`: our ACK went to the
    # domain, and whether the proxy forwarded it to the box that answered is
    # not something to leave to the proxy.
    route_set = route_set_from(r)
    send_ack(%{s | remote_target: remote_target, route_set: route_set}, remote_tag)

    if s.media_session, do: MediaSessionManager.complete_uac_setup(s.media_session, sdp_answer)

    # The callee picked up. Only now does the bot start talking — see
    # `Connectix.Voice.SipCallBridge` on why the pipeline is not started at
    # dial time.
    if s.bridge_pid, do: Connectix.Voice.SipCallBridge.answered(s.bridge_pid)
    CallRecord.stamp(s.scope, s.conversation_id, "answered_at", %{})

    if s.invite_timer, do: Process.cancel_timer(s.invite_timer)
    emit(:in_call, %{})

    %{
      s
      | remote_tag: remote_tag,
        remote_target: remote_target,
        route_set: route_set,
        status: :in_call,
        invite_timer: nil,
        invite_auth_retried: false
    }
  end

  def dispatch(code, _, _, s) when code in [180, 183] do
    emit(:ringing, %{})
    s
  end

  def dispatch(code, _, _, s) when code in 100..199, do: s
  def dispatch(code, _, _, s) when code in 200..299, do: s

  def dispatch(code, _, r, s) when code >= 400, do: fail(s, code, r.reason_phrase)

  def dispatch(_, _, _, s), do: s

  defp send_ack(s, remote_tag) do
    cseq = s.invite_cseq || s.cseq
    msg = ack_msg(s.remote_target || s.callee_uri, %{s | cseq: cseq}, remote_tag)
    send_in_dialog(msg, s)
  end

  # ── Message builders ────────────────────────────────────────────────────────

  # A REGISTER is its own transaction: its own Call-ID (`base_headers/4` mints
  # one and, unlike the dialog builders below, nothing overrides it), its own
  # CSeq space, and its own From tag — passing `local_tag: nil` stops a refresh
  # sent mid-call from borrowing the INVITE dialog's tag.
  defp register_msg(uri, s, auth) do
    h = base_headers(:register, %{s | local_tag: nil}, s.reg_cseq, "sip:#{s.username}@#{s.domain}")
    h = if auth, do: Map.put(h, "authorization", auth), else: h
    h = Map.put(h, "expires", 120)
    Message.new_request(:register, uri, h)
  end

  defp invite_msg(uri, s, call_id, sdp) do
    h = base_headers(:invite, s, s.cseq, uri)
    h = Map.put(h, "call-id", CallId.new(call_id))
    msg = Message.new_request(:invite, uri, h)

    if sdp,
      do: msg |> Message.set_body(sdp) |> put_header("content-type", "application/sdp"),
      else: msg
  end

  # In-dialog requests (§12.2.1.1): the request-URI is the remote target (the
  # Contact from the 200) and the To header is the dialog's remote URI — the
  # address we dialed — carrying the remote tag. These used to build To from
  # `uri`, which put the far end's Contact host into To once `uri` became the
  # remote target; FreeSWITCH tolerated it, a stricter UAS would not.
  defp bye_msg(uri, s) do
    h = base_headers(:bye, s, s.cseq, s.callee_uri)
    h = if s.call_id, do: Map.put(h, "call-id", CallId.new(s.call_id)), else: h
    h = if s.remote_tag, do: put_in(h, ["to"], To.with_parameter(h["to"], "tag", s.remote_tag)), else: h
    Message.new_request(:bye, uri, h)
  end

  defp ack_msg(uri, s, remote_tag) do
    h = base_headers(:ack, s, s.cseq, s.callee_uri)
    h = if s.call_id, do: Map.put(h, "call-id", CallId.new(s.call_id)), else: h
    h = if remote_tag, do: put_in(h, ["to"], To.with_parameter(h["to"], "tag", remote_tag)), else: h
    Message.new_request(:ack, uri, h)
  end

  # ── Dialog routing ──────────────────────────────────────────────────────────

  # The route set for the dialog a 2xx just created (§12.1.2): its Record-Route
  # values in reverse order, each kept as the proxy's own bytes. parrot hands
  # the header over as the raw string; it is split on the commas between
  # values rather than parsed and re-serialised, because a re-serialised URI
  # comes back with its parameters in map order, and a Route value is the
  # proxy's identity — it goes back exactly as it came. Empty when the far end
  # recorded no route, in which case in-dialog requests go to the remote
  # target directly and nothing changes.
  @doc false
  def route_set_from(%{headers: %{"record-route" => recorded}}) do
    recorded
    |> List.wrap()
    |> Enum.flat_map(fn
      %RecordRoute{} = header -> [RecordRoute.format(header)]
      raw when is_binary(raw) -> raw |> String.split(~r/(?<=>)\s*,\s*(?=<)/) |> Enum.map(&String.trim/1)
      _other -> []
    end)
    |> Enum.reject(&(&1 == ""))
    |> Enum.reverse()
  end

  def route_set_from(_response), do: []

  # Where an in-dialog request is actually sent: the first Route hop (§8.1.2,
  # loose routing), or nowhere special when there is no route set.
  @doc false
  def route_hop([first | _rest]) when is_binary(first) do
    case RecordRoute.parse(first) do
      %RecordRoute{uri: %Uri{host: host, port: port}} -> {host, port || 5060}
      %RecordRoute{uri: raw} when is_binary(raw) -> uri_hop(raw)
      _ -> nil
    end
  end

  def route_hop(_none), do: nil

  defp uri_hop(uri) when is_binary(uri) do
    case Uri.parse(uri) do
      {:ok, %Uri{host: host, port: port}} when is_binary(host) -> {host, port || 5060}
      _ -> nil
    end
  end

  # Sends an in-dialog request the way RFC 3261 §12.2.1.1 says: Route header
  # carrying the route set, request-URI the remote target, transport
  # destination the first Route hop. Bypasses parrot's transaction layer, which
  # cannot be told a destination — this is a copy of what its own `ack_request`
  # does, plus the Route and the hop.
  defp send_in_dialog(%Message{} = msg, s) do
    msg =
      msg
      |> with_route(s.route_set)
      |> brand_via()

    destination = route_hop(s.route_set) || uri_hop(msg.request_uri)

    if destination do
      UdpTransport.send_request(%{message: msg, destination: destination})
    else
      Logger.error("WebRtc.SipBridge: no destination for #{msg.method} #{inspect(msg.request_uri)}")
      :ok
    end
  end

  # One header value, comma-joined, never a list: the transport's serializer
  # has no formatter for a list under "route" and falls back to `inspect/1`,
  # which put `Route: ["<sip:…>"]` on the wire — brackets and quotes included.
  # The proxy could not read it and the ACK timed out exactly as before.
  defp with_route(msg, routes) when routes in [nil, []], do: msg
  defp with_route(msg, routes), do: put_header(msg, "route", Enum.join(routes, ", "))

  # A request needs a transaction branch on its top Via even when no
  # transaction owns it; parrot adds one inside `ack_request` and keeps that
  # helper private.
  defp brand_via(%Message{headers: %{"via" => [%Via{} = via | rest]} = h} = msg) do
    via = %{via | parameters: Map.put(via.parameters || %{}, "branch", Branch.generate())}
    %{msg | headers: %{h | "via" => [via | rest]}}
  end

  defp brand_via(msg), do: msg

  defp base_headers(method, s, seq, to_uri) do
    lip = s.local_ip || Transport.local_ip()
    lp = s.local_port || Transport.local_port()
    contact_host = advertised_ip(s)
    from_uri = "sip:#{s.username}@#{s.domain}"

    from =
      if s.local_tag,
        do: From.new_with_tag(from_uri, s.username, s.local_tag),
        else: From.new_with_tag(from_uri, s.username)

    %{
      "via" => [Via.new(lip, :udp, lp)],
      "from" => from,
      "to" => To.new(to_uri),
      "call-id" => CallId.new(gen_call_id(s.domain)),
      "cseq" => CSeq.new(seq, method),
      "contact" => Contact.new("sip:#{s.username}@#{contact_host}:#{lp}"),
      "max-forwards" => 70,
      "user-agent" => "connectix-webrtc-bridge"
    }
  end

  defp put_header(msg, k, v), do: %{msg | headers: Map.put(msg.headers, k, v)}

  # ── Digest auth ─────────────────────────────────────────────────────────────

  defp digest_auth(challenge, method, request_uri, s) when is_binary(challenge) do
    realm = extract(challenge, "realm")
    nonce = extract(challenge, "nonce")
    qop = extract(challenge, "qop")
    opaque = extract(challenge, "opaque")
    m = method |> to_string() |> String.upcase()
    ha1 = md5("#{s.username}:#{realm}:#{s.password}")
    ha2 = md5("#{m}:#{request_uri}")

    base =
      ~s(Digest username="#{s.username}", realm="#{realm}", nonce="#{nonce}", ) <>
        ~s(uri="#{request_uri}", algorithm=MD5)

    header =
      case pick_qop(qop) do
        nil ->
          resp = digest_response(ha1, ha2, nonce, "", "", "")
          base <> ~s(, response="#{resp}")

        q ->
          nc = "00000001"
          cnonce = gen_cnonce()
          resp = digest_response(ha1, ha2, nonce, q, nc, cnonce)
          base <> ~s(, response="#{resp}", qop=#{q}, nc=#{nc}, cnonce="#{cnonce}")
      end

    if opaque == "", do: header, else: header <> ~s(, opaque="#{opaque}")
  end

  defp digest_auth(_, _, _, _), do: nil

  defp pick_qop(qop) do
    qop |> to_string() |> String.split(",") |> Enum.map(&String.trim/1) |> Enum.find(&(&1 == "auth"))
  end

  defp gen_cnonce, do: :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)

  @doc false
  def digest_response(ha1, ha2, nonce, "", _nc, _cnonce), do: md5("#{ha1}:#{nonce}:#{ha2}")
  def digest_response(ha1, ha2, nonce, qop, nc, cnonce), do: md5("#{ha1}:#{nonce}:#{nc}:#{cnonce}:#{qop}:#{ha2}")

  # ── RTP / SDP helpers ────────────────────────────────────────────────────────

  defp advertised_ip(s) do
    case System.get_env("CONNECTIX_SIP_PUBLIC_IP") do
      ip when is_binary(ip) and ip != "" -> ip
      _ -> safe_exposed_ip() || s.local_ip || Transport.local_ip()
    end
  end

  defp safe_exposed_ip do
    Transport.exposed_ip()
  rescue
    _ -> nil
  catch
    :exit, _ -> nil
  end

  # Parrot's MediaSession hardcodes 127.0.0.1 in SDP's c= and o= lines.
  # Rewrite to the real local IP so the address advertised in SDP is
  # routable.
  defp rewrite_sdp_address(sdp, local_ip) when is_binary(sdp) and is_binary(local_ip) do
    sdp
    |> String.replace(~r/(c=IN IP4 )127\.0\.0\.1/, "\\g{1}#{local_ip}")
    |> String.replace(~r/(o=[^\r\n]* IN IP4 )127\.0\.0\.1/, "\\g{1}#{local_ip}")
  end

  defp rewrite_sdp_address(sdp, _), do: sdp

  # ── PubSub / misc helpers ────────────────────────────────────────────────────

  # The one funnel every SIP state change already passed through, so it is also
  # where a call gets a trail. The PubSub broadcast is live-only — it reaches
  # the LiveViews that happen to exist at that instant and is then gone, which
  # is why "why did that call drop" had no answer five minutes later. The
  # counter says whether calls are failing; the event store says what happened
  # to one specific call.
  defp emit(event, payload) do
    Phoenix.PubSub.broadcast(@pubsub, @topic, {:webrtc_phone, event, payload})

    if event in [:registered, :register_refused, :calling, :ringing, :answered, :ended, :failed] do
      Connectix.Telemetry.call_sip(event)
    end

    Connectix.Events.record("sip", %{
      "label" => "sip.#{event}",
      "payload" => payload
    })

    :ok
  end

  defp gen_call_id(domain), do: "#{:rand.uniform(999_999_999)}-#{:rand.uniform(99_999)}@#{domain}"

  defp cseq_method(%{method: m}), do: m
  defp cseq_method(_), do: nil

  defp to_tag(%{headers: %{"to" => %{parameters: %{"tag" => t}}}}), do: t
  defp to_tag(_), do: nil

  defp extract_contact_uri(%{headers: %{"contact" => %{uri: %{host: host} = uri}}})
       when is_binary(host) and host != "" do
    user = Map.get(uri, :user)
    port = Map.get(uri, :port)
    host_port = if port, do: "#{host}:#{port}", else: host

    if is_binary(user) and user != "", do: "sip:#{user}@#{host_port}", else: "sip:#{host_port}"
  end

  defp extract_contact_uri(_), do: nil

  defp extract(str, key) do
    case Regex.run(~r/#{key}="([^"]+)"/, str) do
      [_, v] -> v
      _ -> (m = Regex.run(~r/#{key}=([^,\s]+)/, str)) && Enum.at(m, 1) || ""
    end
  end

  defp md5(s), do: :crypto.hash(:md5, s) |> Base.encode16(case: :lower)
end
