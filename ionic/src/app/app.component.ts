import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

import { MenuController, Platform, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

import { Storage } from '@ionic/storage-angular';

import { AuthService } from './core/providers/simple-auth.service';

import { UserData } from './core/providers/user-data';
import { Events } from './core/providers/events';
import { WebsocketProvider } from './core/providers/websocket';
import { HandleRequest } from './core/_base/layout/services/handleRequest.service';
import { TranslationService } from './core/_base/layout/services/translation.service';
import { PhoneProvider } from './core/providers/phone/phone';
import { AgentService } from './core/_base/layout/services/agent.service';
import { CallService } from './core/_base/layout/services/call.service';
import { ActiveCall, PhoneMode } from './core/providers/phone/phone.models';

import heLang from '../assets/data/i18n/he.json';
import enLang from '../assets/data/i18n/en.json';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private heLang = heLang;
  private enLang = enLang;
  loggedIn = false;
  dark = false;
  header_title:string = "";
  username:string = ""
  credit:string;
  customer_data:any;

  // Phone state
  show_phone: boolean = false;
  phone_tab: string = 'dialpad';
  webrtc_phone_state: string = '';
  webrtc_phone_mode: boolean = false;
  phoneModeWebrtc: boolean = true;
  isMenuPinned: boolean = false;
  dialInput: string = '';

  // Active calls management
  activeCallsArray: ActiveCall[] = [];
  callStatusText: string = '';

  // Transfer state (enum instead of boolean flags)
  phoneMode: PhoneMode = PhoneMode.IDLE;
  transferCall: ActiveCall | null = null;

  // User/Agent data
  user: any = {};
  agent: any = { status: 'available', extension: { username: '' }, state: 'waiting' };
  agentStatuses: any[] = [
    { title: 'logged_out', icon: 'log-out' },
    { title: 'available', icon: 'checkmark-circle' },
    { title: 'available_on_demand', icon: 'home' },
    { title: 'on_break', icon: 'time' }
  ];

  // Device selection
  audioInputDevices: MediaDeviceInfo[] = [];
  audioOutputDevices: MediaDeviceInfo[] = [];
  selectedInputDevice: string = '';
  selectedOutputDevice: string = '';

  // Call history (server-backed, mapped to { uuid, created_at, meta: {...} })
  callHistory: any[] = [];
  loadingCallHistory: boolean = false;

  // In-call DTMF
  showDtmfPad: boolean = false;
  dtmfInput: string = '';
  constructor(
    private menu: MenuController,
    private platform: Platform,
    private router: Router,
    private storage: Storage,
    private userData: UserData,
    private swUpdate: SwUpdate,
    private toastCtrl: ToastController,
    private events: Events,
    private auth: AuthService,
    private ws: WebsocketProvider,
    private handleRequest: HandleRequest,
    private translationService: TranslationService,
    private phoneSvc: PhoneProvider,
    private agentSvc: AgentService,
    private callSvc: CallService,
    private translate: TranslateService
  ) {
    this.translationService.loadTranslations(this.enLang, this.heLang);
    // Restore saved language from localStorage
    const savedLang = this.translationService.getSelectedLanguage();
    this.translationService.setLanguage(savedLang);
    this.initStorage();
    this.initializeApp();
    this.customer_data = this.userData.getCustomerData();
    // this.events.subscribe("user-update",()=>{
    //   this.setUserData()
    // })
  }

  async initStorage() {
    await this.storage.create();
  }

  ngOnInit() {
    this.checkLoginStatus();
    this.initDarkMode();
    const userData = this.userData.getUserData();
    if (userData?.extension) {
      this.loadPhoneData();
    }
    this.listenForLoginEvents();
    this.listenForPhoneEvents();

    // Only show update toast when a new version is ready (not for all version events)
    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(async (evt) => {
      const toast = await this.toastCtrl.create({
        message: 'Update available!',
        position: 'top',
        buttons: [
          {
            text: 'Reload',
            role: 'confirm'
          },
          {
            icon: 'close',
            role: 'cancel'
          }
        ]
      });

      await toast.present();

      toast.onDidDismiss().then((result) => {
        if (result.role === 'confirm') {
          this.swUpdate.activateUpdate().then(() => window.location.reload());
        }
      });
    });
    if(this.customer_data && this.customer_data.logo_title){//(CONFIG.PAGE_TITLE){
      document.title = this.customer_data.logo_title; //CONFIG.PAGE_TITLE;
    }
    if(this.customer_data && this.customer_data.logo_icon){//(CONFIG.FAVICON_LINK){
      // console.log("this.customer_data",this.customer_data)
      let link = <HTMLLinkElement>document.querySelector("link[rel~='icon']")
      if (!link) {
          link = <HTMLLinkElement>document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = this.customer_data.logo_icon;//CONFIG.FAVICON_LINK;

      link = <HTMLLinkElement>document.querySelector("link[rel~='apple-touch-icon']")
      if (!link) {
        link = <HTMLLinkElement>document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = this.customer_data.logo_icon;//CONFIG.FAVICON_LINK;
    }
    
  }

  initializeApp() {
    this.platform.ready().then(() => {
      if (this.platform.is('hybrid')) {
        StatusBar.hide();
        SplashScreen.hide();
      }
    });
  }
 
  checkLoginStatus() {
    return this.userData.isLoggedIn().then(loggedIn => {
      this.initWebSocket();
      return this.updateLoggedInStatus(loggedIn);
    });
  }

  updateLoggedInStatus(loggedIn: boolean) {
    setTimeout(() => {
      this.loggedIn = loggedIn;
    }, 300);
  }

  // Single source of truth for dark mode. Both toggles (header menu + phone
  // panel) call toggleDark()/publish 'app:toggle-dark'; the header mirrors the
  // state via the 'app:dark' event so there is only one dark mode.
  initDarkMode() {
    try { this.dark = localStorage.getItem('dark_theme') === '1'; } catch { this.dark = false; }
    document.body.classList.toggle('dark-theme', this.dark);
    this.events.subscribe('app:toggle-dark', () => this.toggleDark());
    // Let any already-mounted header sync its icon.
    this.events.publish('app:dark', this.dark);
  }

  toggleDark() {
    this.dark = !this.dark;
    try { localStorage.setItem('dark_theme', this.dark ? '1' : '0'); } catch {}
    document.body.classList.toggle('dark-theme', this.dark);
    this.events.publish('app:dark', this.dark);
  }

  listenForLoginEvents() {
    console.log("listenForLoginEvents")
    this.events.subscribe("app-login",()=>{
      console.log("listenForLoginEvents LOGIN-APP")
      this.initWebSocket()
      // Initialize phone after login
      this.loadPhoneData()
    });
    this.events.subscribe("user:reload",(data)=>{
      if (data && data.user) {
        this.user = data.user;
        // Phone init is now handled by loadPhoneData() which calls phoneSvc.init()
        // const extension = data.user.extension;
        // if (extension && extension.username && extension.password) {
        //   console.log('[Phone] Extension found after user reload, switching to WebRTC mode');
        //   this.phoneSvc.setMode('webrtc');
        // }
      }
    });
    this.events.subscribe("app-logout",()=>{
      console.log("listenForLoginEvents LOGOUT-APP")
      this.logout()
    })
    // window.addEventListener('user:login', () => {
    //   this.updateLoggedInStatus(true);
    // });

    // window.addEventListener('user:signup', () => {
    //   this.updateLoggedInStatus(true);
    // });

    // window.addEventListener('user:logout', () => {
    //   this.updateLoggedInStatus(false);
    // });
  }

  logout() {
    this.auth.logout()
      .subscribe({
        error: (err: any) => console.log(err),
        complete: () => {
          // this.authStatus.logout();
          this.userData.clearUserData();  // Clear user data including active_id
          this.destroyWebSocket();
          // this.phoneSvc.unregister();
          // this.nav.setRoot("page-login");
          return this.router.navigateByUrl('/login');
        }
      });
    // this.userData.logout().then(() => {
      
    // });
  }
  setHeader(){
    let path = this.router.url.split('/');
    if(path.indexOf('login')>-1){
      this.header_title = "Login"
    }else{
      let title = decodeURIComponent(path[2]);
      this.header_title = title.charAt(0).toUpperCase() + title.slice(1);
    }
    
  }
  destroyWebSocket() {
    this.ws.leave('notifications');
    this.ws.close();
  }
  // WebSocket notification handlers — extensible map instead of if-else chain
  private wsHandlers: Record<string, (notification: any) => void> = {
    'ping': (n) => {
      console.warn('ping', n.message);
    },
    'join': (n) => {
      console.warn('join', n);
      this.events.publish('app:call:event', { message: n });
    },
    'failed': (n) => {
      console.error(n.message);
      this.handleRequest.handleErrors({ message: n.message }, 999);
    },
    'success': (n) => {
      console.log(n.message);
      this.events.publish('app:notifications:success', { message: n.message });
    },
    'agent': (n) => {
      if (n.message?.type === 'redirect') {
        this.events.publish('screen_redirect', n.message);
      } else if (n.message) {
        // Server-side call event — process through handleCall
        this.phoneSvc.callEvent(n.message);
        this.handleCall(n.message);
      }
    },
    'status': (n) => {
      console.log('[WS] Status changed:', n.message);
      if (n.message?.status) {
        this.agent.status = n.message.status;
        this.userData.setUserData(this.agent.status, 'status');
      }
    },
    'state': (n) => {
      console.log('[WS] State changed:', n.message);
      if (n.message?.state) {
        this.agent.state = n.message.state;
        this.userData.setUserData(this.agent.state, 'state');
      }
    }
  };

  initWebSocket() {
    this.handleRequest.wsStatus()
      .then((v) => {
        console.log("[success connecting to websocket]");
        this.ws.connect();
        this.ws.join('notifications', { user_uuid: this.userData.getUsername() });

        this.ws.getChannel('notifications').received()
          .subscribe(notification => {
            console.log("received", notification);
            const handler = this.wsHandlers[notification.type];
            if (handler) {
              handler(notification);
            }
          });
      })
      .catch((v) => {
        this.handleRequest.handleErrors({ message: "error connecting to service" }, 500);
      });
  }

  loadPhoneData() {
    try {
      const userInfo = this.userData.getUserData();
      console.log('[Phone] Loading phone data, user:', userInfo);
      if (userInfo) {
        this.user = userInfo;
      }
      this.show_phone = true;

      // Restore phone mode from localStorage
      const savedMode = localStorage.getItem('phone_mode');
      if (savedMode === 'api') {
        this.phoneModeWebrtc = false;
        this.phoneSvc.setMode('api');
      } else {
        this.phoneModeWebrtc = true;
        this.phoneSvc.init();
      }

      // Load agent status from server if available
      const userData = this.userData.getUserData();
      if (userData?.status) {
        this.agent.status = userData.status;
      }
    } catch (err) {
      console.error('Error loading phone data:', err);
      this.show_phone = true;
    }
  }

  listenForPhoneEvents() {
    // Programmatic dial requests (e.g. "Join conference"). Routes through the
    // normal outgoing-call path; no WebRTC changes.
    this.events.subscribe('phone:dial', (number: any) => {
      const target = ('' + (number ?? '')).trim();
      if (!target) { return; }
      this.dialInput = target;
      this.makeCall();
    });

    // Call events
    this.events.subscribe('sip:call-message', (data) => {
      this.handleCall(data);
      if (data.type === 'hangup' && this.phone_tab === 'calls') {
        setTimeout(() => this.loadCallHistory(), 1500);
      }
    });

    // WebRTC state changes. Guard against a non-string slipping through (it
    // would render as "[object Object]" and break the string checks below).
    this.events.subscribe('phone:webrtc-state', (state) => {
      const status = typeof state === 'string' ? state : (state?.title || '');
      this.webrtc_phone_state = status;
      this.webrtc_phone_mode = status !== 'Unregistered' && status.indexOf('Error') === -1;
    });

    // Device / microphone / signaling problems (separate channel so status
    // stays a string). These are the only report a mid-call failure gets — a
    // refused `dial`, a denied mic, a dead socket — so they must be visible,
    // not console-only.
    this.events.subscribe('phone:webrtc-error', (err) => {
      console.error('[Phone] WebRTC error:', err);
      this.stopRingbackTone();
      const message = [err?.title, err?.message].filter(Boolean).join(': ') || 'Phone error';
      this.toastCtrl.create({
        message, duration: 4000, position: 'top', color: 'danger'
      }).then(t => t.present());
    });

    // Hangup events
    this.events.subscribe('phone:webrtc-event', (data) => {
      if (data.type === 'hangup' && data.session_id) {
        this.removeCallFromArray(data.session_id);
      }
    });

    // Device list updates
    this.events.subscribe('phone:devices-list-event', (data) => {
      console.log('[Phone] Device list updated:', data);
      this.audioInputDevices = data.inputs || [];
      this.audioOutputDevices = data.outputs || [];
      // Set default selection if not already set
      if (!this.selectedInputDevice && this.audioInputDevices.length > 0) {
        this.selectedInputDevice = this.audioInputDevices[0].deviceId;
      }
      if (!this.selectedOutputDevice && this.audioOutputDevices.length > 0) {
        this.selectedOutputDevice = this.audioOutputDevices[0].deviceId;
      }
    });
  }

  /**
   * Normalize consumer data — extract fullname from first/last name fields.
   * Replaces 4+ duplicate blocks in the reference code.
   */
  private normalizeConsumer(consumer: any): any {
    if (!consumer) return { fullname: 'Unknown' };
    if (consumer.type === 'contact' && consumer.uuid && (consumer.first_name || consumer.last_name)) {
      consumer.fullname = `${consumer.first_name || ''} ${consumer.last_name || ''}`.trim();
    }
    if (!consumer.fullname) {
      consumer.fullname = consumer.caller_id_name || consumer.caller_id_number || 'Unknown';
    }
    return consumer;
  }

  /**
   * Build an ActiveCall object from incoming event data.
   */
  private buildActiveCall(data: any, statusText: string): ActiveCall {
    const consumer = this.normalizeConsumer(data.consumer);
    const contacts = consumer ? [{ ...consumer, call_uuid: data.call?.uuid }] : [];
    return {
      type: data.type,
      call: { ...data.call, uuid: data.call?.uuid || data.uuid },
      consumer: consumer,
      conference: data.conference || undefined,
      contacts: contacts,
      call_timer_string: '00:00:00',
      on_mute: false,
      on_hold: false,
      status_text: statusText,
      start_time: data.type === 'answer' ? Date.now() : null,
      campaign: data.campaign,
      did: data.did,
      screen: data.screen,
      feedback: data.feedback
    };
  }

  handleCall(data: any) {
    if (!data.call?.uuid && !data.uuid) return;

    const callUuid = data.call?.uuid || data.uuid;
    data.consumer = this.normalizeConsumer(data.consumer);

    // Determine status text
    let statusText = '';
    switch (data.type) {
      case 'connecting':
      case 'trying':
        statusText = 'Calling...';
        break;
      case 'ringing':
        statusText = data.call?.direction === 'incoming' ? 'Incoming Call...' : 'Ringing...';
        break;
      case 'answer':
        statusText = 'Connected';
        this.stopRingbackTone();
        break;
      case 'hangup':
        statusText = 'Call Ended';
        this.stopRingbackTone();
        break;
      case 'conference':
        statusText = 'Conference';
        break;
      default:
        statusText = data.type || '';
    }

    // Handle conference events separately
    if (data.type === 'conference') {
      this.handleConferenceEvent(data);
      return;
    }

    // For outgoing ringing, resolve the server-side UUID
    if (data.type === 'ringing' && data.call?.direction === 'outgoing') {
      this.phoneSvc.outgoingCallSetUuid(callUuid);
    }

    // Check if this is a conference call (new member joining existing call)
    const isConferenceCall = data.call?.type === 'call_to_conference_extension';
    const originCallIndex = isConferenceCall && data.call?.origin_call_uuid
      ? this.activeCallsArray.findIndex(c => c.call.uuid === data.call.origin_call_uuid)
      : -1;

    const callIndex = this.activeCallsArray.findIndex(c => c.call.uuid === callUuid);

    if (data.type === 'answer' && isConferenceCall && originCallIndex > -1) {
      // Conference: merge new member into the origin call's contacts array
      const originCall = this.activeCallsArray[originCallIndex];
      const newContact = {
        ...data.consumer,
        call_uuid: callUuid,
        on_hold: false
      };
      if (!originCall.contacts) originCall.contacts = [];
      originCall.contacts.unshift(newContact);
      originCall.type = 'answer';
      originCall.status_text = 'Connected';

      // Set conference UUID if provided
      if (data.conference?.uuid) {
        originCall.conference = data.conference;
      }

      // Remove the separate call entry if it exists
      if (callIndex > -1) {
        this.activeCallsArray.splice(callIndex, 1);
      }

      // Start timer if not already running
      if (!originCall.start_time) {
        originCall.start_time = Date.now();
        this.startCallTimer(originCall.call.uuid);
      }

      console.log('[Phone] Conference member added to call:', originCall.call.uuid);
      return;
    }

    if (callIndex === -1) {
      // New call
      const newCall = this.buildActiveCall(data, statusText);
      this.activeCallsArray.unshift(newCall);
      console.log('[Phone] New call added:', data.type, callUuid);

      // Show incoming call toast for non-transfer incoming calls
      if (data.type === 'ringing' && data.call?.direction !== 'outgoing' && !data.call?.transfer_origin) {
        this.showIncomingCallToast(newCall);
      }

      if (data.type === 'answer') {
        this.startCallTimer(callUuid);
      }
    } else {
      // Update existing call
      const existingCall = this.activeCallsArray[callIndex];
      existingCall.type = data.type;
      existingCall.status_text = statusText;

      // Update consumer data if provided
      if (data.consumer?.fullname && data.consumer.fullname !== 'Unknown') {
        existingCall.consumer = data.consumer;
        if (existingCall.contacts?.length) {
          existingCall.contacts[0] = { ...existingCall.contacts[0], ...data.consumer, call_uuid: callUuid };
        }
      }

      // Update conference info
      if (data.conference?.uuid) {
        existingCall.conference = data.conference;
      }

      console.log('[Phone] Call updated:', data.type, callUuid);

      // Start timer when answered
      if (data.type === 'answer' && !existingCall.start_time) {
        existingCall.start_time = Date.now();
        this.startCallTimer(callUuid);
      }

      // Remove call on hangup after short delay
      if (data.type === 'hangup') {
        this.handleHangup(data, callIndex);
      }
    }
  }

  /**
   * Handle conference-specific events (add-member / del-member).
   */
  private handleConferenceEvent(data: any) {
    if (!data.conference?.uuid || !data.consumer) return;

    for (const call of this.activeCallsArray) {
      if (call.conference?.uuid !== data.conference.uuid || !call.contacts) continue;

      if (data.action === 'add-member') {
        // Update member_id on existing contact
        const contact = call.contacts.find(c => c.uuid === data.consumer.uuid);
        if (contact) {
          contact.member_id = data.consumer.member_id;
        }
        // Track self member_id
        if (data.consumer.uuid === this.userData.getUserData('uuid')) {
          call.self_member_id = data.consumer.member_id;
        }
      }

      if (data.action === 'del-member') {
        const memberIdx = call.contacts.findIndex(c => c.member_id === data.consumer.member_id);
        if (memberIdx > -1) {
          call.contacts.splice(memberIdx, 1);
        }
      }
    }
  }

  /**
   * Handle hangup — conference member removal or full call removal with delay.
   */
  private handleHangup(data: any, callIndex: number) {
    const call = this.activeCallsArray[callIndex];

    // Conference member hangup: remove member, keep call alive
    if (data.conference?.uuid && data.consumer?.member_id && call.contacts) {
      const memberIdx = call.contacts.findIndex(c => c.member_id === data.consumer.member_id);
      if (memberIdx > -1) {
        call.contacts.splice(memberIdx, 1);
      }
      return; // Don't remove the call itself
    }

    // Normal hangup: remove after short delay
    const callUuid = call.call.uuid;
    setTimeout(() => {
      this.removeCallFromArray(callUuid);
      if (this.activeCallsArray.length === 0) {
        this.phone_tab = 'dialpad';
        this.phoneMode = PhoneMode.IDLE;
        this.transferCall = null;
      }
    }, 2000);
  }

  startCallTimer(callUuid: string) {
    const interval = setInterval(() => {
      const callIndex = this.activeCallsArray.findIndex(c => c.call.uuid === callUuid);
      if (callIndex === -1) {
        clearInterval(interval);
        return;
      }
      const call = this.activeCallsArray[callIndex];
      if (call.start_time) {
        const elapsed = Math.floor((Date.now() - call.start_time) / 1000);
        call.call_timer_string = this.formatDuration(elapsed);
      }
    }, 1000);
  }

  removeCallFromArray(session_id) {
    this.activeCallsArray = this.activeCallsArray.filter(c => c.call.uuid !== session_id);
  }

  pinRightMenu() {
    this.isMenuPinned = !this.isMenuPinned;
  }

  phoneMenuWillOpen() {
    if (this.phone_tab === 'calls') {
      this.loadCallHistory();
    }
  }

  phoneTabChanged(event) {
    this.phone_tab = event.detail.value;
    if (this.phone_tab === 'calls') {
      this.loadCallHistory();
    }
  }

  // Call actions
  answer(call: ActiveCall) {
    this.phoneSvc.answer(call.call.uuid)
      .then(() => console.log('[Phone] Call answered'))
      .catch((err: any) => console.error('[Phone] Answer failed:', err));
  }

  hangup(call: ActiveCall) {
    // Conference: hang up entire conference
    if (call.conference?.uuid && call.type === 'answer') {
      this.phoneSvc.hangup(call.conference.uuid, { type: 'all' })
        .then(() => console.log('[Phone] Conference hangup'))
        .catch((err: any) => console.error('[Phone] Conference hangup failed:', err));
      return;
    }

    // Transfer origin: cancel transfer instead of hanging up
    if (call.call.transfer_origin) {
      this.phoneSvc.cancelTransfer(call.call.uuid)
        .then(() => console.log('[Phone] Transfer cancelled'))
        .catch((err: any) => console.error('[Phone] Cancel transfer failed:', err));
      return;
    }

    // Normal hangup
    this.phoneSvc.hangup(call.call.uuid, {})
      .then(() => console.log('[Phone] Call hung up'))
      .catch((err: any) => console.error('[Phone] Hangup failed:', err));
  }

  holdCall(call: ActiveCall) {
    const isOnHold = call.contacts?.[0]?.on_hold ?? call.on_hold;
    const action = isOnHold ? 'unhold' : 'hold';
    this.phoneSvc.hold(call.call.uuid, { action, call_direction: call.call.direction || 'outgoing' })
      .then(() => {
        // Update hold state on contact and on call
        if (call.contacts?.[0]) call.contacts[0].on_hold = !isOnHold;
        call.on_hold = !isOnHold;
      })
      .catch((err: any) => console.error('[Phone] Hold failed:', err));
  }

  muteCall(call: ActiveCall) {
    const action = call.on_mute ? 'unmute' : 'mute';
    this.phoneSvc.mute(call.call.uuid, { action })
      .then(() => { call.on_mute = !call.on_mute; })
      .catch((err: any) => console.error('[Phone] Mute failed:', err));
  }

  async togglePhoneMenu() {
    await this.menu.enable(true, 'phone-sidebar');
    await this.menu.toggle('phone-sidebar');
  }

  dialpadPress(digit: string) {
    this.dialInput += digit;
  }

  /**
   * Unified call/transfer handler. Checks PhoneMode to decide action.
   */
  makeCall() {
    if (!this.dialInput || this.dialInput.length < 3) return;

    const target = this.dialInput;
    this.dialInput = '';

    if (this.phoneMode !== PhoneMode.IDLE && this.transferCall) {
      // Transfer mode: execute transfer
      const transferType = this.phoneMode === PhoneMode.COLD_TRANSFER ? 'blind' : 'attended';
      console.log('[Phone] Transferring call to:', target, 'type:', transferType);

      this.phoneSvc.transfer(target, '', {
        leg_a: { type: 'call', uuid: this.transferCall.call.uuid },
        leg_b_type: 'number',
        transfer_type: transferType
      })
        .then(() => console.log('[Phone] Transfer initiated'))
        .catch((err: any) => console.error('[Phone] Transfer failed:', err));

      // Reset transfer state
      this.phoneMode = PhoneMode.IDLE;
      this.transferCall = null;
    } else {
      // Normal outgoing call
      console.log('[Phone] Making call to:', target);
      this.startRingbackTone();

      this.phoneSvc.call(target, '', { leg_b_type: 'number' })
        .then(() => console.log('[Phone] Call initiated'))
        .catch((err: any) => {
          console.error('[Phone] Call failed:', err);
          this.stopRingbackTone();
          this.toastCtrl.create({
            message: 'Call failed: ' + (err || 'Unknown error'),
            duration: 3000, position: 'top', color: 'danger'
          }).then(t => t.present());
        });
    }
  }

  // Transfer actions
  attendedTransfer(call: ActiveCall) {
    this.phoneMode = PhoneMode.ATTENDED_TRANSFER;
    this.transferCall = call;
    this.phone_tab = 'dialpad';
  }

  blindTransfer(call: ActiveCall) {
    this.phoneMode = PhoneMode.COLD_TRANSFER;
    this.transferCall = call;
    this.phone_tab = 'dialpad';
  }

  cancelTransferMode() {
    this.phoneMode = PhoneMode.IDLE;
    this.transferCall = null;
  }

  // Conference actions
  dismissMember(call: ActiveCall, member: any) {
    if (!call.conference?.uuid) return;
    const options: any = { confernce_uuid: call.conference.uuid };
    if (member === 'self') {
      options.member_id = call.self_member_id;
    } else {
      options.member_id = member.member_id;
    }
    this.phoneSvc.conferenceDeleteMember(member.call_uuid || call.call.uuid, options)
      .then(() => console.log('[Phone] Conference member dismissed'))
      .catch((err: any) => console.error('[Phone] Dismiss failed:', err));
  }

  mergeCall(call: ActiveCall) {
    this.phoneSvc.merge(call.call.uuid)
      .then(() => console.log('[Phone] Calls merged'))
      .catch((err: any) => console.error('[Phone] Merge failed:', err));
  }

  // Spy actions
  spyAction(call: ActiveCall, action: string) {
    this.phoneSvc.spyAction(call.call.uuid, action)
      .then(() => { call.call.spy = action; })
      .catch((err: any) => console.error('[Phone] Spy action failed:', err));
  }

  // Call history — recent calls from the box's own log (/api/admin/calls).
  // CallService maps the local fields into `meta`, so this just takes the rows.
  loadCallHistory() {
    if (this.loadingCallHistory) return;
    this.loadingCallHistory = true;
    this.callSvc.getPage(1, { type: 'all' }).subscribe({
      next: (res: any) => {
        this.callHistory = (res?.body || []);
        this.loadingCallHistory = false;
      },
      error: (err: any) => {
        console.error('[Phone] Failed to load call history:', err);
        this.loadingCallHistory = false;
      }
    });
  }

  callFromHistory(entry: any) {
    const number = entry?.meta?._contact_number || '';
    if (!number) return;
    this.dialInput = number;
    this.phone_tab = 'dialpad';
  }

  // Device selection
  onInputDeviceChange(event: any) {
    this.selectedInputDevice = event.detail.value;
    this.events.publish('phone:device-selected', this.selectedInputDevice);
    console.log('[Phone] Input device changed:', this.selectedInputDevice);
  }

  onOutputDeviceChange(event: any) {
    this.selectedOutputDevice = event.detail.value;
    // Set output device on audio element
    const audioElement = document.getElementById('audioRemote') as any;
    if (audioElement && audioElement.setSinkId) {
      audioElement.setSinkId(this.selectedOutputDevice)
        .then(() => console.log('[Phone] Output device set:', this.selectedOutputDevice))
        .catch((err: any) => console.error('[Phone] Failed to set output device:', err));
    }
  }

  // In-call DTMF
  toggleDtmfPad(call: any) {
    this.showDtmfPad = !this.showDtmfPad;
    this.dtmfInput = '';
  }

  sendDtmf(digit: string, call: any) {
    this.dtmfInput += digit;
    this.phoneSvc.sendDtmf(digit, call.call.uuid);
    console.log('[Phone] DTMF sent:', digit);
  }

  // Incoming call toast notification
  private async showIncomingCallToast(call: ActiveCall) {
    const name = call.consumer?.fullname
      || call.consumer?.caller_id_number
      || this.translate.instant('PHONE.STATE.UNKNOWN');
    const campaignName = call.campaign?.name ? ` (${call.campaign.name})` : '';
    const toast = await this.toastCtrl.create({
      message: this.translate.instant('PHONE.STATE.INCOMING_CALL_FROM', { name }) + campaignName,
      position: 'top',
      duration: 5000,
      cssClass: 'incoming-call-toast',
      buttons: [
        { text: this.translate.instant('PHONE.ACTIONS.ANSWER'), handler: () => { this.answer(call); } },
        { text: this.translate.instant('PHONE.ACTIONS.DISMISS'), role: 'cancel' }
      ]
    });
    await toast.present();
  }

  // Phone mode toggle
  phoneModeChanged() {
    const mode = this.phoneModeWebrtc ? 'webrtc' : 'api';
    this.phoneSvc.setMode(mode);
    localStorage.setItem('phone_mode', mode);
    console.log('[Phone] Mode changed to:', mode);
  }

  // Registration toggle
  toggleRegistration() {
    if (this.webrtc_phone_state === 'Ready') {
      this.phoneSvc.unregister();
    } else {
      const result = this.phoneSvc.reconnect();
      if (!result) {
        this.toastCtrl.create({
          message: 'No extension configured. Cannot register.',
          duration: 3000, position: 'top', color: 'warning'
        }).then(t => t.present());
      }
    }
  }

  // Agent status management
  changeAgentStatus(status: string) {
    if (!status || status === this.agent.status) return;
    const previous = this.agent.status;
    this.agent.status = status;
    this.agentSvc.update({ status }).subscribe({
      next: () => {
        this.userData.setUserData(status, 'status');
        console.log('[Agent] Status changed to:', status);
      },
      error: (err: any) => {
        console.error('[Agent] Status change failed:', err);
        this.agent.status = previous;
      }
    });
  }

  changeAgentState(state: string) {
    this.agentSvc.updateState(state).subscribe({
      next: () => {
        this.agent.state = state;
        this.userData.setUserData(state, 'state');
        console.log('[Agent] State changed to:', state);
      },
      error: (err: any) => console.error('[Agent] State change failed:', err)
    });
  }

  // Ringtone/Ringback control
  startRingbackTone() {
    try {
      const audio = document.getElementById('ringbacktone') as HTMLAudioElement;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.warn('[Phone] Ringback play failed:', e));
      }
    } catch (e) {
      console.warn('[Phone] Could not start ringback:', e);
    }
  }

  stopRingbackTone() {
    try {
      const audio = document.getElementById('ringbacktone') as HTMLAudioElement;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    } catch (e) {
      console.warn('[Phone] Could not stop ringback:', e);
    }
  }

  // Format call duration for display
  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.activeCallsArray = [];
  }
}
