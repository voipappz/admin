import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { UserData } from '../user-data';
import { HandleRequest } from '../../_base/layout/services/handleRequest.service';
import { Events } from '../events';
import {
  UserAgent,
  UserAgentOptions,
  UserAgentState,
  Registerer,
  RegistererState,
  Inviter,
  Invitation,
  Session,
  SessionState,
  SessionDescriptionHandler,
  URI,
  TransportState
} from 'sip.js';
import { SessionDescriptionHandlerOptions } from 'sip.js/lib/platform/web';

declare var CONFIG: any;

/**
 * WebRTC Phone Service using SIP.js 0.21.x
 * Provides WebRTC-based SIP calling functionality
 */
@Injectable()
export class WebRTCPhone {
  ctxSip: any = {
    callActiveID: null,
    stream: null,
    phone: null
  };
  private userAgent: UserAgent | null = null;
  private registerer: Registerer | null = null;

  devices: MediaDeviceInfo[] = [];
  active_device: string | undefined;
  sessions: { [key: string]: Session } = {};
  phone_extension: any = {};
  active_call: any;
  reject_all: boolean = false;
  last_outgoing_call_target: { target: string; uuid: string | undefined } = { target: '', uuid: undefined };

  // SIP domain - stored for easy access during calls
  private sipDomain: string = '';

  // Auto-reconnect properties (transport level)
  private manualDisconnect: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000; // 3 seconds
  private reconnectTimer: any = null;
  private isReconnecting: boolean = false;

  // Registration retry properties (SIP level). Ported from the va-voipbox-admin
  // / connectix JsSIP softphone which keeps retrying REGISTER indefinitely so a
  // transient REGISTER failure (408/503, network blip) never leaves the phone
  // silently unregistered. SIP.js 0.21.x does NOT auto-retry a failed register.
  private registrationAttempts: number = 0;
  private registrationRetryBaseDelay: number = 2000;   // first retry after 2s
  private registrationRetryMaxDelay: number = 30000;   // cap backoff at 30s
  private registrationRetryTimer: any = null;
  private isRetryingRegistration: boolean = false;
  // Whether the registerer is supposed to be registered right now. Set true on
  // register(), false on deliberate unregister — distinguishes an expected
  // unregister from an unexpected drop that should trigger recovery.
  private wantRegistered: boolean = false;

  // Registration watchdog: a periodic health check that re-registers if the
  // phone has silently drifted out of the Registered state while it should be up.
  private watchdogTimer: any = null;
  private watchdogIntervalMs: number = 30000; // every 30s

  constructor(
    private events: Events,
    public http: HttpClient,
    public handleRequest: HandleRequest,
    private sharedData: UserData
  ) {
    console.log('[WebRTCPhone] Initialized with SIP.js 0.21.x');

    this.updateDeviceList('');

    this.events.subscribe('phone:reject-calls', (data) => {
      console.log('phone:reject-calls', data);
      this.reject_all = data;
    });

    this.events.subscribe('phone:device-selected', (data) => {
      console.log('phone:device-selected', data);
      this.active_device = data;
    });

    addEventListener('devicechange', (event) => {
      this.updateDeviceList(event);
    });

    if (navigator.mediaDevices) {
      navigator.mediaDevices.ondevicechange = (event) => {
        this.updateDeviceList(event);
      };
    }
  }

