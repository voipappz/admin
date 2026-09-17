import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Events } from '../events';
import { HandleRequest } from '../../_base/layout/services/handleRequest.service';
import { UserData } from '../user-data';
import { ApiPhone } from './api-phone';
import { WebRTCPhone } from './webrtc-phone';

@Injectable()
export class PhoneProvider {
  private phone_mode: string = 'api';
  private phoneSvc: any;
  private last_call_event;
  private initialized: boolean = false;

  constructor(
    private events: Events,
    public http: HttpClient,
    public handleRequest: HandleRequest,
    private userData: UserData,
    private api_phone_svc: ApiPhone,
    private webrtc_phone_svc: WebRTCPhone
  ) {
    this.phoneSvc = this.api_phone_svc;
  }

  /**
   * Initialize phone service. Safe to call multiple times.
   * Checks if user has extension data and starts WebRTC if available.
   * @returns true if WebRTC mode activated, false if using API mode
   */
  init(): boolean {
    console.log('[Phone] init() called, initialized:', this.initialized);

    // Check localStorage for saved preference
    const savedMode = localStorage.getItem('phone_mode');
    if (savedMode === 'api') {
      console.log('[Phone] Saved preference: API mode');
      this.phone_mode = 'api';
      this.phoneSvc = this.api_phone_svc;
      this.events.publish('phone:mode-changed', { mode: 'api' });
      return false;
    }

    // Check if user has extension data
    const user = this.userData.getUserData();
    const extension = user?.extension;

    if (!extension?.username || !extension?.password) {
      console.log('[Phone] No extension data, using API mode');
      this.phone_mode = 'api';
      this.phoneSvc = this.api_phone_svc;
      this.events.publish('phone:mode-changed', { mode: 'api' });
      return false;
    }

    // Start WebRTC phone
    const webrtcStarted = this.webrtc_phone_svc.start(!this.initialized);
    this.initialized = true;

    if (webrtcStarted) {
      console.log('[Phone] WebRTC mode activated');
      this.phone_mode = 'webrtc';
      this.phoneSvc = this.webrtc_phone_svc;
      this.events.publish('phone:mode-changed', { mode: 'webrtc' });
      return true;
    } else {
      console.log('[Phone] WebRTC start failed, using API mode');
      this.phone_mode = 'api';
      this.phoneSvc = this.api_phone_svc;
      this.events.publish('phone:mode-changed', { mode: 'api' });
      return false;
    }
  }
  outgoingCallSetUuid(uuid){
    if( this.phone_mode=='webrtc') this.phoneSvc.outgoingCallSetUuid(uuid);
  }
  getDialpadSearchUrl(){
    return this.handleRequest.getBaseUrl() + "/tasks/destinations"
  }
  setMode(mode: string): boolean {
    console.log('[Phone] setMode requested:', mode);

    if (mode === 'webrtc') {
      return this.init();
    } else {
      this.phone_mode = 'api';
      this.phoneSvc = this.api_phone_svc;
      console.log('[Phone] Switched to API mode');
      return true;
    }
  }
  getMode(): string {
    return this.phone_mode;
  }
  isWebRTCMode(): boolean {
    return this.phone_mode === 'webrtc';
  }
  checkStatus(){
    if( this.phone_mode=='webrtc') this.phoneSvc.checkStatus();
  }
  register(){
    if( this.phone_mode=='webrtc') this.phoneSvc.register();
  }
  unregister(){
    if( this.phone_mode=='webrtc') this.phoneSvc.unregister();
  }
  reconnect(): boolean {
    this.initialized = false;
    return this.init();
  }
  call(target:any, caller_id_number:string, options?:any){
    // return this.api_phone_svc.call(target, caller_id_number, options);
    // console.log(options)
    return this.phoneSvc.call(target, caller_id_number, options);
  }
  answer(call_uuid){
    return this.phoneSvc.answer(call_uuid);
  }

  transfer(target:any, caller_id_number:string, options?:any){
    // return this.phoneSvc.forward(target, caller_id_number, options);
    let body:any = {
      leg_a: options.leg_a,
      leg_b: {type: options.leg_b_type},
      profile:{caller_id_number:caller_id_number},
      transfer_type: options.transfer_type // blind or attended
    }
    if(options.leg_b_type == 'number'){
      body.leg_b.number = target;
    }else if(options.leg_b_type == 'extension'){
      body.leg_b.username = target;
    }
    return this.phoneSvc.forward(target, caller_id_number, options);
  }

  cancelTransfer(uuid){
    return this.handleRequest.patch("/api/calls/"+uuid+"?action=attended_transfer_cancel", {})
    .pipe(map(res => res))
    .toPromise();
  }
  merge(call_uuid){
    return this.phoneSvc.merge(call_uuid);
  }
  hangup(call_id:string, options?:any){
    if(!call_id) return new Promise((resolve,reject)=> reject('call id is missing'));;
    // this.api_phone_svc.hangup(call_id, options);
    return this.phoneSvc.hangup(call_id, options)//this.api_phone_svc.hangup(call_id, options)
  }
  sendDtmf(tones,call_uuid){
    this.phoneSvc.sendDtmf(tones, call_uuid)
  }
  hold(call_id:string, options:any){
    console.log("hold p", call_id, options)
    if(!call_id || !options.call_direction) return new Promise((resolve,reject)=> reject('call id is missing'));;
    if(options.call_direction == "outgoing"){
      options.to = "producer"
    }else if(options.call_direction == "incoming"){
      options.to = "consumer"
    }
    delete options.call_direction;
    // return this.api_phone_svc.hold(call_id, options)
    return this.phoneSvc.hold(call_id, options)
  }
  mute(call_id:string, options:any){
    if(!call_id) return new Promise((resolve,reject)=> reject('call id is missing'));;
    return this.phoneSvc.mute(call_id, options)
    // return this.hold(call_id, options);
  }
  spyAction(call_id:string, type:string){
    if(!call_id) return new Promise((resolve,reject)=> reject('call id is missing'));
    return this.handleRequest.patch("/api/calls/"+call_id+"?action=spy&type="+type, {})
    .toPromise();
  }
  conferenceDeleteMember(call_id:string, options?:any){
    if(!call_id) return new Promise((resolve,reject)=> reject('call id is missing'));;
    return this.phoneSvc.conferenceDeleteMember(call_id, options)
  }
  // answer(call_id:string, options?:any){
  //   return this.phoneSvc.answer(call_id, options)
  // }
  callEvent(message){
    this.last_call_event = message
  }
  confirmScheduledCall(call_uuid:string, options={}):Promise<any> {
    //console.log(this)
    //return this.phoneSvc.call(target, call_uuid, {action:"dial"});
    return this.handleRequest.patch("/api/calls/"+call_uuid, options)
    .pipe(map(res => res))
    .toPromise();
  }
  // callNumber(target:any, call_uuid:string, options={}):Promise<any> {
  //   return this.phoneSvc.call(target, call_uuid, {action:"dial"});
  // }
  callScheduled(call_uuid, target:any){
    return this.call(target, call_uuid,{action:"dial"})
  }
  callRecent(call_uuid, target:any){
    return this.call(target, call_uuid,{action:"dial"})
  }
}
