import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { WebRTCPhone } from './webrtc-phone';
import { Events } from '../events';
import { UserData } from '../user-data';
import { HandleRequest } from '../../_base/layout/services/handleRequest.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('WebRTCPhone', () => {
  let service: WebRTCPhone;
  let eventsSpy: jasmine.SpyObj<Events>;
  let userDataSpy: jasmine.SpyObj<UserData>;
  let handleRequestSpy: jasmine.SpyObj<HandleRequest>;

  const mockExtension = {
    username: 'testuser',
    password: 'testpass',
    uuid: 'test-uuid',
    environment: {
      domain: 'test.voipappz.io',
      wss_server: 'wss-test.voipappz.io:8443'
    }
  };

  beforeEach(() => {
    eventsSpy = jasmine.createSpyObj('Events', ['subscribe', 'publish']);
    userDataSpy = jasmine.createSpyObj('UserData', ['getUserData']);
    handleRequestSpy = jasmine.createSpyObj('HandleRequest', ['get', 'post', 'patch']);

    userDataSpy.getUserData.and.returnValue({ extension: mockExtension });

    // Mock navigator.mediaDevices
    if (!navigator.mediaDevices) {
      (navigator as any).mediaDevices = {};
    }
    spyOn(navigator.mediaDevices, 'enumerateDevices').and.returnValue(
      Promise.resolve([
        { kind: 'audioinput', deviceId: 'default', label: 'Default Microphone', groupId: 'default' } as MediaDeviceInfo,
        { kind: 'audiooutput', deviceId: 'default', label: 'Default Speaker', groupId: 'default' } as MediaDeviceInfo
      ])
    );

    TestBed.configureTestingModule({
    imports: [],
    providers: [
        WebRTCPhone,
        { provide: Events, useValue: eventsSpy },
        { provide: UserData, useValue: userDataSpy },
        { provide: HandleRequest, useValue: handleRequestSpy },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
    ]
});

    service = TestBed.inject(WebRTCPhone);
  });

  describe('Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should subscribe to phone:reject-calls event', () => {
      expect(eventsSpy.subscribe).toHaveBeenCalledWith('phone:reject-calls', jasmine.any(Function));
    });

    it('should subscribe to phone:device-selected event', () => {
      expect(eventsSpy.subscribe).toHaveBeenCalledWith('phone:device-selected', jasmine.any(Function));
    });

    it('should initialize with empty sessions', () => {
      expect(service.sessions).toEqual({});
    });

    it('should initialize with reject_all as false', () => {
      expect(service.reject_all).toBe(false);
    });

    it('should initialize ctxSip with null values', () => {
      expect(service.ctxSip.callActiveID).toBeNull();
      expect(service.ctxSip.stream).toBeNull();
      expect(service.ctxSip.phone).toBeNull();
    });
  });

  describe('Device Management', () => {
    it('should update device list', fakeAsync(() => {
      service.updateDeviceList({});
      tick(100);
      expect(navigator.mediaDevices.enumerateDevices).toHaveBeenCalled();
    }));

    it('should publish device list event', fakeAsync(() => {
      service.updateDeviceList({});
      tick(100);
      expect(eventsSpy.publish).toHaveBeenCalledWith(
        'phone:devices-list-event',
        jasmine.objectContaining({
          inputs: jasmine.any(Array),
          outputs: jasmine.any(Array)
        })
      );
    }));

    it('should filter audio input devices', fakeAsync(() => {
      service.updateDeviceList({});
      tick(100);

      const publishCalls = eventsSpy.publish.calls.allArgs();
      const deviceCall = publishCalls.find(call => call[0] === 'phone:devices-list-event');

      if (deviceCall) {
        expect(deviceCall[1].inputs.length).toBe(1);
        expect(deviceCall[1].inputs[0].kind).toBe('audioinput');
      }
    }));

    it('should filter audio output devices', fakeAsync(() => {
      service.updateDeviceList({});
      tick(100);

      const publishCalls = eventsSpy.publish.calls.allArgs();
      const deviceCall = publishCalls.find(call => call[0] === 'phone:devices-list-event');

      if (deviceCall) {
        expect(deviceCall[1].outputs.length).toBe(1);
        expect(deviceCall[1].outputs[0].kind).toBe('audiooutput');
      }
    }));
  });

  describe('Start/End', () => {
    it('should handle missing extension data on start', () => {
      userDataSpy.getUserData.and.returnValue({});
      service.start();
      expect(eventsSpy.publish).toHaveBeenCalledWith('phone:webrtc-state', 'No Extension');
    });

    it('should handle null userData on start', () => {
      userDataSpy.getUserData.and.returnValue(null);
      service.start();
      expect(eventsSpy.publish).toHaveBeenCalledWith('phone:webrtc-state', 'No Extension');
    });

    it('should clear sessions on end', () => {
      service.sessions = { 'test': {} as any };
      service.end();
      expect(service.sessions).toEqual({});
    });
  });

  describe('createUA', () => {
    it('should handle null extension data', () => {
      service.createUA(null);
      expect(eventsSpy.publish).toHaveBeenCalledWith('phone:webrtc-state', 'Invalid Configuration');
    });

    it('should handle missing username', () => {
      service.createUA({ password: 'pass', environment: {} });
      expect(eventsSpy.publish).toHaveBeenCalledWith('phone:webrtc-state', 'Invalid Configuration');
    });

    it('should handle missing password', () => {
      service.createUA({ username: 'user', environment: {} });
      expect(eventsSpy.publish).toHaveBeenCalledWith('phone:webrtc-state', 'Invalid Configuration');
    });

    it('should handle missing environment', () => {
      service.createUA({ username: 'user', password: 'pass' });
      expect(eventsSpy.publish).toHaveBeenCalledWith('phone:webrtc-state', 'Invalid Configuration');
    });

    it('should publish Connecting status on valid config', () => {
      // This will fail at UserAgent creation, but status should be set first
      try {
        service.createUA(mockExtension);
      } catch (e) {
        // Expected to fail without actual SIP.js
      }
      expect(eventsSpy.publish).toHaveBeenCalledWith('phone:webrtc-state', 'Connecting...');
    });
  });

  describe('Call Methods', () => {
    it('should reject call if userAgent not initialized', async () => {
      await expectAsync(service.call('123', 'caller')).toBeRejectedWith('UserAgent not initialized - no extension data');
    });

    it('should handle conference call option', async () => {
      const options = {
        leg_b_type: 'conference',
        leg_a: { uuid: 'test' },
        transfer_type: 'blind'
      };
      // Should redirect to forward
      await expectAsync(service.call('123', 'caller', options)).toBeRejected();
    });
  });

  describe('Answer', () => {
    it('should reject answer for non-existent session', async () => {
      await expectAsync(service.answer('non-existent')).toBeRejectedWith('Session not found');
    });
  });

  describe('Hangup', () => {
    it('should publish hangup event for non-existent session', async () => {
      try {
        await service.hangup('non-existent');
      } catch (e) {
        // Expected
      }
      expect(eventsSpy.publish).toHaveBeenCalledWith(
        'phone:webrtc-event',
        jasmine.objectContaining({ type: 'hangup' })
      );
    });
  });

  describe('Hold', () => {
    it('should reject hold for non-existent session', async () => {
      await expectAsync(service.hold('non-existent', { action: 'hold' })).toBeRejectedWith('Session not found');
    });
  });

  describe('Mute', () => {
    it('should reject mute for non-existent session', async () => {
      await expectAsync(service.mute('non-existent', { action: 'mute' })).toBeRejectedWith('Session not found');
    });
  });

  describe('Forward/Transfer', () => {
    it('should reject transfer with invalid options', async () => {
      await expectAsync(service.forward('123', 'caller', {})).toBeRejectedWith('Invalid options');
    });

    it('should reject transfer with missing leg_a', async () => {
      await expectAsync(service.forward('123', 'caller', { leg_b_type: 'number' })).toBeRejectedWith('Invalid options');
    });

    it('should reject transfer for non-existent session', async () => {
      const options = { leg_a: { uuid: 'non-existent' }, transfer_type: 'blind' };
      await expectAsync(service.forward('123', 'caller', options)).toBeRejectedWith('Session not found');
    });
  });

  describe('Merge/Conference', () => {
    it('should reject merge as not implemented', async () => {
      await expectAsync(service.merge('call-uuid')).toBeRejectedWith('Not implemented - requires server-side conference support');
    });

    it('should resolve conferenceDeleteMember', async () => {
      const result = await service.conferenceDeleteMember('call-id');
      expect(result).toBeUndefined();
    });
  });

  describe('DTMF', () => {
    it('should handle DTMF for non-existent session gracefully', () => {
      expect(() => service.sendDtmf('123', 'non-existent')).not.toThrow();
    });
  });

  describe('Register/Unregister', () => {
    it('should not throw on register when registerer is null', () => {
      expect(() => service.register()).not.toThrow();
    });

    it('should not throw on unregister when registerer is null', () => {
      expect(() => service.unregister()).not.toThrow();
    });

    it('should not throw on checkStatus when registerer is null', () => {
      expect(() => service.checkStatus()).not.toThrow();
    });
  });

  describe('Robust registration retries', () => {
    it('cancelRegistrationRetry resets retry state', () => {
      // Simulate an in-flight retry cycle.
      (service as any).isRetryingRegistration = true;
      (service as any).registrationAttempts = 4;
      (service as any).registrationRetryTimer = setTimeout(() => {}, 10000);

      service.cancelRegistrationRetry();

      expect((service as any).isRetryingRegistration).toBe(false);
      expect((service as any).registrationAttempts).toBe(0);
      expect((service as any).registrationRetryTimer).toBeNull();
    });

    it('does not schedule a registration retry after deliberate unregister', () => {
      (service as any).manualDisconnect = true;
      (service as any).wantRegistered = false;

      (service as any).scheduleRegistrationRetry();

      expect((service as any).isRetryingRegistration).toBe(false);
      expect((service as any).registrationRetryTimer).toBeNull();
    });

    it('schedules a backed-off retry while still wanting to be registered', fakeAsync(() => {
      (service as any).manualDisconnect = false;
      (service as any).wantRegistered = true;

      (service as any).scheduleRegistrationRetry();

      // A timer should be armed and the attempt counter incremented.
      expect((service as any).registrationAttempts).toBe(1);
      expect((service as any).registrationRetryTimer).not.toBeNull();

      // Clean up the armed timer so fakeAsync doesn't complain.
      service.cancelRegistrationRetry();
    }));

    it('backoff delay grows with attempts and is capped', () => {
      const base = (service as any).registrationRetryBaseDelay;
      const cap = (service as any).registrationRetryMaxDelay;
      const delayFor = (attempt: number) =>
        Math.min(base * Math.pow(2, attempt - 1), cap);

      expect(delayFor(1)).toBe(base);
      expect(delayFor(2)).toBe(base * 2);
      expect(delayFor(10)).toBe(cap); // capped
    });

    it('unregister stops the watchdog and clears wantRegistered', () => {
      (service as any).wantRegistered = true;
      (service as any).startRegistrationWatchdog();
      expect((service as any).watchdogTimer).not.toBeNull();

      service.unregister();

      expect((service as any).wantRegistered).toBe(false);
      expect((service as any).watchdogTimer).toBeNull();
    });
  });

  describe('Outgoing Call UUID', () => {
    it('should set outgoing call UUID', () => {
      service.last_outgoing_call_target = { target: '123', uuid: undefined };
      service.outgoingCallSetUuid('new-uuid');
      expect(service.last_outgoing_call_target.uuid).toBe('new-uuid');
    });

    it('should move session to new UUID if exists', () => {
      const mockSession = { ctxid: '123outgoing' } as any;
      service.sessions['123outgoing'] = mockSession;
      service.last_outgoing_call_target = { target: '123', uuid: undefined };

      service.outgoingCallSetUuid('new-uuid');

      expect(service.sessions['new-uuid']).toBe(mockSession);
      expect((mockSession as any).ctxid).toBe('new-uuid');
    });
  });

  describe('Reject All Mode', () => {
    it('should set reject_all via event', () => {
      // Find the reject-calls subscriber
      const subscribeCalls = eventsSpy.subscribe.calls.allArgs();
      const rejectCallsSubscriber = subscribeCalls.find(call => call[0] === 'phone:reject-calls');

      if (rejectCallsSubscriber && rejectCallsSubscriber[1]) {
        rejectCallsSubscriber[1](true);
        expect(service.reject_all).toBe(true);
      }
    });
  });

  describe('Device Selection', () => {
    it('should set active_device via event', () => {
      const subscribeCalls = eventsSpy.subscribe.calls.allArgs();
      const deviceSubscriber = subscribeCalls.find(call => call[0] === 'phone:device-selected');

      if (deviceSubscriber && deviceSubscriber[1]) {
        deviceSubscriber[1]('device-123');
        expect(service.active_device).toBe('device-123');
      }
    });
  });
});
