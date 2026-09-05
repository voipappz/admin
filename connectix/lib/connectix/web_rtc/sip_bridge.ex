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
  alias Parrot.Sip.Headers.{CallId, Contact, CSeq, From, To, Via}
  alias Parrot.Sip.Message
  alias Parrot.Sip.UAC

  @pubsub Connectix.PubSub
  @topic "webrtc_phone"

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
    :media_session,
    :sdp_offer,
    :invite_cseq,
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
    auth_retried: false,
    # Whether the registrar actually accepted us, tracked apart from `status`
    # because `status` is a *call* state that teardown has to reset. Resetting
    # it to `:registered` used to assert a registration that may never have
    # happened: a REGISTER answered `403 Forbidden` still ended up reported as
    # registered, and the first visible symptom was a baffling `404` on the
    # next INVITE rather than "this account is not registered".
    registered?: false,
    status: :idle,
    cseq: 1
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

        s =
          s
          |> merge_credentials(creds)
          |> Map.merge(%{local_ip: local_ip, local_port: local_port, status: :connecting, cseq: 1})

        emit(:connecting, %{server: s.server})
        do_register(s)
        {:noreply, s}
    end
  end

  @impl true
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
        call_id: nil,
        local_tag: nil,
        remote_tag: nil,
        media_session: nil,
        sdp_offer: nil,
        invite_cseq: nil,
        invite_timer: nil,
        scope: nil,
        conversation_id: nil,
        bridge_pid: nil,
        mode: :browser,
        auth_retried: false,
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
        UAC.request(msg, &send(me, {:sip_response, &1}))

        {:ok,
         %{
           s
           | callee_uri: uri,
             call_id: call_id,
             media_session: pid,
             sdp_offer: sdp_offer,
             local_tag: local_tag,
             invite_cseq: invite_cseq,
             cseq: invite_cseq + 1
         }}

      err ->
        err
    end
  end

  defp do_hangup(s) do
    if s.callee_uri do
      me = self()
      bye_uri = s.remote_target || s.callee_uri
      msg = bye_msg(bye_uri, s)
      UAC.request(msg, &send(me, {:sip_response, &1}))
    end

    emit(:idle, %{})
    %{reset_call(s, %{"outcome" => "hungup"}) | cseq: s.cseq + 1}
  end

  # ── Response handler ────────────────────────────────────────────────────────

  defp on_response({:response, %{type: :response, status_code: code} = r}, s) do
    method = cseq_method(r.headers["cseq"])
    Logger.info("WebRtc.SipBridge: SIP #{code} #{method}")
    dispatch(code, method, r, s)
  end

  defp on_response(_other, s), do: s

  defp dispatch(code, method, r, s) when code in [401, 407] do
    if s.auth_retried do
      Logger.warning("WebRtc.SipBridge: second #{code} on #{method} — auth loop, giving up")
      fail(s, code, "auth loop")
    else
      {challenge_hdr, response_hdr} =
        if code == 407,
          do: {"proxy-authenticate", "proxy-authorization"},
          else: {"www-authenticate", "authorization"}

      challenge = r.headers[challenge_hdr]
      emit(:authenticating, %{})

      if challenge && s.password do
        me = self()

        case method do
          :register ->
            new_cseq = s.cseq + 1
            auth = digest_auth(challenge, method, register_uri(s), s)
            do_register(%{s | cseq: new_cseq}, auth)
            %{s | cseq: new_cseq, auth_retried: true}

          :invite ->
            new_cseq = s.cseq + 1
            auth = digest_auth(challenge, method, s.callee_uri, s)
            msg = invite_msg(s.callee_uri, %{s | cseq: new_cseq}, s.call_id, s.sdp_offer)
            msg = put_header(msg, response_hdr, auth)
            UAC.request(msg, &send(me, {:sip_response, &1}))
            %{s | cseq: new_cseq, invite_cseq: new_cseq, auth_retried: true}

          _ ->
            s
        end
      else
        s
      end
    end
  end

  defp dispatch(200, :register, _r, s) do
    emit(:registered, %{})
    %{s | status: :registered, registered?: true, auth_retried: false}
  end

  # A refused REGISTER is not a call failure: there is no call to tear down,
  # and routing it through `fail/3` (which calls `reset_call/2`) is exactly
  # what used to overwrite the refusal with `status: :registered`.
  defp dispatch(code, :register, r, s) when code >= 400 do
    emit(:failed, %{code: code, reason: r.reason_phrase})
    %{s | status: :idle, registered?: false, auth_retried: false}
  end

  defp dispatch(200, :invite, r, s) do
    remote_tag = to_tag(r)
    sdp_answer = r.body
    remote_target = extract_contact_uri(r) || s.callee_uri
    send_ack(s, remote_tag)

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
        status: :in_call,
        invite_timer: nil,
        auth_retried: false
    }
  end

  defp dispatch(code, _, _, s) when code in [180, 183] do
    emit(:ringing, %{})
    s
  end

  defp dispatch(code, _, _, s) when code in 100..199, do: s
  defp dispatch(code, _, _, s) when code in 200..299, do: s

  defp dispatch(code, _, r, s) when code >= 400, do: fail(s, code, r.reason_phrase)

  defp dispatch(_, _, _, s), do: s

  defp send_ack(s, remote_tag) do
    cseq = s.invite_cseq || s.cseq
    msg = ack_msg(s.callee_uri, %{s | cseq: cseq}, remote_tag)
    UAC.ack_request(msg)
  end

  # ── Message builders ────────────────────────────────────────────────────────

  defp register_msg(uri, s, auth) do
    h = base_headers(:register, s, s.cseq, "sip:#{s.username}@#{s.domain}")
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

  defp bye_msg(uri, s) do
    h = base_headers(:bye, s, s.cseq, uri)
    h = if s.call_id, do: Map.put(h, "call-id", CallId.new(s.call_id)), else: h
    h = if s.remote_tag, do: put_in(h, ["to"], To.with_parameter(h["to"], "tag", s.remote_tag)), else: h
    Message.new_request(:bye, uri, h)
  end

  defp ack_msg(uri, s, remote_tag) do
    h = base_headers(:ack, s, s.cseq, uri)
    h = if s.call_id, do: Map.put(h, "call-id", CallId.new(s.call_id)), else: h
    h = if remote_tag, do: put_in(h, ["to"], To.with_parameter(h["to"], "tag", remote_tag)), else: h
    Message.new_request(:ack, uri, h)
  end

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

  defp emit(event, payload), do: Phoenix.PubSub.broadcast(@pubsub, @topic, {:webrtc_phone, event, payload})

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
