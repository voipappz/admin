
import { ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { ConferenceData } from '../../core/providers/conference-data';
import { ActionSheetController } from '@ionic/angular';
import { Browser } from '@capacitor/browser';
// import { MediaDevicesShim, VideoRoomBuilder, WebRTCShim } from 'janus-gateway-tsdx'


// import { Devices, WebrtcService } from 'janus-angular';
import { Devices, WebrtcService } from '../../../assets/angular-janus-master/projects/janus/src/public-api';
import { interval,Subscription } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import { AudioCallService } from '../../core/providers/audio-call.service'
import { AudioBridgePlugin } from 'janus-gateway-tsdx';
import { Events } from '../../core/providers/events';
declare var CONFIG:any;
@Component({
    selector: 'page-chat-room',
    templateUrl: 'chat-room.html',
    styleUrls: ['./chat-room.scss'],
    providers: [
        AudioCallService,
        AudioBridgePlugin
    ],
    standalone: false
})
export class ChatRoomPage {
  $audio: HTMLAudioElement;
  @ViewChild('audio',{ static: false }) set audio(ref:ElementRef<HTMLAudioElement>){
    this.$audio = ref.nativeElement;
  };
  active_call:boolean=true;
  audioEventsSubscription:Subscription
  routerEventsSubscription:Subscription
  dataAvailable:boolean = true;
  message:string="";
  header_title:string="Waiting for a call"//"User in call"
  contact: any;
  roomId:any;
  guestId:any="";
  wsUrl:string;
  devices: Devices;
  httpUrl: string;
  pin: string;
  isMuted = false;
  audio_available:boolean=false;
  type:string=''
  remoteFeed:any;
  room:any ={};
  // ////////////////////////////////
  // // Media constraints documentation here:
  // // https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints
  // // https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
  // MEDIA_CONSTRAINTS = {
  //   audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
  //   video: { width: { ideal: 1280 }, height: { ideal: 720 } },
  // }
  // room:any;
  
      
  // //////////////////////////////////
  startTimerFlag:boolean=false;
  constructor(
    private changeDetector: ChangeDetectorRef,
    private dataProvider: ConferenceData,
    private ref: ChangeDetectorRef,
    private route: ActivatedRoute,
    private events:Events,
    public actionSheetCtrl: ActionSheetController,
    public confData: ConferenceData,
    private webrtc: WebrtcService,
    private router:Router,
    private audioCallSvc: AudioCallService
  ) { 
    // this.room = new VideoRoomBuilder('ws://homer.voipappz.io:8188', this.MEDIA_CONSTRAINTS, new MediaDevicesShim(), new WebRTCShim())
    //     .onLocalVideo(stream => console.log('Local video:', stream))
    //     .onRemoteVideo(event => console.log('Remote video:', event))
    //     .onUnpublished((feeId) => console.log('Unpublished:', feeId))
    //     .onLeaving((feeId) => console.log('Unpublished:', feeId));
    
    //     this.room.join(this.room, this.route.snapshot.paramMap.get('roomId'))
    //     .then(room => console.log(room))
    this.startTimerFlag=false;
    this.events.subscribe("app:call:event",  msg=> {
      console.log("app:call:event -- msg",msg)
      if(msg.message && msg.message.type=='join' && !this.startTimerFlag && msg.message.data && msg.message.data.display=='UserB' && msg.message.data.room==this.roomId){
        this.startTimer(this.room,0)
        this.startTimerFlag=true;
        this.header_title="User in call"
      }
    });
    this.events.subscribe("chat-room-event", msg=>{
      if(msg.message && msg.message=='hangup'){
        if(this.guestId=='UserB'){
          this.dataAvailable = false;
          this.message = "Call ended";
          this.header_title = "Call ended";
          this.changeDetector.detectChanges();
        }else{
          this.router.navigateByUrl('/contacts');
        }
      }
    })

  }
  async ngOnInit(): Promise<void> {
    // this.dataAvailable = true;
    this.devices = await this.webrtc.getDefaultDevices();
    
  }
  onError(error: {code: number, message: string}): void {
    // window.alert('Error: ' + error.message);
    console.error("janus error ", error.code,  error.message)
    this.ngOnDestroy();
    if(this.guestId=='UserB'){
      this.dataAvailable = false;
      this.message = "Call ended";
      this.header_title = "Call ended";
      this.changeDetector.detectChanges();
    }else{
      this.router.navigateByUrl('/contacts');
    }

  }
  old_publish_event:any=[]
  onPublish(e): void {
    console.log('onPublish: ', e);//TODO
    if(this.old_publish_event.length==1 && e.length==0){
      this.endCall();
    }
    this.old_publish_event = e;
  }
  async endCall(){
    // const stream = await this.webrtc.getUserMedia('', '');
    // this.webrtc.clearMediaStream(stream);
    this.confData.endCall(this.roomId)
    if(this.guestId=='UserB'){
      this.audioCallSvc.close(this.roomId)
      this.dataAvailable = false;
      this.message = "Call ended";
      this.header_title = "Call ended";
      this.changeDetector.detectChanges();
    }else{
      this.router.navigateByUrl('/contacts');
    }
  }
  ngOnDestroy(){
    this.dataAvailable = false;
    this.active_call=false;
    this.changeDetector.detectChanges();
    if(this.routerEventsSubscription) this.routerEventsSubscription.unsubscribe();
    if(this.audioEventsSubscription) this.audioEventsSubscription.unsubscribe();
    // this.endTimer();
    if(this.type=='voice'){
      this.audioCallSvc.close(this.roomId)
    }
    console.log("ngOnDestroy chat room");
    this.events.destroy("app:call:event")
  }
  // ionViewDidEnter(){
  //   window.onbeforeunload = () => this.ngOnDestroy();
  //   this.routerEventsSubscription = this.router.events.subscribe(
  //     event => {
  //       console.log(event)
  //       if(event instanceof NavigationStart){
  //         this.ngOnDestroy();
  //       }
  //     });
  // }
  // ionViewDidEnter() {
    ngAfterViewInit(){
    window.onbeforeunload = () => this.ngOnDestroy();
    this.routerEventsSubscription = this.router.events.subscribe(
      event => {
        console.log(event)
        if(event instanceof NavigationStart){
          this.ngOnDestroy();
        }
      });
    // this.dataProvider.load().subscribe((data: any) => {
      this.roomId = +this.route.snapshot.paramMap.get('roomId');
      let url=this.router.url;
      console.log("url",url)
      this.guestId = (url.indexOf('/app/')==-1)?'UserA':'UserB'//this.route.snapshot.paramMap.get('guestId');
      this.startTimer(this.room,0)
      if(this.guestId=='UserB'){
        // this.startTimer(this.room,0)
        // this.startTimerFlag=true;
        this.header_title="User in call"
      }
      this.type = this.route.snapshot.paramMap.get('type');
      this.wsUrl = CONFIG.WEBSOCKETS_JANUS_URL;
      this.dataAvailable = false;
      this.confData.roomStatus(this.roomId).toPromise().then(res=>{
        if(this.type=='voice'){
          console.log("janus element ----------", this.$audio)
          this.audioCallSvc.init(this.roomId, this.$audio)
          this.audioEventsSubscription= this.audioCallSvc.media_status.subscribe(data=>{
            console.log("data----------------", data)
            this.audio_available = data
            // this.ref.detectChanges()
          })
          // this.audioCallSvc.join()
        }
        this.dataAvailable = true;
      },
      err => {
        console.log(err);
        if(this.guestId=='UserB'){
          window.location.href = 'https://acvideo.voipappz.io/api/error';//TODO
        }else{
          this.router.navigateByUrl('/contacts');
        }
        return err;
      })
      // if (data && data.contacts) {
      //   for (const contact of data.contacts) {
      //     if (contact && contact.id === this.roomId) {
      //       this.contact = contact;
      //       break;
      //     }
      //   }
      // }
    // });
    // this.startTimer(this.room,0)
    console.log("roomid ,this.type, this.guestId", this.roomId,this.type, this.guestId  )
  }
  startTimer(obj:any, start_time:any=0){
    if(obj.timerVar) obj.timerVar.unsubscribe();
    if(start_time!=0) {
      start_time = Math.floor(Date.parse(start_time)/1000);
    }
    let hours = 0;
    let seconds = 0;
    let minutes = 0;
    obj.call_timer_string = '';
    obj.timer = 0//Math.floor(new Date().getTime()/1000) -(+start_time)//0 ; //TODO call_start_at timestemp from server
    obj.timerVar = interval(1000).pipe(takeWhile(val=>this.dataAvailable)).subscribe(x => {
      obj.call_timer_string = this.secondsToString(obj.timer)
      obj.timer++;
    })

  }
  // endTimer(){
  //   this.dataAvailable = false;
  // }
  private secondsToString(sec){
    // console.log("secondsToStringdd",sec)
    let time_string = "";
    let hours = Math.floor(sec/3600);
    let minutes = Math.floor(sec/60);
    let seconds = sec-(minutes*60);
    if(hours>0){
      time_string += hours.toString()+":"
    }
    time_string += (minutes<10)? "0"+minutes.toString()+":" : minutes.toString()+":";
    time_string += (seconds<10)? "0"+seconds.toString() : seconds.toString();
    return time_string;
  }
  ionViewWillLeave() {

  }

  async openExternalUrl(url: string) {
    await Browser.open({ url });
  }

  async openContactShare(contact: any) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Share ' + contact.name,
      buttons: [
        {
          text: 'Copy Link',
          handler: () => {
            console.log(
              'Copy link clicked on https://twitter.com/' + contact.twitter
            );
            if (
              (window as any).cordova &&
              (window as any).cordova.plugins.clipboard
            ) {
              (window as any).cordova.plugins.clipboard.copy(
                'https://twitter.com/' + contact.twitter
              );
            }
          }
        },
        {
          text: 'Share via ...'
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async openContact(contact: any) {
    const mode = 'ios'; // this.config.get('mode');

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Contact ' + contact.name,
      buttons: [
        {
          text: `Email ( ${contact.email} )`,
          icon: mode !== 'ios' ? 'mail' : null,
          handler: () => {
            window.open('mailto:' + contact.email);
          }
        },
        {
          text: `Call ( ${contact.phone} )`,
          icon: mode !== 'ios' ? 'call' : null,
          handler: () => {
            window.open('tel:' + contact.phone);
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }
}
