import { Injectable } from '@angular/core';
import { Socket, Channel } from 'phoenix';
import { Events } from '../events';
import { UserData } from '../user-data';
import { AuthService } from '../simple-auth.service';

declare var CONFIG: any;

/**
 * WebRTC phone over the connectix Phoenix channel.
 *
 * The box does NOT speak SIP-over-WebSocket — `webrtc-phone.ts` (sip.js) has no
 * server to talk to here. connectix terminates the browser's WebRTC call inside
 * the BEAM (`Connectix.WebRtc.Peer`) and signals over the app's existing
 * `/agent` Phoenix socket, on topic `phone:<extension>`.
 *
 * Wire protocol (see `lib/connectix_web/phone_channel.ex`):
 *   browser → server : "offer" {sdp,type} · "ice" <RTCIceCandidateInit> ·
 *                      "dial" {to} · "hangup" {}
 *   server → browser : "answer" {sdp,type} · "ice" <RTCIceCandidateInit> ·
 *                      "status" {status} · "error" {reason}
 *
 * There is no SIP domain, no registrar and no `wss_server` in this transport —
 * the session token that authenticates the socket IS the registration. Anything
 * gated on `user.environment.domain` must not gate this.
 *
 * The public surface deliberately mirrors `WebRTCPhone` so `PhoneProvider` can
 * swap between them and the dialpad / call card keep working unchanged. Events
 * published are the same ones the UI already listens to: `phone:webrtc-state`
 * (a plain status string), `phone:webrtc-event` ({session_id, type}) and
 * `sip:call-message` (the call-card payload).
 */
@Injectable()
export class WebRTCChannelPhone {
  /** Live socket/channel. `joined` is the "registered" equivalent. */
  private socket: Socket | null = null;
  private channel: Channel | null = null;
  private joined = false;
  private joining = false;

  /** The identity the channel topic was accepted for (e.g. "9001"). */
  extension = '';

  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  // Mute and hold are independent gates on the SAME audio tracks, so they are
  // kept apart and composed in `applyAudioGates`. Folding them into one flag
  // means unholding a call that was muted before the hold silently unmutes it.
  private muted = false;
  private held = false;

  /** One call at a time — the channel owns exactly one peer. */
  private activeCall: {
    uuid: string;
    target: string;
    dialed: boolean;
    connected: boolean;
    timer: any;
  } | null = null;

  /** Candidates queued before the remote description is applied. */
  private pendingIce: any[] = [];

  /** Resolved when a join succeeds; rejected when every identity is refused. */
  private joinWaiters: Array<{ resolve: () => void; reject: (e: any) => void }> = [];

  private status = 'Unregistered';

  /** How long to wait for ICE/DTLS before declaring the call dead. */
  private connectTimeoutMs = 15000;

