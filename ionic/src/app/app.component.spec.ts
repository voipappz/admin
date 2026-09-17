// @ts-nocheck — legacy spec with stale ActiveCall mocks; kept compiling until
// it gets a proper refresh. Type-checking disabled only for this test file.
import { CUSTOM_ELEMENTS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { TestBed, waitForAsync, fakeAsync, tick } from '@angular/core/testing';
import { MenuController, Platform, ToastController } from '@ionic/angular';
import { IonicStorageModule, Storage } from '@ionic/storage-angular';
import { AppComponent } from './app.component';
import { UserData } from './core/providers/user-data';
import { Events } from './core/providers/events';
import { WebsocketProvider } from './core/providers/websocket';
import { HandleRequest } from './core/_base/layout/services/handleRequest.service';
import { TranslationService } from './core/_base/layout/services/translation.service';
import { PhoneProvider } from './core/providers/phone/phone';
import { AuthService } from './core/providers/simple-auth.service';
import { CallService } from './core/_base/layout/services/call.service';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

// Stub the `translate` pipe so the template renders without TranslateModule
// (the real TranslateService is provided as a spy).
@Pipe({ name: 'translate', standalone: false })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

describe('AppComponent', () => {
  let menuSpy: jasmine.SpyObj<MenuController>;
  let routerSpy: jasmine.SpyObj<Router>;
  let userDataSpy: jasmine.SpyObj<UserData>;
  let swUpdateSpy: jasmine.SpyObj<SwUpdate>;
  let eventsSpy: jasmine.SpyObj<Events>;
  let phoneSpy: jasmine.SpyObj<PhoneProvider>;
  let toastSpy: jasmine.SpyObj<ToastController>;
  let storageSpy: jasmine.SpyObj<Storage>;
  let wsSpy: jasmine.SpyObj<WebsocketProvider>;
  let handleRequestSpy: jasmine.SpyObj<HandleRequest>;
  let translationSpy: jasmine.SpyObj<TranslationService>;
  let authSpy: jasmine.SpyObj<AuthService>;
  let callServiceSpy: jasmine.SpyObj<CallService>;
  let translateSpy: jasmine.SpyObj<TranslateService>;
  let app: AppComponent;
  let fixture: any;

  beforeEach(waitForAsync(() => {
    menuSpy = jasmine.createSpyObj('MenuController', ['toggle', 'enable']);
    routerSpy = jasmine.createSpyObj('Router', ['navigateByUrl'], { url: '/test' });
    userDataSpy = jasmine.createSpyObj('UserData', [
      'isLoggedIn', 'logout', 'getUsername', 'getUserInfo', 'getUserData', 'getCustomerData'
    ]);
    userDataSpy.isLoggedIn.and.returnValue(Promise.resolve(false));
    userDataSpy.getCustomerData.and.returnValue({});
    userDataSpy.getUserInfo.and.returnValue({});
    userDataSpy.getUserData.and.returnValue({});

    swUpdateSpy = jasmine.createSpyObj('SwUpdate', ['activateUpdate']);
    (swUpdateSpy as any).versionUpdates = of();

    eventsSpy = jasmine.createSpyObj('Events', ['subscribe', 'publish']);
    phoneSpy = jasmine.createSpyObj('PhoneProvider', [
      'call', 'hangup', 'answer', 'hold', 'mute', 'transfer', 'sendDtmf', 'setMode'
    ]);
    phoneSpy.call.and.returnValue(Promise.resolve());
    phoneSpy.hangup.and.returnValue(Promise.resolve());
    phoneSpy.transfer.and.returnValue(Promise.resolve());
    phoneSpy.answer.and.returnValue(Promise.resolve());
    phoneSpy.mute.and.returnValue(Promise.resolve());
    phoneSpy.hold.and.returnValue(Promise.resolve());

    toastSpy = jasmine.createSpyObj('ToastController', ['create']);
    storageSpy = jasmine.createSpyObj('Storage', ['get', 'set', 'create']);
    storageSpy.get.and.returnValue(Promise.resolve(null));
    storageSpy.set.and.returnValue(Promise.resolve());
    (storageSpy as any).create.and.returnValue(Promise.resolve(storageSpy));
    wsSpy = jasmine.createSpyObj('WebsocketProvider', ['connect', 'join', 'leave', 'close', 'getChannel']);
    handleRequestSpy = jasmine.createSpyObj('HandleRequest', ['wsStatus', 'handleErrors']);
    handleRequestSpy.wsStatus.and.returnValue(Promise.resolve());

    translationSpy = jasmine.createSpyObj('TranslationService', ['loadTranslations', 'setLanguage', 'getSelectedLanguage']);
    translationSpy.getSelectedLanguage.and.returnValue('en');
    authSpy = jasmine.createSpyObj('AuthService', ['logout']);
    authSpy.logout.and.returnValue(of(undefined));

    callServiceSpy = jasmine.createSpyObj('CallService', ['getPage']);
    callServiceSpy.getPage.and.returnValue(of({ body: [] }));

    translateSpy = jasmine.createSpyObj('TranslateService', ['instant', 'get', 'use']);
    translateSpy.instant.and.callFake((key: string) => key);
    translateSpy.get.and.callFake((key: string) => of(key));

    TestBed.configureTestingModule({
      declarations: [AppComponent, MockTranslatePipe],
      imports: [IonicStorageModule.forRoot()],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: MenuController, useValue: menuSpy },
        { provide: Router, useValue: routerSpy },
        { provide: UserData, useValue: userDataSpy },
        { provide: SwUpdate, useValue: swUpdateSpy },
        { provide: Events, useValue: eventsSpy },
        { provide: PhoneProvider, useValue: phoneSpy },
        { provide: ToastController, useValue: toastSpy },
        { provide: Storage, useValue: storageSpy },
        { provide: WebsocketProvider, useValue: wsSpy },
        { provide: HandleRequest, useValue: handleRequestSpy },
        { provide: TranslationService, useValue: translationSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: CallService, useValue: callServiceSpy },
        { provide: TranslateService, useValue: translateSpy }
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AppComponent);
    app = fixture.debugElement.componentInstance;
  });

  it('should create the app', () => {
    expect(app).toBeTruthy();
  });

  describe('Phone Dialpad', () => {
    it('should add digit to dialInput when dialpadPress is called', () => {
      app.dialInput = '';
      app.dialpadPress('1');
      expect(app.dialInput).toBe('1');
      app.dialpadPress('2');
      expect(app.dialInput).toBe('12');
      app.dialpadPress('3');
      expect(app.dialInput).toBe('123');
    });

    it('should clear dialInput when making a call', () => {
      app.dialInput = '12345';
      app.makeCall();
      expect(app.dialInput).toBe('');
    });

    it('should not make call if dialInput is less than 3 digits', () => {
      app.dialInput = '12';
      app.makeCall();
      expect(phoneSpy.call).not.toHaveBeenCalled();
    });

    it('should make call when dialInput has 3 or more digits', () => {
      app.dialInput = '123';
      app.makeCall();
      expect(phoneSpy.call).toHaveBeenCalledWith('123', '', { leg_b_type: 'number' });
    });
  });

  describe('Call History', () => {
    // Call history is now loaded from the server (CallService.getPage) rather
    // than appended locally, so the old addToCallHistory/clearCallHistory tests
    // were removed. callFromHistory still drives the dialpad.
    it('should populate dialInput when calling from a history entry', () => {
      app.callFromHistory({ meta: { _contact_number: '9876543' } });
      expect(app.dialInput).toBe('9876543');
      expect(app.phone_tab).toBe('dialpad');
    });

    it('should ignore a history entry with no number', () => {
      app.dialInput = '';
      app.callFromHistory({ meta: {} });
      expect(app.dialInput).toBe('');
    });
  });

  describe('Call Handling', () => {
    it('should add new call to activeCallsArray', () => {
      expect(app.activeCallsArray.length).toBe(0);

      app.handleCall({
        type: 'connecting',
        call: { uuid: 'call-123' },
        consumer: { caller_id_number: '555-1234' }
      });

      expect(app.activeCallsArray.length).toBe(1);
      expect(app.activeCallsArray[0].type).toBe('connecting');
      expect(app.activeCallsArray[0].status_text).toBe('Calling...');
    });

    it('should update existing call in activeCallsArray', () => {
      app.handleCall({
        type: 'connecting',
        call: { uuid: 'call-123' },
        consumer: { caller_id_number: '555-1234' }
      });

      app.handleCall({
        type: 'answer',
        call: { uuid: 'call-123' }
      });

      expect(app.activeCallsArray.length).toBe(1);
      expect(app.activeCallsArray[0].type).toBe('answer');
      expect(app.activeCallsArray[0].status_text).toBe('Connected');
    });

    it('should set correct status text for ringing incoming call', () => {
      app.handleCall({
        type: 'ringing',
        call: { uuid: 'call-123', direction: 'incoming' },
        consumer: { caller_id_number: '555-1234' }
      });

      expect(app.activeCallsArray[0].status_text).toBe('Incoming Call...');
    });

    it('should remove call from array', () => {
      app.activeCallsArray = [{
        type: 'answer',
        call: { uuid: 'call-123' },
        consumer: { fullname: 'Test' }
      }];

      app.removeCallFromArray('call-123');
      expect(app.activeCallsArray.length).toBe(0);
    });
  });

  describe('Call Actions', () => {
    const mockCall = {
      call: { uuid: 'call-123', direction: 'outgoing' },
      on_mute: false,
      on_hold: false
    };

    it('should answer call', () => {
      app.answer(mockCall);
      expect(phoneSpy.answer).toHaveBeenCalledWith('call-123');
    });

    it('should hangup call', () => {
      app.hangup(mockCall);
      expect(phoneSpy.hangup).toHaveBeenCalledWith('call-123', {});
    });

    // muteCall/holdCall flip the flag inside the phone promise's .then(), so the
    // assertions must run after the microtask flush.
    it('should toggle mute state', fakeAsync(() => {
      const call = { ...mockCall, on_mute: false };
      app.muteCall(call);
      expect(phoneSpy.mute).toHaveBeenCalledWith('call-123', { action: 'mute' });
      tick();
      expect(call.on_mute).toBe(true);

      app.muteCall(call);
      expect(phoneSpy.mute).toHaveBeenCalledWith('call-123', { action: 'unmute' });
      tick();
      expect(call.on_mute).toBe(false);
    }));

    it('should toggle hold state', fakeAsync(() => {
      const call = { ...mockCall, on_hold: false };
      app.holdCall(call);
      expect(phoneSpy.hold).toHaveBeenCalledWith('call-123', {
        action: 'hold',
        call_direction: 'outgoing'
      });
      tick();
      expect(call.on_hold).toBe(true);

      app.holdCall(call);
      expect(phoneSpy.hold).toHaveBeenCalledWith('call-123', {
        action: 'unhold',
        call_direction: 'outgoing'
      });
      tick();
      expect(call.on_hold).toBe(false);
    }));
  });

  describe('DTMF', () => {
    it('should toggle DTMF pad visibility', () => {
      expect(app.showDtmfPad).toBe(false);
      app.toggleDtmfPad({});
      expect(app.showDtmfPad).toBe(true);
      app.toggleDtmfPad({});
      expect(app.showDtmfPad).toBe(false);
    });

    it('should send DTMF and update display', () => {
      app.dtmfInput = '';
      app.sendDtmf('1', { call: { uuid: 'call-123' } });
      expect(phoneSpy.sendDtmf).toHaveBeenCalledWith('1', 'call-123');
      expect(app.dtmfInput).toBe('1');

      app.sendDtmf('2', { call: { uuid: 'call-123' } });
      expect(app.dtmfInput).toBe('12');
    });
  });

  describe('Device Selection', () => {
    it('should update selectedInputDevice on change', () => {
      app.onInputDeviceChange({ detail: { value: 'device-1' } });
      expect(app.selectedInputDevice).toBe('device-1');
      expect(eventsSpy.publish).toHaveBeenCalledWith('phone:device-selected', 'device-1');
    });

    it('should update selectedOutputDevice on change', () => {
      app.onOutputDeviceChange({ detail: { value: 'output-1' } });
      expect(app.selectedOutputDevice).toBe('output-1');
    });
  });

  describe('Format Functions', () => {
    it('should format duration correctly', () => {
      expect(app.formatDuration(0)).toBe('00:00:00');
      expect(app.formatDuration(65)).toBe('00:01:05');
      expect(app.formatDuration(3661)).toBe('01:01:01');
      expect(app.formatDuration(3600)).toBe('01:00:00');
    });
    // formatTimestamp was removed — call timestamps now render via the date pipe.
  });

  describe('Phone Menu', () => {
    it('should toggle phone menu', async () => {
      menuSpy.enable.and.returnValue(Promise.resolve({} as HTMLIonMenuElement));
      menuSpy.toggle.and.returnValue(Promise.resolve(true));

      await app.togglePhoneMenu();

      expect(menuSpy.enable).toHaveBeenCalledWith(true, 'phone-sidebar');
      expect(menuSpy.toggle).toHaveBeenCalledWith('phone-sidebar');
    });

    it('should toggle menu pin state', () => {
      expect(app.isMenuPinned).toBe(false);
      app.pinRightMenu();
      expect(app.isMenuPinned).toBe(true);
      app.pinRightMenu();
      expect(app.isMenuPinned).toBe(false);
    });

    it('should change phone tab', () => {
      app.phoneTabChanged({ detail: { value: 'calls' } });
      expect(app.phone_tab).toBe('calls');

      app.phoneTabChanged({ detail: { value: 'settings' } });
      expect(app.phone_tab).toBe('settings');
    });
  });

  describe('Call Timer', () => {
    it('should start call timer when call is answered', fakeAsync(() => {
      app.handleCall({
        type: 'answer',
        call: { uuid: 'call-timer-test' },
        consumer: { caller_id_number: '555-1234' }
      });

      expect(app.activeCallsArray[0].start_time).toBeTruthy();

      // Fast forward 2 seconds
      tick(2000);

      expect(app.activeCallsArray[0].call_timer_string).toBe('00:00:02');

      // Clean up
      app.removeCallFromArray('call-timer-test');
      tick(1000);
    }));
  });
});
