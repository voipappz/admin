import { TestBed } from '@angular/core/testing';
import { WebRTCChannelPhone } from './webrtc-channel-phone';
import { Events } from '../events';
import { UserData } from '../user-data';
import { AuthService } from '../simple-auth.service';

/**
 * The connectix WebRTC transport, exercised where a headless runner can reach
 * it: the pre-flight gates (no token / no identity / not joined) and the
 * failure surfaces that must never be silent — a refused `dial`, a mic denial.
 * The socket handshake itself needs a real browser + a live box, so it is not
 * asserted here.
 */
describe('WebRTCChannelPhone', () => {
  let service: WebRTCChannelPhone;
  let eventsSpy: jasmine.SpyObj<Events>;
  let userDataSpy: jasmine.SpyObj<UserData>;
  let authSpy: jasmine.SpyObj<AuthService>;

  /** A logged-in connectix user: extension 9001, as the box shapes it. */
  const user9001 = {
    uuid: 'e4a1-9001',
    username: '9001',
    extension: { number: '9001' },
    environment: {}
  };

  const published = (topic: string) =>
    eventsSpy.publish.calls.allArgs().filter((a) => a[0] === topic).map((a) => a[1]);

  beforeEach(() => {
    eventsSpy = jasmine.createSpyObj('Events', ['subscribe', 'publish']);
    userDataSpy = jasmine.createSpyObj('UserData', ['getUserData']);
    authSpy = jasmine.createSpyObj('AuthService', ['getToken']);

    userDataSpy.getUserData.and.returnValue(user9001);
    authSpy.getToken.and.returnValue('a-session-token');

    TestBed.configureTestingModule({
      providers: [
        WebRTCChannelPhone,
        { provide: Events, useValue: eventsSpy },
        { provide: UserData, useValue: userDataSpy },
        { provide: AuthService, useValue: authSpy }
      ]
    });

    service = TestBed.inject(WebRTCChannelPhone);
  });

  afterEach(() => {
    // Never leave a socket open across specs.
    (service as any).teardownSocket();
  });

  describe('start()', () => {
    it('refuses to start without a session token and says so', () => {
      authSpy.getToken.and.returnValue(null);

      expect(service.start()).toBe(false);
      expect(eventsSpy.publish).toHaveBeenCalledWith('phone:webrtc-state', 'No Session');
      expect(published('phone:mode-unavailable')).toContain(
        jasmine.objectContaining({ reason: 'no_token' }) as any
      );
    });

    it('refuses to start when the user has no extension identity', () => {
      userDataSpy.getUserData.and.returnValue({ profile: {} });

      expect(service.start()).toBe(false);
      expect(eventsSpy.publish).toHaveBeenCalledWith('phone:webrtc-state', 'No Extension');
    });

    it('does NOT require a SIP domain or wss_server (connectix supplies neither)', () => {
      // environment is {} — the sip.js phone would refuse; this one must not.
      // The socket open itself needs a live box, so it is stubbed here.
      const open = spyOn<any>(service, 'openSocket');

      expect(service.start()).toBe(true);
      expect(open).toHaveBeenCalledWith('a-session-token', ['9001', 'e4a1-9001']);
    });
  });

  describe('identity candidates', () => {
    it('prefers the extension number, then username/uuid, without duplicates', () => {
      expect((service as any).identityCandidates()).toEqual(['9001', 'e4a1-9001']);
    });
  });

  describe('call()', () => {
    it('rejects and reports an error when the channel is not joined', async () => {
      await expectAsync(service.call('972545234585')).toBeRejected();
      expect(published('phone:call-error')).toContain(
        jasmine.objectContaining({ type: 'not_connected' }) as any
      );
    });

    it('rejects transfer/conference options instead of pretending to place a call', async () => {
      (service as any).joined = true;
      (service as any).channel = { push: () => ({ receive: () => ({ receive: () => ({ receive: () => null }) }) }) };

      await expectAsync(service.call('9002', '', { leg_b_type: 'conference' })).toBeRejected();
      expect(published('phone:call-error')).toContain(
        jasmine.objectContaining({ type: 'unsupported' }) as any
      );
    });
  });

  describe('dial errors', () => {
    /** A phoenix Push whose `receive('error', cb)` fires with the given reply. */
    const pushWithError = (reply: any) => {
      const push: any = {
        receive: (status: string, cb: any) => {
          if (status === 'error') { cb(reply); }
          return push;
        }
      };
      return push;
    };

    it('surfaces a not_found dial reply to the user, never swallows it', () => {
      const channel: any = { push: jasmine.createSpy('push').and.returnValue(pushWithError({ reason: 'not_found' })) };
      (service as any).joined = true;
      (service as any).channel = channel;
      (service as any).activeCall = {
        uuid: '972545234585outgoing', target: '972545234585',
        dialed: false, connected: false, timer: null
      };

      (service as any).onConnected();

      expect(channel.push).toHaveBeenCalledWith('dial', { to: '972545234585' });
      const errors = published('phone:webrtc-error');
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('972545234585');
      expect(published('phone:call-error')).toContain(
        jasmine.objectContaining({ type: 'not_found' }) as any
      );
    });
  });

  describe('mute()', () => {
    it('toggles the microphone track both ways', async () => {
      const track: any = { kind: 'audio', enabled: true, stop: () => undefined };
      (service as any).localStream = { getAudioTracks: () => [track], getTracks: () => [track] };

      await service.mute('anycall', { action: 'mute' });
      expect(track.enabled).toBe(false);

      await service.mute('anycall', { action: 'unmute' });
      expect(track.enabled).toBe(true);

      // Boolean form, as the task's transport contract describes it.
      await service.mute(true);
      expect(track.enabled).toBe(false);
    });

    it('rejects when there is no microphone stream', async () => {
      await expectAsync(service.mute('anycall', { action: 'mute' })).toBeRejected();
    });
  });

  describe('hangup()', () => {
    it('pushes hangup to the channel and reports the call as ended', async () => {
      const channel: any = { push: jasmine.createSpy('push') };
      (service as any).joined = true;
      (service as any).channel = channel;
      (service as any).activeCall = {
        uuid: '9002outgoing', target: '9002', dialed: true, connected: true, timer: null
      };

      await service.hangup('9002outgoing');

      expect(channel.push).toHaveBeenCalledWith('hangup', {});
      expect(published('phone:webrtc-event')).toContain(
        jasmine.objectContaining({ session_id: '9002outgoing', type: 'hangup' }) as any
      );
      expect(published('sip:call-message')).toContain(
        jasmine.objectContaining({ type: 'hangup' }) as any
      );
    });
  });

  describe('peer lifecycle across calls', () => {
    /**
     * The server stops its peer on "hangup" and only ever starts one in
     * `join/3` — so a second offer on the same joined channel would hit a nil
     * peer and kill the channel. The client must re-join to get a fresh peer.
     */
    it('leaves and re-joins the channel after a hangup so the next call gets a fresh peer', async () => {
      const joinPush: any = { receive: (_s: string, _cb: any) => joinPush };
      const freshChannel: any = {
        on: () => undefined, onError: () => undefined, onClose: () => undefined,
        join: () => joinPush, leave: jasmine.createSpy('freshLeave'), push: () => joinPush
      };
      const oldChannel: any = { push: jasmine.createSpy('push'), leave: jasmine.createSpy('leave') };
      const socket: any = { channel: jasmine.createSpy('channel').and.returnValue(freshChannel) };

      (service as any).socket = socket;
      (service as any).channel = oldChannel;
      (service as any).joined = true;
      (service as any).extension = '9001';
      (service as any).activeCall = {
        uuid: '9002outgoing', target: '9002', dialed: true, connected: true, timer: null
      };

      await service.hangup('9002outgoing');

      expect(oldChannel.push).toHaveBeenCalledWith('hangup', {});
      expect(oldChannel.leave).toHaveBeenCalled();
      expect(socket.channel).toHaveBeenCalledWith('phone:9001', {});
    });

    it('does not re-join when there was no call to tear down', async () => {
      const socket: any = { channel: jasmine.createSpy('channel') };
      (service as any).socket = socket;
      (service as any).channel = { push: jasmine.createSpy('push'), leave: jasmine.createSpy('leave') };
      (service as any).joined = true;
      (service as any).extension = '9001';

      await service.hangup('stale-card-uuid');

      expect(socket.channel).not.toHaveBeenCalled();
    });
  });

  describe('mute and hold gate the right directions', () => {
    /** A track pair standing in for a live call: our mic and the far end. */
    let mic: any;
    let far: any;

    const track = () => ({ kind: 'audio', enabled: true, stop: () => {} });

    beforeEach(() => {
      mic = track();
      far = track();
      (service as any).localStream = { getAudioTracks: () => [mic], getTracks: () => [mic] };
      (service as any).remoteStream = { getAudioTracks: () => [far] };
      (service as any).activeCall = { uuid: 'call-1', target: '972545234585' };
    });

    it('mute stops the mic but must never deafen the user', async () => {
      await service.mute('call-1', { action: 'mute' });

      expect(mic.enabled).toBe(false);
      expect(far.enabled).toBe(true, 'muting the mic must not silence the far end');
    });

    it('hold silences BOTH directions, not just the mic', async () => {
      await service.hold('call-1', { action: 'hold' });

      expect(mic.enabled).toBe(false);
      expect(far.enabled).toBe(false, 'a held call must not keep playing the far end');
    });

    it('unhold restores a call that was not muted', async () => {
      await service.hold('call-1', { action: 'hold' });
      await service.hold('call-1', { action: 'unhold' });

      expect(mic.enabled).toBe(true);
      expect(far.enabled).toBe(true);
    });

    it('unhold does not silently unmute a call muted before the hold', async () => {
      await service.mute('call-1', { action: 'mute' });
      await service.hold('call-1', { action: 'hold' });
      await service.hold('call-1', { action: 'unhold' });

      expect(mic.enabled).toBe(false, 'the mute outlives the hold');
      expect(far.enabled).toBe(true);
    });

    it('a rapid hold/unhold flip settles on the last one', async () => {
      await Promise.all([
        service.hold('call-1', { action: 'hold' }),
        service.hold('call-1', { action: 'unhold' })
      ]);

      expect(far.enabled).toBe(true);
    });

    it('a track arriving mid-hold does not start making noise', () => {
      (service as any).held = true;
      const late = track();
      (service as any).remoteStream = { getAudioTracks: () => [late] };

      (service as any).applyAudioGates();

      expect(late.enabled).toBe(false);
    });

    it('publishes hold/unhold so the UI reflects the truth', async () => {
      await service.hold('call-1', { action: 'hold' });
      await service.hold('call-1', { action: 'unhold' });

      const types = published('phone:webrtc-event').map((e: any) => e.type);
      expect(types).toContain('hold');
      expect(types).toContain('unhold');
    });

    it('hold with no call rejects instead of pretending', async () => {
      (service as any).localStream = null;
      (service as any).remoteStream = null;

      await expectAsync(service.hold('call-1', { action: 'hold' })).toBeRejected();
    });
  });

  describe('unsupported operations fail loudly', () => {
    it('rejects answer/forward/merge/conferenceDeleteMember', async () => {
      await expectAsync(service.answer('x')).toBeRejected();
      await expectAsync(service.forward('9002')).toBeRejected();
      await expectAsync(service.merge('x')).toBeRejected();
      await expectAsync(service.conferenceDeleteMember('x')).toBeRejected();
    });
  });
});