  updateDeviceList(event: any): void {
    console.log('[WebRTCPhone] updateDeviceList', event);
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        this.devices = devices;
        console.log('[WebRTCPhone] devices', this.devices);
        this.events.publish('phone:devices-list-event', {
          inputs: this.devices.filter((d) => d.kind === 'audioinput'),
          outputs: this.devices.filter((d) => d.kind === 'audiooutput')
        });
      });
    }
  }

  sendDtmf(tones: string, call_uuid: string): void {
    console.log('[WebRTCPhone] sendDtmf', tones, call_uuid);
    const session = this.sessions[call_uuid];
    if (session && session.sessionDescriptionHandler) {
      const sdh = session.sessionDescriptionHandler as any;
      if (sdh.sendDtmf) {
        sdh.sendDtmf(tones);
      } else {
        // Use peerConnection to send DTMF via RTCDTMFSender
        const peerConnection = sdh.peerConnection as RTCPeerConnection;
        if (peerConnection) {
          const senders = peerConnection.getSenders();
          const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
          if (audioSender && audioSender.dtmf) {
            audioSender.dtmf.insertDTMF(tones, 100, 70);
          }
        }
      }
    }
  }

  checkStatus(): void {
    console.log('[WebRTCPhone] checkStatus');
    if (this.registerer && this.registerer.state !== RegistererState.Registered) {
      this.wantRegistered = true;
      this.doRegister();
    }
  }

  unregister(): void {
    console.log('[WebRTCPhone] unregister');
    // Prevent auto-reconnect / re-register after deliberate unregister
    this.manualDisconnect = true;
    this.wantRegistered = false;
    this.cancelReconnect();
    this.cancelRegistrationRetry();
    this.stopRegistrationWatchdog();

    if (this.registerer) {
      this.registerer.unregister().catch((err) => {
        console.error('[WebRTCPhone] Unregister failed:', err);
      });
    }
    if (this.userAgent) {
      this.userAgent.stop().catch((err) => {
        console.error('[WebRTCPhone] Stop failed:', err);
      });
    }
    this.sessions = {};
  }

  register(): void {
    console.log('[WebRTCPhone] register');
    if (this.registerer) {
      if (this.registerer.state !== RegistererState.Registered) {
        this.wantRegistered = true;
        this.doRegister();
      } else {
        // Toggle off — deliberate unregister
        this.wantRegistered = false;
        this.cancelRegistrationRetry();
        this.registerer.unregister().catch((err) => {
          console.error('[WebRTCPhone] Unregister failed:', err);
        });
      }
    }
  }

  /**
   * Send a single REGISTER. On failure, schedule a backed-off retry instead of
   * giving up — this is the core robustness fix vs. the previous one-shot
   * register that left the phone dead after any transient failure.
   */
  private doRegister(): void {
    if (!this.registerer) {
      return;
    }
    console.log('[SIP.js] Sending REGISTER request...');
    this.registerer.register().catch((err) => {
      console.error('[SIP.js] Registration request rejected:', err);
      // Keep trying as long as we are supposed to be registered.
      if (this.wantRegistered && !this.manualDisconnect) {
        this.scheduleRegistrationRetry();
      }
    });
  }

  /**
   * Retry REGISTER with exponential backoff (capped). Runs as long as the phone
   * is meant to be registered, mirroring the JsSIP softphone's persistent retry.
   */
  private scheduleRegistrationRetry(): void {
    if (this.isRetryingRegistration) {
      return;
    }
    if (!this.wantRegistered || this.manualDisconnect) {
      return;
    }
    this.isRetryingRegistration = true;
    this.registrationAttempts++;

    // 2s, 4s, 8s, 16s, 30s, 30s, ... (capped)
    const delay = Math.min(
      this.registrationRetryBaseDelay * Math.pow(2, this.registrationAttempts - 1),
      this.registrationRetryMaxDelay
    );

    console.log(`[SIP.js] Scheduling REGISTER retry #${this.registrationAttempts} in ${delay}ms`);
    this.setStatus(`Registering (retry ${this.registrationAttempts})...`);

    this.registrationRetryTimer = setTimeout(() => {
      this.isRetryingRegistration = false;
      if (!this.wantRegistered || this.manualDisconnect) {
        return;
      }
      // If the transport dropped, the transport-level reconnect will rebuild the
      // UA and re-register; only re-issue REGISTER here when transport is up.
      const transportConnected =
        this.userAgent?.transport?.state === TransportState.Connected;
      if (this.registerer && transportConnected) {
        this.doRegister();
      } else {
        // Transport not ready yet — keep the retry loop alive for when it is.
        this.scheduleRegistrationRetry();
      }
    }, delay);
  }

  cancelRegistrationRetry(): void {
    if (this.registrationRetryTimer) {
      clearTimeout(this.registrationRetryTimer);
      this.registrationRetryTimer = null;
    }
    this.isRetryingRegistration = false;
    this.registrationAttempts = 0;
  }

  /**
   * Periodic watchdog: while the phone is meant to be up, verify transport is
   * connected and the registerer is Registered. If it has silently drifted,
   * kick a recovery. This catches edge cases the event listeners miss (e.g. a
   * registration that expired without a clean Unregistered event).
   */
  private startRegistrationWatchdog(): void {
    this.stopRegistrationWatchdog();
    this.watchdogTimer = setInterval(() => {
      if (!this.wantRegistered || this.manualDisconnect) {
        return;
      }
      const transportState = this.userAgent?.transport?.state;
      const registered = this.registerer?.state === RegistererState.Registered;

      if (transportState === TransportState.Connected && !registered && !this.isRetryingRegistration) {
        console.warn('[SIP.js] Watchdog: transport up but not registered — re-registering');
        this.doRegister();
      } else if (transportState === TransportState.Disconnected && !this.isReconnecting) {
        console.warn('[SIP.js] Watchdog: transport down — triggering reconnect');
        this.attemptReconnect();
      }
    }, this.watchdogIntervalMs);
  }

  private stopRegistrationWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  start(login_flag = false): boolean {
    console.log('[WebRTCPhone] start', login_flag);
    const userData = this.sharedData.getUserData();
    const agent_extension = userData?.extension;
    const user_environment = userData?.environment;

    console.log('[WebRTCPhone] userData:', userData);
    console.log('[WebRTCPhone] extension:', agent_extension);
    console.log('[WebRTCPhone] environment:', user_environment);

    if (!agent_extension) {
      console.warn('[WebRTCPhone] No extension data available - WebRTC mode unavailable');
      this.setStatus('No Extension');
      this.events.publish('phone:mode-unavailable', { mode: 'webrtc', reason: 'no_extension' });
      return false;
    }

    // Merge extension with user's environment (environment is at user level, not extension level)
    this.phone_extension = {
      ...agent_extension,
      environment: user_environment || agent_extension.environment
    };

    console.log('[WebRTCPhone] merged phone_extension:', this.phone_extension);

    if (this.userAgent) {
      if (login_flag) {
        this.createUA(this.phone_extension);
      } else {
        this.userAgent.start().catch((err) => {
          console.error('[WebRTCPhone] Start failed:', err);
        });
      }
    } else {
      this.createUA(this.phone_extension);
    }
    return true;
  }

  end(): void {
    console.log('[WebRTCPhone] end');
    this.wantRegistered = false;
    this.cancelRegistrationRetry();
    this.stopRegistrationWatchdog();
    if (this.userAgent) {
      this.userAgent.stop().catch((err) => {
        console.error('[WebRTCPhone] Stop failed:', err);
      });
    }
    this.sessions = {};
  }

  outgoingCallSetUuid(uuid: string): void {
    console.log('[WebRTCPhone] outgoingCallSetUuid', uuid);
    this.last_outgoing_call_target.uuid = uuid;
    const tempSession = this.sessions[this.last_outgoing_call_target.target + 'outgoing'];
    if (tempSession) {
      this.sessions[uuid] = tempSession;
      (tempSession as any).ctxid = uuid;
    }
  }

  call(target: string, caller_id_number: string, options?: any): Promise<any> {
    // Strip spaces, dashes, parentheses from phone number for valid SIP URI
    target = target.replace(/[\s\-\(\)]/g, '');
    console.log('[SIP.js] ========= MAKING CALL =========');
    console.log('[SIP.js] Target:', target);
    console.log('[SIP.js] Caller ID:', caller_id_number);
    console.log('[SIP.js] Options:', options);

    if (options && options.leg_b_type === 'conference') {
      console.log('[WebRTCPhone] forwarding the call...');
      return this.forward(target, caller_id_number, options);
    }

    // Pre-flight validation
    if (!this.userAgent) {
      console.error('[SIP.js] ✗ Cannot call - UserAgent not initialized. No extension data available.');
      this.events.publish('phone:call-error', {
        type: 'not_initialized',
        message: 'WebRTC phone not available. Please check your extension configuration.'
      });
      return Promise.reject('UserAgent not initialized - no extension data');
    }

    if (this.userAgent.state !== UserAgentState.Started) {
      console.error('[SIP.js] ✗ Cannot call - UserAgent is', this.userAgent.state);
      return Promise.reject('Phone not connected. Please reconnect.');
    }

    if (!this.sipDomain) {
      console.error('[SIP.js] ✗ Cannot call - SIP domain not configured');
      console.error('[SIP.js] phone_extension:', this.phone_extension);
      return Promise.reject('SIP domain not configured');
    }

    if (!this.registerer || this.registerer.state !== RegistererState.Registered) {
      console.error('[SIP.js] ✗ Cannot call - not registered');
      console.error('[SIP.js] Registerer state:', this.registerer ? RegistererState[this.registerer.state] : 'null');
      return Promise.reject('Not registered with SIP server');
    }

    console.log('[SIP.js] ✓ Pre-flight checks passed');
    console.log('[SIP.js] UserAgent state:', this.userAgent.state);
    console.log('[SIP.js] Registerer state:', RegistererState[this.registerer.state]);
    console.log('[SIP.js] SIP Domain:', this.sipDomain);

    try {
      const session = this.call_invite(target, caller_id_number);
      if (session) {
        (session as any).direction = 'outgoing';
        (session as any).target = target;
        this.last_outgoing_call_target.target = target;
        this.newSession(session, 'outgoing');
        return Promise.resolve(true);
      } else {
        const uri = `sip:${target}@${this.sipDomain}`;
        console.error('[SIP.js] ✗ call_invite returned null. URI was:', uri);
        return Promise.reject('Failed to create call. Check console for details.');
      }
    } catch (e) {
      console.error('[SIP.js] ✗ call error:', e);
      return Promise.reject(e);
    }
  }

  private call_invite(target: string, caller_id_number: string): Inviter | null {
    console.log('[SIP.js] call_invite starting...');
    console.log('[SIP.js] Target number:', target);
    console.log('[SIP.js] Domain:', this.sipDomain);

    if (!this.userAgent) {
      console.error('[SIP.js] ✗ UserAgent not available');
      return null;
    }

    const id = target + 'outgoing';
    const sipUri = `sip:${target}@${this.sipDomain}`;
    console.log('[SIP.js] Creating URI:', sipUri);

    try {
      const targetUri = UserAgent.makeURI(sipUri);
      if (!targetUri) {
        console.error('[SIP.js] ✗ Failed to create target URI from:', sipUri);
        return null;
      }
      console.log('[SIP.js] ✓ Target URI created:', targetUri.toString());

      const inviterOptions = {
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          }
        } as SessionDescriptionHandlerOptions,
        extraHeaders: [`X-Va-Call-Uuid: ${id}`, 'X-Va-Call-Direction: outgoing']
      };

      console.log('[SIP.js] Creating Inviter with options:', JSON.stringify(inviterOptions));
      const inviter = new Inviter(this.userAgent, targetUri, inviterOptions);
      console.log('[SIP.js] ✓ Inviter created');

      // Add session state listener
      inviter.stateChange.addListener((state: SessionState) => {
        console.log('[SIP.js] >>> Outgoing call state changed:', SessionState[state]);
        switch (state) {
          case SessionState.Initial:
            console.log('[SIP.js] Call in initial state');
            break;
          case SessionState.Establishing:
            console.log('[SIP.js] Call establishing (ringing on remote end)...');
            this.events.publish('phone:webrtc-event', { session_id: id, type: 'progress' });
            break;
          case SessionState.Established:
            console.log('[SIP.js] ✓ Call ESTABLISHED (remote answered)');
            this.events.publish('phone:webrtc-event', { session_id: id, type: 'accepted' });
            this.setupRemoteAudio(inviter);
            break;
          case SessionState.Terminating:
            console.log('[SIP.js] Call terminating...');
            break;
          case SessionState.Terminated:
            console.log('[SIP.js] Call TERMINATED');
            this.events.publish('phone:webrtc-event', { session_id: id, type: 'terminated' });
            break;
        }
      });

      console.log('[SIP.js] Sending INVITE to:', target, '...');
      inviter.invite()
        .then(() => {
          console.log('[SIP.js] ✓ INVITE sent successfully!');
        })
        .catch((err) => {
          console.error('[SIP.js] ✗ INVITE failed:', err);
          console.error('[SIP.js] Error details:', err.message || err);
          this.events.publish('phone:webrtc-event', { session_id: id, type: 'failed' });
          this.events.publish('sip:call-message', {
            type: 'failed',
            call: { uuid: id, direction: 'outgoing' },
            consumer: { caller_id_number: target },
            error: err.message || 'INVITE failed'
          });
        });

      return inviter;
    } catch (e) {
      console.error('[SIP.js] ✗ call_invite exception:', e);
      throw e;
    }
  }

  answer(sessionid: string): Promise<any> {
    console.log('[WebRTCPhone] answer', sessionid);
    const session = this.sessions[sessionid] as Invitation;

    if (!session) {
      console.error('[WebRTCPhone] Session not found:', sessionid);
      return Promise.reject('Session not found');
    }

    this.events.publish('phone:webrtc-event', { session_id: (session as any).ctxid, type: 'accept' });

    const options = {
      sessionDescriptionHandlerOptions: {
        constraints: {
          audio: true,
          video: false
        }
      } as SessionDescriptionHandlerOptions
    };

    return session.accept(options).then(() => {
      console.log('[WebRTCPhone] Call answered');
    }).catch((err) => {
      console.error('[WebRTCPhone] Answer failed:', err);
      throw err;
    });
  }

  forward(target: string, caller_id_number: string, options?: any): Promise<any> {
    console.log('[WebRTCPhone] forward', target, caller_id_number, options);

    if (!options || !options.leg_a || !options.leg_a.uuid) {
      return Promise.reject('Invalid options');
    }

    const session = this.sessions[options.leg_a.uuid];
    if (!session) {
      return Promise.reject('Session not found');
    }

    if (options.transfer_type === 'blind') {
      console.log('[WebRTCPhone] Blind transfer to:', target);
      const targetUri = UserAgent.makeURI(`sip:${target}@${this.phone_extension.environment?.domain}`);
      if (!targetUri) {
        return Promise.reject('Failed to create target URI');
      }

      // Use session.refer() for blind transfer in SIP.js 0.21.x
      return session.refer(targetUri).then(() => {
        this.last_outgoing_call_target = { target: '', uuid: undefined };
        this.events.publish('phone:webrtc-event', { session_id: (session as any).ctxid, type: 'hangup' });
      });
    } else {
      // Attended transfer
      console.log('[WebRTCPhone] Attended transfer to:', target);
      if (!this.userAgent) {
        return Promise.reject('UserAgent not available');
      }

      const targetUri = UserAgent.makeURI(`sip:${target}@${this.phone_extension.environment?.domain}`);
      if (!targetUri) {
        return Promise.reject('Failed to create target URI');
      }

      const inviter = new Inviter(this.userAgent, targetUri, {
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false }
        } as SessionDescriptionHandlerOptions
      });

      // For attended transfer: first invite, then refer
      return inviter.invite().then(() => {
        return session.refer(inviter);
      });
    }
  }

  merge(call_uuid: string): Promise<any> {
    console.log('[WebRTCPhone] merge', call_uuid);
    // Conference merge - requires server-side support
    return Promise.reject('Not implemented - requires server-side conference support');
  }

  hangup(sessionid: string, options?: any): Promise<any> {
    console.log('[WebRTCPhone] hangup', sessionid, this.sessions);
    let session = this.sessions[sessionid];

    if (!session) {
      session = this.sessions[this.last_outgoing_call_target.target + 'outgoing'];
      if (!session) {
        this.events.publish('phone:webrtc-event', { session_id: sessionid, type: 'hangup' });
        return Promise.reject('Session not found');
      }
      this.sessions[sessionid] = session;
      (session as any).ctxid = sessionid;
    }

    this.events.publish('phone:webrtc-event', { session_id: (session as any).ctxid, type: 'hangup' });

    const state = session.state;
    console.log('[WebRTCPhone] Session state:', state);

    if (state === SessionState.Established) {
      return session.bye().then(() => {
        this.last_outgoing_call_target = { target: '', uuid: undefined };
      });
    } else if (state === SessionState.Initial || state === SessionState.Establishing) {
      if (session instanceof Invitation) {
        return session.reject().then(() => {
          this.last_outgoing_call_target = { target: '', uuid: undefined };
        });
      } else if (session instanceof Inviter) {
        return session.cancel().then(() => {
          this.last_outgoing_call_target = { target: '', uuid: undefined };
        });
      }
    }

    this.last_outgoing_call_target = { target: '', uuid: undefined };
    return Promise.resolve();
  }

  hold(sessionid: string, options: any): Promise<any> {
    console.log('[WebRTCPhone] hold', sessionid, options);
    const session = this.sessions[sessionid];

    if (!session) {
      return Promise.reject('Session not found');
    }

    const sdh = session.sessionDescriptionHandler as any;
    if (!sdh || !sdh.peerConnection) {
      return Promise.reject('No peer connection');
    }

    const pc: RTCPeerConnection = sdh.peerConnection;

    if (options.action === 'hold') {
      // Hold: set sendonly for outgoing, recvonly for incoming
      pc.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.enabled = false;
        }
      });
    } else if (options.action === 'unhold') {
      pc.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.enabled = true;
        }
      });
    }

    return Promise.resolve();
  }

  mute(sessionid: string, options: any): Promise<any> {
    console.log('[WebRTCPhone] mute', sessionid, options);
    const session = this.sessions[sessionid];

    if (!session) {
      return Promise.reject('Session not found');
    }

    const sdh = session.sessionDescriptionHandler as any;
    if (!sdh || !sdh.peerConnection) {
      return Promise.reject('No peer connection');
    }

    const pc: RTCPeerConnection = sdh.peerConnection;

    if (options.action === 'mute') {
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = false;
        }
      });
    } else if (options.action === 'unmute') {
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = true;
        }
      });
    }

    return Promise.resolve();
  }

  conferenceDeleteMember(call_id: string, options?: any): Promise<any> {
    console.log('[WebRTCPhone] conferenceDeleteMember', call_id, options);
    // This typically requires server-side support
    return Promise.resolve();
  }

  private setStatus(status: string): void {
    console.log('[WebRTCPhone] setStatus', status);
    this.events.publish('phone:webrtc-state', status);
  }

  private startRingTone(): void {
    try {
      const audio = document.getElementById('ringtone') as HTMLAudioElement;
      if (audio) audio.play();
    } catch (e) {
      console.warn('[WebRTCPhone] Could not play ringtone:', e);
    }
  }

  private stopRingTone(): void {
    try {
      const audio = document.getElementById('ringtone') as HTMLAudioElement;
      if (audio) audio.pause();
    } catch (e) {
      console.warn('[WebRTCPhone] Could not stop ringtone:', e);
    }
  }

  private getUserMediaSuccess(stream: MediaStream): void {
    console.log('[WebRTCPhone] getUserMediaSuccess', stream);
    this.ctxSip.stream = stream;
  }

  private getUserMediaFailure(err: any): void {
    console.error('[WebRTCPhone] getUserMediaFailure:', err);
    // Mic problems are surfaced on a dedicated error channel — NOT on
    // phone:webrtc-state, which must stay a plain status string (the UI renders
    // it directly and calls string methods on it). Publishing an object here is
    // what produced the "[object Object]" status badge.
    this.events.publish('phone:webrtc-error', {
      title: 'Your Device or Microphone is not connected',
      message: 'getUserMedia failed: ' + (err?.message || err)
    });
  }

  createUA(data: any): void {
    console.log('[WebRTCPhone] createUA', data);

    if (!data || !data.username || !data.password || !data.environment) {
      console.error('[WebRTCPhone] Invalid extension data');
      console.error('[WebRTCPhone] Received:', JSON.stringify(data, null, 2));
      this.setStatus('Invalid Configuration');
      return;
    }

    if (!data.environment.domain) {
      console.error('[WebRTCPhone] Missing domain in environment');
      this.setStatus('Missing Domain');
      return;
    }

    // Store domain for use during calls
    this.sipDomain = data.environment.domain;
    console.log('[WebRTCPhone] SIP Domain set to:', this.sipDomain);

    const uri = UserAgent.makeURI(`sip:${data.username}@${data.environment.domain}`);
    if (!uri) {
      console.error('[WebRTCPhone] Failed to create URI');
      this.setStatus('Invalid URI');
      return;
    }

    // Use CONFIG.WEBSOCKETS_SIP_URL for SIP WebSocket (specific port for SIP)
    // Environment wss_server may be for ActionCable, not SIP
    let wssServer: string;
    if (typeof CONFIG !== 'undefined' && CONFIG.WEBSOCKETS_SIP_URL) {
      // Primary: from global config (SIP-specific URL)
      wssServer = CONFIG.WEBSOCKETS_SIP_URL;
    } else if (data.environment?.wss_server) {
      // Fallback: from extension environment
      wssServer = data.environment.wss_server.startsWith('wss://')
        ? data.environment.wss_server
        : `wss://${data.environment.wss_server}`;
    } else {
      // Last resort: hardcoded default
      wssServer = 'wss://mtn-portal.voipappz.io:8443';
    }
    // OLD: environment.wss_server was primary, CONFIG was fallback
    // if (data.environment?.wss_server) {
    //   wssServer = data.environment.wss_server.startsWith('wss://')
    //     ? data.environment.wss_server
    //     : `wss://${data.environment.wss_server}`;
    // } else if (typeof CONFIG !== 'undefined' && CONFIG.WEBSOCKETS_SIP_URL) {
    //   wssServer = CONFIG.WEBSOCKETS_SIP_URL;
    // }

    const transportOptions = {
      server: wssServer
    };

    // Ensure username is a string (API may return number)
    const authUsername = String(data.username);
    const authPassword = String(data.password);

    console.log('[SIP.js] ========================================');
    console.log('[SIP.js] Extension data:', JSON.stringify({
      username: authUsername,
      domain: data.environment?.domain,
      wss_server: data.environment?.wss_server
    }));
    console.log('[SIP.js] WSS Server URL:', wssServer);
    console.log('[SIP.js] Creating UserAgent with URI:', uri.toString());
    console.log('[SIP.js] Auth username:', authUsername);
    console.log('[SIP.js] Auth password:', authPassword ? '****' + authPassword.slice(-2) : 'MISSING');
    console.log('[SIP.js] Domain:', data.environment?.domain);

    const userAgentOptions: UserAgentOptions = {
      uri: uri,
      transportOptions: transportOptions,
      authorizationPassword: authPassword,
      authorizationUsername: authUsername,
      logLevel: 'debug',  // Enable SIP.js debug logging
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionConfiguration: {
          iceServers: [
            { urls: ['stun:acvideo.voipappz.io'] },
            {
              urls: [
                'turn:eu-turn3.xirsys.com:80?transport=udp',
                'turn:eu-turn3.xirsys.com:3478?transport=udp',
                'turn:eu-turn3.xirsys.com:80?transport=tcp',
                'turn:eu-turn3.xirsys.com:3478?transport=tcp',
                'turns:eu-turn3.xirsys.com:443?transport=tcp',
                'turns:eu-turn3.xirsys.com:5349?transport=tcp'
              ],
              username: 'nEszb8f3eJ2DHSCsbgQ1-J2B6wPaX-0mErxV26_DV0zzV0MOqHXVxs1xCo3tZ43NAAAAAGFupSF2b2lwYXBwemluZm8=',
              credential: 'abb81eca-30cb-11ec-b54c-0242ac140004'
            }
          ],
          iceCheckingTimeout: 500
        }
      },
      delegate: {
        onInvite: (invitation: Invitation) => {
          this.handleIncomingCall(invitation);
        }
      }
    };

    try {
      this.setStatus('Connecting...');

      if (this.userAgent) {
        this.userAgent.stop().catch(() => {});
      }

      this.userAgent = new UserAgent(userAgentOptions);
      this.ctxSip.phone = this.userAgent;

      // Add transport state listeners using SIP.js 0.21.x API
      const transport = this.userAgent.transport;

      // Listen to transport state changes using the stateChange emitter
      transport.stateChange.addListener((state: TransportState) => {
        console.log('[SIP.js] Transport state changed:', TransportState[state]);
        switch (state) {
          case TransportState.Connected:
            console.log('[SIP.js] ✓ Transport CONNECTED to', wssServer);
            this.setStatus('Connected');
            // Safe to auto-reconnect on future unexpected disconnects
            this.manualDisconnect = false;
            // Reset reconnect counter on successful connection
            this.reconnectAttempts = 0;
            this.isReconnecting = false;
            if (this.reconnectTimer) {
              clearTimeout(this.reconnectTimer);
              this.reconnectTimer = null;
            }
            break;
          case TransportState.Disconnected:
            console.error('[SIP.js] ✗ Transport DISCONNECTED');
            this.setStatus('Disconnected');
            // Only auto-reconnect on unexpected disconnects, not deliberate unregister
            if (!this.manualDisconnect) {
              this.attemptReconnect();
            }
            break;
          case TransportState.Connecting:
            console.log('[SIP.js] Transport connecting...');
            this.setStatus('Connecting...');
            break;
          case TransportState.Disconnecting:
            console.log('[SIP.js] Transport disconnecting...');
            break;
        }
      });

      console.log('[SIP.js] Starting UserAgent...');
      this.userAgent.start().then(() => {
        console.log('[SIP.js] UserAgent started successfully');

        this.registerer = new Registerer(this.userAgent!, {
          expires: 300
        });

        this.registerer.stateChange.addListener((state: RegistererState) => {
          console.log('[SIP.js] Registerer state changed:', RegistererState[state]);
          switch (state) {
            case RegistererState.Registered:
              console.log('[SIP.js] ✓ Registered successfully');
              this.setStatus('Ready');
              // Healthy again — clear any pending registration retries.
              this.cancelRegistrationRetry();
              this.startRegistrationWatchdog();
              this.requestMicrophoneAccess();
              break;
            case RegistererState.Unregistered:
              console.log('[SIP.js] Unregistered');
              this.setStatus('Unregistered');
              // If we still want to be registered, this drop was unexpected —
              // recover by retrying REGISTER (don't leave the phone dead).
              if (this.wantRegistered && !this.manualDisconnect) {
                console.warn('[SIP.js] Unexpected unregister — scheduling re-register');
                this.scheduleRegistrationRetry();
              }
              break;
            case RegistererState.Terminated:
              console.log('[SIP.js] Terminated');
              this.setStatus('Terminated');
              break;
          }
        });

        // We intend to stay registered from here on.
        this.wantRegistered = true;
        this.doRegister();
      }).catch((err) => {
        console.error('[SIP.js] UserAgent start failed:', err);
        this.setStatus('Connection Failed');
        // Transport-level reconnect handles rebuilding; ensure we keep trying.
        if (this.wantRegistered && !this.manualDisconnect) {
          this.attemptReconnect();
        }
      });
    } catch (e) {
      console.error('[WebRTCPhone] createUA error:', e);
      this.setStatus('Error');
    }
  }

  private requestMicrophoneAccess(): void {
    if (!this.active_device) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then((stream) => this.getUserMediaSuccess(stream))
        .catch((err) => this.getUserMediaFailure(err));
    }
  }

  private attemptReconnect(): void {
    // Don't reconnect if already reconnecting or max attempts reached
    if (this.isReconnecting) {
      console.log('[SIP.js] Already attempting to reconnect...');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Don't permanently give up — pause the fast retry cycle and let the
      // watchdog resume recovery on its slower cadence. Reset the counter so the
      // next attempt starts a fresh fast cycle. Keep the watchdog running.
      console.warn('[SIP.js] Max fast reconnect attempts reached — backing off to watchdog cadence.');
      this.setStatus('Reconnecting...');
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      if (this.wantRegistered && !this.manualDisconnect) {
        this.startRegistrationWatchdog();
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts; // Exponential backoff

    console.log(`[SIP.js] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
    this.setStatus(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      if (this.phone_extension && this.phone_extension.username) {
        console.log('[SIP.js] Reconnecting now...');
        this.createUA(this.phone_extension);
      } else {
        console.warn('[SIP.js] No extension data for reconnection');
        this.isReconnecting = false;
      }
    }, delay);
  }

  cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
  }

  private handleIncomingCall(invitation: Invitation): void {
    console.log('[SIP.js] ☎️ Incoming call received');

    const callUuid = invitation.request.getHeader('x-va-call-uuid') || this.generateId();
    (invitation as any).ctxid = callUuid;
    (invitation as any).direction = 'incoming';
    (invitation as any).va_meta = invitation.request.getHeader('x-va-meta');

    const from = invitation.request.getHeader('from') || '';
    const match = from.match(/<sip:([^@>]+)/);
    (invitation as any).target = match ? match[1] : from;

    console.log('[SIP.js] Incoming call from:', (invitation as any).target);
    console.log('[SIP.js] Call UUID:', callUuid);
    console.log('[SIP.js] Auto-answer meta:', (invitation as any).va_meta);

    this.events.publish('phone:webrtc-event', { session_id: callUuid, type: 'invite' });

    if (this.reject_all) {
      invitation.reject();
      return;
    }

    if (this.ctxSip.callActiveID) {
      console.log('[WebRTCPhone] Rejecting - already in call');
      invitation.reject();
      return;
    }

    this.ctxSip.callActiveID = invitation;
    this.newSession(invitation, 'incoming');

    if ((invitation as any).va_meta === 'auto_answer') {
      this.answer(callUuid);
    } else {
      this.startRingTone();
    }

    const message = this.generateLogMessage(invitation as any, 'ringing');
    this.events.publish('sip:call-message', message);
  }

  private newSession(session: Session, direction: 'incoming' | 'outgoing'): void {
    console.log('[WebRTCPhone] newSession', direction);

    const sessionAny = session as any;
    const callUuid = sessionAny.ctxid || (direction === 'outgoing' ? sessionAny.target + 'outgoing' : this.generateId());
    sessionAny.ctxid = callUuid;

    if (direction === 'outgoing') {
      const message = this.generateLogMessage(sessionAny, 'connecting');
      this.events.publish('sip:call-message', message);
    }

    session.stateChange.addListener((state: SessionState) => {
      console.log('[WebRTCPhone] Session state changed:', state);

      switch (state) {
        case SessionState.Establishing:
          console.log('[WebRTCPhone] Session establishing');
          break;

        case SessionState.Established:
          console.log('[WebRTCPhone] Session established');
          this.stopRingTone();
          this.ctxSip.callActiveID = sessionAny.ctxid;
          this.events.publish('phone:webrtc-event', { session_id: sessionAny.ctxid, type: 'accepted' });

          // Setup remote audio
          this.setupRemoteAudio(session);

          const answerMessage = this.generateLogMessage(sessionAny, 'answer');
          this.events.publish('sip:call-message', answerMessage);
          break;

        case SessionState.Terminated:
          console.log('[WebRTCPhone] Session terminated');
          this.stopRingTone();
          this.ctxSip.callActiveID = null;

          if (direction === 'outgoing') {
            this.last_outgoing_call_target = { target: '', uuid: undefined };
          }

          this.events.publish('phone:webrtc-event', { session_id: sessionAny.ctxid, type: 'bye' });

          const hangupMessage = this.generateLogMessage(sessionAny, 'hangup');
          this.events.publish('sip:call-message', hangupMessage);

          delete this.sessions[sessionAny.ctxid];
          break;
      }
    });

    // Store session
    if (direction === 'outgoing' && this.last_outgoing_call_target.uuid) {
      sessionAny.ctxid = this.last_outgoing_call_target.uuid;
      this.sessions[this.last_outgoing_call_target.uuid] = session;
    } else {
      this.sessions[sessionAny.ctxid] = session;
    }
  }

  private setupRemoteAudio(session: Session): void {
    const sdh = session.sessionDescriptionHandler as any;
    if (!sdh || !sdh.peerConnection) {
      return;
    }

    const pc: RTCPeerConnection = sdh.peerConnection;
    const remoteStream = new MediaStream();

    pc.getReceivers().forEach((receiver) => {
      if (receiver.track) {
        remoteStream.addTrack(receiver.track);
      }
    });

    const audioElement = document.getElementById('audioRemote') as HTMLAudioElement;
    if (audioElement) {
      audioElement.srcObject = remoteStream;
      audioElement.play().catch((err) => {
        console.warn('[WebRTCPhone] Audio play failed:', err);
      });
    }
  }

  private generateLogMessage(session: any, type: string): any {
    return {
      call: {
        direction: session.direction,
        type: 'extension_to_number',
        uuid: session.ctxid,
        answered_at: Math.floor(Date.now() / 1000)
      },
      consumer: {
        type: 'contact',
        caller_id_number: session.target
      },
      conference: {},
      screen: {},
      campaign: {},
      did: null,
      type: type,
      auto_answer: session.va_meta === 'auto_answer'
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