  constructor(
    private events: Events,
    private sharedData: UserData,
    private auth: AuthService
  ) {
    console.log('[ChannelPhone] initialized (connectix WebRTC-over-Phoenix transport)');
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Open the socket and join `phone:<extension>`.
   * Returns whether this transport is usable at all (token + identity present);
   * the join itself is async and reported through `phone:webrtc-state`.
   */
  start(login_flag = false): boolean {
    const token = this.auth.getToken();
    if (!token) {
      console.error('[ChannelPhone] no session token in localStorage — cannot open the /agent socket');
      this.setStatus('No Session');
      this.events.publish('phone:mode-unavailable', { mode: 'channel', reason: 'no_token' });
      return false;
    }

    const identities = this.identityCandidates();
    if (!identities.length) {
      console.error('[ChannelPhone] logged-in user has no extension/username to build a phone topic from');
      this.setStatus('No Extension');
      this.events.publish('phone:mode-unavailable', { mode: 'channel', reason: 'no_identity' });
      return false;
    }

    if (this.joined && !login_flag) {
      console.log('[ChannelPhone] already joined phone:' + this.extension);
      this.setStatus('Ready');
      return true;
    }

    if (this.joining && !login_flag) {
      return true;
    }

    this.teardownSocket();
    this.openSocket(token, identities);
    return true;
  }

  /** Identities the box will accept as a `phone:` topic, best first. */
  private identityCandidates(): string[] {
    const user: any = this.sharedData.getUserData() || {};
    const ext: any = user.extension || {};
    return [ext.number, ext.username, user.username, user.uuid]
      .map((v) => (v === undefined || v === null ? '' : String(v).trim()))
      .filter((v, i, all) => v !== '' && all.indexOf(v) === i);
  }

  private socketUrl(): string {
    const base = ((typeof CONFIG !== 'undefined' && CONFIG.WEBSOCKETS_URL) || '').replace(/\/$/, '');
    return base + '/agent';
  }

  private openSocket(token: string, identities: string[]): void {
    const url = this.socketUrl();
    console.log('[ChannelPhone] connecting to', url);
    this.joining = true;
    this.setStatus('Connecting...');

    this.socket = new Socket(url, { params: { token } });

    this.socket.onError((err: any) => {
      console.error('[ChannelPhone] socket error — is the connectix gateway reachable at ' + url + '?', err);
      if (!this.joined) {
        this.setStatus('Connection Failed');
        this.events.publish('phone:webrtc-error', {
          title: 'Phone connection failed',
          message: 'Could not reach the server socket at ' + url + '.'
        });
      } else {
        this.setStatus('Disconnected');
      }
    });

    this.socket.onClose(() => {
      console.warn('[ChannelPhone] socket closed');
      this.joined = false;
      this.joining = false;
      this.setStatus('Unregistered');
    });

    this.socket.connect();
    this.joinNext(identities, 0);
  }

  /**
   * Join `phone:<identity>`, walking the identity list. The box refuses a topic
   * that is not one of the session's own identities, so the first accepted one
   * is the right one — and if none are, that is a hard, visible failure.
   */
  private joinNext(identities: string[], index: number): void {
    if (!this.socket) { return; }

    if (index >= identities.length) {
      this.joining = false;
      console.error(
        '[ChannelPhone] the server refused every phone topic we could build: ' +
        identities.map((i) => 'phone:' + i).join(', ')
      );
      this.setStatus('Unregistered');
      this.events.publish('phone:webrtc-error', {
        title: 'Phone not authorized',
        message: 'The server refused this account\'s phone channel (' + identities.join(', ') + ').'
      });
      this.settleJoinWaiters('The server refused this account\'s phone channel.');
      return;
    }

    const identity = identities[index];
    const topic = 'phone:' + identity;
    console.log('[ChannelPhone] joining', topic);

    const chan = this.socket.channel(topic, {});
    this.bindChannel(chan);

    chan.join()
      .receive('ok', () => {
        this.channel = chan;
        this.extension = identity;
        this.joined = true;
        this.joining = false;
        console.log('[ChannelPhone] joined', topic);
        this.setStatus('Ready');
        this.settleJoinWaiters(null);
      })
      .receive('error', (err: any) => {
        console.warn('[ChannelPhone] join refused for ' + topic + ':', err);
        try { chan.leave(); } catch (e) { /* already dead */ }
        this.joinNext(identities, index + 1);
      })
      .receive('timeout', () => {
        console.error('[ChannelPhone] join timed out for ' + topic);
        try { chan.leave(); } catch (e) { /* already dead */ }
        this.joining = false;
        this.setStatus('Connection Failed');
        this.events.publish('phone:webrtc-error', {
          title: 'Phone connection timed out',
          message: 'The server did not answer the join for ' + topic + '.'
        });
        this.settleJoinWaiters('The server did not answer the join for ' + topic + '.');
      });
  }

  private settleJoinWaiters(error: string | null): void {
    const waiters = this.joinWaiters;
    this.joinWaiters = [];
    waiters.forEach((w) => (error ? w.reject(error) : w.resolve()));
  }

  /**
   * Resolve once the channel is joined. A join may be in flight (first start,
   * or the rejoin every hangup triggers), so callers wait rather than getting a
   * spurious "not connected".
   */
  private whenJoined(timeoutMs = 8000): Promise<void> {
    if (this.joined && this.channel) { return Promise.resolve(); }
    if (!this.socket || !this.joining) {
      return Promise.reject('Phone not connected. The server channel is not joined.');
    }
    return new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve: () => { clearTimeout(timer); resolve(); },
        reject: (e: any) => { clearTimeout(timer); reject(e); }
      };
      const timer = setTimeout(() => {
        this.joinWaiters = this.joinWaiters.filter((w) => w !== waiter);
        reject('Timed out waiting for the phone channel to join.');
      }, timeoutMs);
      this.joinWaiters.push(waiter);
    });
  }

  private bindChannel(chan: Channel): void {
    // A channel that errors or closes is NOT joined any more — without this the
    // client keeps believing it can dial into a dead server peer.
    chan.onError(() => {
      if (this.channel === chan) {
        console.error('[ChannelPhone] phone channel errored — no longer joined');
        this.joined = false;
        this.setStatus('Disconnected');
      }
    });
    chan.onClose(() => {
      if (this.channel === chan) {
        console.warn('[ChannelPhone] phone channel closed');
        this.joined = false;
      }
    });
    chan.on('answer', (payload: any) => this.onAnswer(payload));
    chan.on('ice', (payload: any) => this.onRemoteIce(payload));
    chan.on('status', (payload: any) => this.onStatus(payload));
    chan.on('error', (payload: any) => {
      const reason = (payload && payload.reason) || 'unknown';
      console.error('[ChannelPhone] server error:', reason);
      this.events.publish('phone:webrtc-error', {
        title: 'Phone error',
        message: 'Server rejected the request (' + reason + ').'
      });
      this.failActiveCall(reason);
    });
  }

  /** Re-join. Mirrors `WebRTCPhone.checkStatus()`. */
  checkStatus(): void {
    if (!this.joined) {
      this.start(true);
    }
  }

  /** There is no REGISTER here — joining the channel IS the registration. */
  register(): void {
    if (this.joined) {
      this.unregister();
    } else {
      this.start(true);
    }
  }

  unregister(): void {
    console.log('[ChannelPhone] unregister (leaving the phone channel)');
    this.endMedia();
    this.teardownSocket();
    this.setStatus('Unregistered');
  }

  end(): void {
    this.unregister();
  }

  private teardownSocket(): void {
    if (this.channel) {
      try { this.channel.leave(); } catch (e) { /* already dead */ }
      this.channel = null;
    }
    if (this.socket) {
      try { this.socket.disconnect(); } catch (e) { /* already dead */ }
      this.socket = null;
    }
    this.joined = false;
    this.joining = false;
  }

  // ── outgoing call ──────────────────────────────────────────────────────────

  /**
   * Place a call. `caller_id_number` and `options` are accepted for signature
   * compatibility with the other transports; the box derives the caller from
   * the authenticated session, so they are not sent.
   */
  call(target: string, caller_id_number?: string, options?: any): Promise<any> {
    const number = String(target || '').replace(/[\s\-\(\)]/g, '');
    console.log('[ChannelPhone] call ->', number, 'options:', options);

    if (!number) {
      return Promise.reject('No number to call');
    }

    if (options && (options.leg_b_type === 'conference' || options.transfer_type)) {
      const msg = 'Conference and transfer are not available on the connectix WebRTC transport.';
      console.error('[ChannelPhone] ' + msg);
      this.events.publish('phone:call-error', { type: 'unsupported', message: msg });
      return Promise.reject(msg);
    }

    // A rejoin may be in flight (every hangup triggers one — see
    // `resetPeerSession`), so "not joined yet" is only fatal with no socket.
    if (!this.socket || (!this.joined && !this.joining)) {
      const msg = 'Phone not connected. The server channel is not joined.';
      console.error('[ChannelPhone] ✗ ' + msg);
      this.events.publish('phone:call-error', { type: 'not_connected', message: msg });
      return Promise.reject(msg);
    }

    if (this.activeCall) {
      const msg = 'Already in a call — hang up first.';
      console.error('[ChannelPhone] ✗ ' + msg);
      this.events.publish('phone:call-error', { type: 'busy', message: msg });
      return Promise.reject(msg);
    }

    const uuid = number + 'outgoing';
    this.activeCall = { uuid, target: number, dialed: false, connected: false, timer: null };
    this.events.publish('sip:call-message', this.logMessage(uuid, number, 'connecting'));
    this.events.publish('phone:webrtc-event', { session_id: uuid, type: 'progress' });

    return this.whenJoined()
      .then(() => this.startMedia())
      .then(() => this.negotiate())
      .then(() => {
        // Dial once media is actually flowing (or the peer reports connected),
        // so the bot's first words are not lost into a half-open peer.
        this.armConnectTimeout();
        return true;
      })
      .catch((err) => {
        const msg = this.describeError(err);
        console.error('[ChannelPhone] ✗ call failed:', err);
        this.events.publish('phone:call-error', { type: 'call_failed', message: msg });
        this.events.publish('phone:webrtc-error', { title: 'Call failed', message: msg });
        this.failActiveCall(msg);
        return Promise.reject(msg);
      });
  }

  /** Grab the mic. A denied permission must be loud, never a dead button. */
  private startMedia(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject('This browser has no microphone API (getUserMedia).');
    }
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        this.localStream = stream;
      })
      .catch((err) => {
        console.error('[ChannelPhone] ✗ microphone unavailable:', err);
        this.events.publish('phone:webrtc-error', {
          title: 'Microphone not available',
          message: 'Allow microphone access to place a call (' + this.describeError(err) + ').'
        });
        return Promise.reject('Microphone permission denied or no input device.');
      });
  }

  /** Build the peer connection, offer, and push it to the channel. */
  private negotiate(): Promise<void> {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers() });
    this.pc = pc;
    this.pendingIce = [];

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream as MediaStream));
    }

    this.remoteStream = new MediaStream();

    pc.ontrack = (event: RTCTrackEvent) => {
      console.log('[ChannelPhone] remote track', event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else if (this.remoteStream) {
        this.remoteStream.addTrack(event.track);
      }
      // A track arriving mid-call (renegotiation replaces the receiver) is
      // enabled by default, so a held call would start making noise again.
      this.applyAudioGates();
      this.attachRemoteAudio();
    };

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && this.channel) {
        this.channel.push('ice', event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[ChannelPhone] pc state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.onConnected();
      } else if (pc.connectionState === 'failed') {
        console.error('[ChannelPhone] ✗ ICE/DTLS failed — no media path to the server');
        this.events.publish('phone:webrtc-error', {
          title: 'Media connection failed',
          message: 'The browser could not establish a media path to the server (ICE failed).'
        });
        this.failActiveCall('ice_failed');
      }
    };

    return pc.createOffer({ offerToReceiveAudio: true } as RTCOfferOptions)
      .then((offer) => pc.setLocalDescription(offer).then(() => offer))
      .then((offer) => {
        if (!this.channel) { return Promise.reject('Channel closed while negotiating'); }
        console.log('[ChannelPhone] sending offer');
        // Never a bare push: an offer the server cannot accept must surface as
        // a named failure, not as a 15s silence ending in a generic timeout.
        this.channel.push('offer', { sdp: offer.sdp, type: offer.type })
          .receive('error', (err: any) => {
            const reason = (err && err.reason) || 'offer_rejected';
            console.error('[ChannelPhone] ✗ the server rejected the offer:', reason);
            this.events.publish('phone:webrtc-error', {
              title: 'Call setup failed',
              message: 'The server rejected the call setup (' + reason + ').'
            });
            this.failActiveCall(reason);
          })
          .receive('timeout', () => {
            console.error('[ChannelPhone] ✗ the server did not acknowledge the offer');
            this.events.publish('phone:webrtc-error', {
              title: 'Call setup failed',
              message: 'The server did not acknowledge the call setup.'
            });
            this.failActiveCall('offer_timeout');
          });
        return undefined;
      });
  }

  /** ICE servers come from runtime config; none = host candidates only (LAN/localhost). */
  private iceServers(): RTCIceServer[] {
    const configured = (typeof CONFIG !== 'undefined' && CONFIG.WEBRTC_ICE_SERVERS) || null;
    if (Array.isArray(configured) && configured.length) {
      return configured;
    }
    console.log('[ChannelPhone] no CONFIG.WEBRTC_ICE_SERVERS — using host candidates only');
    return [];
  }

  private onAnswer(payload: any): void {
    if (!this.pc) {
      console.warn('[ChannelPhone] answer arrived with no peer connection — ignoring');
      return;
    }
    console.log('[ChannelPhone] answer received');
    this.pc.setRemoteDescription(new RTCSessionDescription({
      type: (payload && payload.type) || 'answer',
      sdp: payload && payload.sdp
    }))
      .then(() => {
        const queued = this.pendingIce;
        this.pendingIce = [];
        queued.forEach((c) => this.addIce(c));
      })
      .catch((err) => {
        console.error('[ChannelPhone] ✗ could not apply the server answer:', err);
        this.events.publish('phone:webrtc-error', {
          title: 'Call setup failed',
          message: 'The server answer could not be applied (' + this.describeError(err) + ').'
        });
        this.failActiveCall('bad_answer');
      });
  }

  private onRemoteIce(payload: any): void {
    if (!this.pc || !this.pc.remoteDescription) {
      this.pendingIce.push(payload);
      return;
    }
    this.addIce(payload);
  }

  private addIce(payload: any): void {
    if (!this.pc || !payload) { return; }
    this.pc.addIceCandidate(new RTCIceCandidate(payload))
      .catch((err) => console.warn('[ChannelPhone] ignored bad remote candidate:', err));
  }

  private onStatus(payload: any): void {
    const status = payload && payload.status;
    console.log('[ChannelPhone] server status:', status);
    if (status === 'connected') {
      this.onConnected();
    }
  }

  /**
   * Media is up. Send the `dial` now (once), and report the call as answered.
   * Fires from whichever arrives first: the server's `status: connected` or the
   * browser's own `connectionState === 'connected'`.
   */
  private onConnected(): void {
    const call = this.activeCall;
    if (!call || call.connected) { return; }
    call.connected = true;
    this.clearConnectTimeout();
    this.attachRemoteAudio();

    if (!call.dialed && this.channel) {
      call.dialed = true;
      console.log('[ChannelPhone] dialing', call.target);
      this.channel.push('dial', { to: call.target })
        .receive('ok', () => {
          console.log('[ChannelPhone] dial accepted for', call.target);
          this.events.publish('phone:webrtc-event', { session_id: call.uuid, type: 'accepted' });
          this.events.publish('sip:call-message', this.logMessage(call.uuid, call.target, 'answer'));
        })
        .receive('error', (err: any) => {
          const reason = (err && err.reason) || 'dial_failed';
          const msg = reason === 'not_found'
            ? call.target + ' is not a number this server can reach.'
            : 'The server refused the call (' + reason + ').';
          console.error('[ChannelPhone] ✗ dial refused:', reason);
          this.events.publish('phone:call-error', { type: reason, message: msg });
          this.events.publish('phone:webrtc-error', { title: 'Call failed', message: msg });
          this.hangup(call.uuid);
        })
        .receive('timeout', () => {
          const msg = 'The server did not answer the dial request.';
          console.error('[ChannelPhone] ✗ dial timed out');
          this.events.publish('phone:call-error', { type: 'timeout', message: msg });
          this.events.publish('phone:webrtc-error', { title: 'Call failed', message: msg });
          this.hangup(call.uuid);
        });
    }
  }

  private armConnectTimeout(): void {
    const call = this.activeCall;
    if (!call) { return; }
    call.timer = setTimeout(() => {
      if (this.activeCall === call && !call.connected) {
        const msg = 'The call could not connect (no media path within ' +
          Math.round(this.connectTimeoutMs / 1000) + 's).';
        console.error('[ChannelPhone] ✗ ' + msg);
        this.events.publish('phone:call-error', { type: 'connect_timeout', message: msg });
        this.events.publish('phone:webrtc-error', { title: 'Call failed', message: msg });
        this.failActiveCall('connect_timeout');
      }
    }, this.connectTimeoutMs);
  }

  private clearConnectTimeout(): void {
    if (this.activeCall && this.activeCall.timer) {
      clearTimeout(this.activeCall.timer);
      this.activeCall.timer = null;
    }
  }

  /** Attach the remote stream to the page's audio element so the user HEARS it. */
  private attachRemoteAudio(): void {
    if (!this.remoteStream) { return; }
    const el = document.getElementById('audioRemote') as HTMLAudioElement | null;
    if (!el) {
      console.warn('[ChannelPhone] no #audioRemote element — the call will be silent');
      return;
    }
    if (el.srcObject !== this.remoteStream) {
      el.srcObject = this.remoteStream;
    }
    const played: any = el.play();
    if (played && played.catch) {
      played.catch((err: any) => {
        console.warn('[ChannelPhone] audio playback blocked by the browser:', err);
        this.events.publish('phone:webrtc-error', {
          title: 'Audio blocked',
          message: 'The browser blocked audio playback — tap the page and try again.'
        });
      });
    }
  }

  // ── call control ───────────────────────────────────────────────────────────

  /**
   * Incoming calls do not exist on this transport yet — the channel only
   * signals a browser-originated peer. Fail loudly rather than silently.
   */
  answer(call_uuid?: string): Promise<any> {
    const msg = 'Incoming calls are not supported by the connectix WebRTC transport yet.';
    console.error('[ChannelPhone] answer(' + call_uuid + '): ' + msg);
    return Promise.reject(msg);
  }

  hangup(call_id?: string, options?: any): Promise<any> {
    const call = this.activeCall;
    const uuid = call ? call.uuid : call_id;
    console.log('[ChannelPhone] hangup', uuid, options || {});

    if (this.channel && this.joined) {
      this.channel.push('hangup', {});
    }

    const hadCall = !!call || !!this.pc;
    this.endMedia();

    if (uuid) {
      this.events.publish('phone:webrtc-event', { session_id: uuid, type: 'hangup' });
      this.events.publish('sip:call-message',
        this.logMessage(uuid, call ? call.target : '', 'hangup'));
    }

    if (hadCall) { this.resetPeerSession(); }

    return Promise.resolve();
  }

  /**
   * Get a fresh server-side peer for the NEXT call.
   *
   * `PhoneChannel.handle_in("hangup", …)` stops the peer and assigns
   * `peer: nil`, and a peer is only ever started in `join/3`. So a second
   * `offer` on the same joined channel would hit `GenServer.call(nil, …)` —
   * an EXIT that kills the channel process, which the browser sees only as a
   * call that never gets an answer. Leaving and re-joining is what mints a new
   * peer, so every call starts from a clean one.
   */
  private resetPeerSession(): void {
    if (!this.socket || !this.extension) { return; }
    console.log('[ChannelPhone] re-joining phone:' + this.extension + ' for a fresh peer');

    if (this.channel) {
      try { this.channel.leave(); } catch (e) { /* already dead */ }
      this.channel = null;
    }
    this.joined = false;
    this.joining = true;
    this.setStatus('Connecting...');
    this.joinNext([this.extension], 0);
  }

  /**
   * Mute/unmute the microphone. Accepts both the facade's
   * `(call_id, {action: 'mute'|'unmute'})` and a plain `mute(true|false)`.
   */
  mute(call_id?: any, options?: any): Promise<any> {
    const muted = typeof call_id === 'boolean'
      ? call_id
      : !(options && options.action === 'unmute');

    if (!this.localStream) {
      return Promise.reject('No active microphone stream');
    }

    this.muted = muted;
    this.applyAudioGates();
    console.log('[ChannelPhone] mic', muted ? 'muted' : 'unmuted');
    return Promise.resolve();
  }

  /**
   * Hold the call — BOTH directions, not just the microphone.
   *
   * This was aliased to `mute()`, which only stops what we SEND. The far end
   * kept talking and the user kept hearing them while the UI said "on hold":
   * the same category of bug as a hold that silently fails to engage, and the
   * one users report as "hold doesn't work". Hold therefore gates the remote
   * tracks too, so held means silent in both directions.
   *
   * There is no re-INVITE here (the media stays up; we gate the tracks), so
   * unlike a SIP-side hold there is no "re-invite in progress" race to retry
   * around — a rapid hold → unhold is just two boolean flips. What this does
   * NOT do is tell the far end it is on hold, so there is no music-on-hold and
   * no `a=sendonly`; that needs a server-side hold on the channel.
   */
  hold(call_id: string, options: any): Promise<any> {
    const holding = !options || options.action !== 'unhold';

    if (!this.localStream && !this.remoteStream) {
      return Promise.reject('No active call to hold');
    }

    this.held = holding;
    this.applyAudioGates();
    console.log('[ChannelPhone] call', holding ? 'held' : 'resumed');

    const call = this.activeCall;
    if (call) {
      this.events.publish('phone:webrtc-event', {
        session_id: call.uuid,
        type: holding ? 'hold' : 'unhold'
      });
    }

    return Promise.resolve();
  }

  /**
   * Apply mute+hold to the live tracks.
   *
   * We send while neither gate is closed, and we render the far end while not
   * held (mute is the microphone only — muting must never deafen the user).
   */
  private applyAudioGates(): void {
    const sending = !this.muted && !this.held;

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => { t.enabled = sending; });
    }
    if (this.remoteStream) {
      this.remoteStream.getAudioTracks().forEach((t) => { t.enabled = !this.held; });
    }
  }

  sendDtmf(tones: string, call_uuid?: string): void {
    if (!this.pc) {
      console.error('[ChannelPhone] sendDtmf with no peer connection');
      return;
    }
    const sender = this.pc.getSenders().find((s) => !!s.track && s.track.kind === 'audio');
    if (sender && (sender as any).dtmf) {
      (sender as any).dtmf.insertDTMF(tones, 100, 70);
    } else {
      console.error('[ChannelPhone] no RTCDTMFSender available — DTMF not sent');
    }
  }

  forward(target: string, caller_id_number?: string, options?: any): Promise<any> {
    const msg = 'Transfer is not available on the connectix WebRTC transport.';
    console.error('[ChannelPhone] forward(' + target + '): ' + msg);
    return Promise.reject(msg);
  }

  merge(call_uuid: string): Promise<any> {
    const msg = 'Conference merge is not available on the connectix WebRTC transport.';
    console.error('[ChannelPhone] merge(' + call_uuid + '): ' + msg);
    return Promise.reject(msg);
  }

  conferenceDeleteMember(call_id: string, options?: any): Promise<any> {
    const msg = 'Conference control is not available on the connectix WebRTC transport.';
    console.error('[ChannelPhone] conferenceDeleteMember(' + call_id + '): ' + msg);
    return Promise.reject(msg);
  }

  /** No server-assigned uuid on this transport — the client uuid stays authoritative. */
  outgoingCallSetUuid(uuid: string): void {
    console.log('[ChannelPhone] outgoingCallSetUuid ignored (client-side uuid):', uuid);
  }

  // ── teardown / helpers ─────────────────────────────────────────────────────

  private failActiveCall(reason: string): void {
    const call = this.activeCall;
    if (!call) {
      this.endMedia();
      return;
    }
    this.events.publish('phone:webrtc-event', { session_id: call.uuid, type: 'failed' });
    this.events.publish('sip:call-message', this.logMessage(call.uuid, call.target, 'hangup'));
    console.error('[ChannelPhone] call ' + call.uuid + ' failed:', reason);
    // Tell the server too — its peer already holds this call's remote
    // description, and re-offering into it is not a supported renegotiation.
    if (this.channel && this.joined) { this.channel.push('hangup', {}); }
    this.endMedia();
    this.resetPeerSession();
  }

  private endMedia(): void {
    this.clearConnectTimeout();

    if (this.pc) {
      try { this.pc.close(); } catch (e) { /* already closed */ }
      this.pc = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.remoteStream = null;
    this.pendingIce = [];
    this.activeCall = null;
    // Gates belong to the call that just ended — a new call must not inherit
    // "held" from the last one and start out silent in both directions.
    this.muted = false;
    this.held = false;

    const el = document.getElementById('audioRemote') as HTMLAudioElement | null;
    if (el) { el.srcObject = null; }
  }

  /** The call-card payload shape the UI already consumes. */
  private logMessage(uuid: string, target: string, type: string): any {
    return {
      call: {
        direction: 'outgoing',
        type: 'extension_to_number',
        uuid,
        answered_at: Math.floor(Date.now() / 1000)
      },
      consumer: { type: 'contact', caller_id_number: target },
      conference: {},
      screen: {},
      campaign: {},
      did: null,
      type,
      auto_answer: false
    };
  }

  private setStatus(status: string): void {
    this.status = status;
    console.log('[ChannelPhone] status:', status);
    this.events.publish('phone:webrtc-state', status);
  }

  getStatus(): string {
    return this.status;
  }

  isJoined(): boolean {
    return this.joined;
  }

  private describeError(err: any): string {
    if (!err) { return 'unknown error'; }
    if (typeof err === 'string') { return err; }
    return err.message || err.name || String(err);
  }
}
