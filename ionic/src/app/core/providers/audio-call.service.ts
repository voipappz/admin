

import { Injectable } from "@angular/core";
// import * as JANUS from 'janus-gateway-js';  // DISABLED - causes crash due to buggy userAgent parsing
import { Subject } from "rxjs";
import {Events} from './events'
declare var CONFIG:any;
const MEDIA_CONSTRAINTS = {
    audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
    video: false,
  }
@Injectable()
export class AudioCallService {
  media_status = new Subject<boolean>();
    clientOptions: any = { token: 'token',
                            // apisecret: 'secret',
                            keepalive: 'true' }
    // mediaDevices: MediaDevices 
    // webRTC: WebRTC
    private readonly address: string;

  private client: any;
  private connection?: any;
  private session?: any;
  private plugin?: any;
  mediaConstraints:MediaStreamConstraints

  private joinInfo?: any;
  room_id;
  toasts: any[] = [];
  constructor(
    // private http: HttpClient,
    private events: Events,
    // private toastCtrl: ToastController,
    // private alertCtrl: AlertController,
    // mediaConstraints: MediaStreamConstraints,
    // private audioBridgePlugin: AudioBridgePlugin,
    // public translate: TranslateService
    //  public mediaDevices: MediaDevices,
    //  public webRTC: WebRTC
  ) { 
    // this.mediaConstraints = mediaConstraints
    // this.mediaDevices = mediaDevices
    // this.client = new Client(CONFIG.WEBSOCKETS_JANUS_URL, this.clientOptions, mediaDevices, webRTC);
        
  }
//   attachMediaStream(element, stream) {
//     if(adapter.browserDetails.browser === 'chrome') {
//         var chromever = adapter.browserDetails.version;
//         if(chromever >= 43) {
//             element.srcObject = stream;
//         } else if(typeof element.src !== 'undefined') {
//             element.src = URL.createObjectURL(stream);
//         } else {
//             console.error("Error attaching stream to element");
//         }
//     } else {
//         element.srcObject = stream;
//     }
// };
    init(room_id, audio_elm){
        this.room_id = room_id
        // this.client = new JANUS.Client(CONFIG.WEBSOCKETS_JANUS_URL, this.clientOptions);  // DISABLED
        console.warn('Janus audio bridge disabled - JANUS import commented out');
        return;
        // this.client = new JANUS.Client('wss://janus.conf.meetecho.com/ws', this.clientOptions);
        this.client.createConnection('id').then((connection)=> {
            console.log("JANUS connection", connection)
            this.connection = connection
            connection.createSession().then((session)=> {
                console.log("JANUS session", session)
                this.session = session
              session.attachPlugin('janus.plugin.audiobridge').then((plugin)=> {
                // session.attachPlugin('janus.plugin.cm.audioroom').then((plugin)=> {
                console.log("JANUS plugin", plugin)
                this.plugin = plugin;


                // var audio = document.getElementById('audio');
                // audio.addEventListener('playing', function() {
                //   // done();
                // });
 
                plugin.on('pc:track:remote', (event)=> {
                  console.log("JANUS pc:track:remote", event)
                  // this.attachMediaStream(audio_elm, event.track);
                  //  event.streams[0].addTrack(event.track);
                   audio_elm.srcObject = event.streams[0]
                  audio_elm.load();
                  this.media_status.next(true)
                  // audio_elm.play(); 
                });
                plugin.on('pc:track:local', function(event) {
                  console.log("JANUS pc:track:local", event)
                });
                plugin.on('message', (message)=> {
                  // message:JanusPluginMessage = {
                  //   _plainMessage:{
                  //     "janus": "event",
                  //     "session_id": 4726636056347590,
                  //     "transaction": "j796eek99k",
                  //     "sender": 8568740842787263,
                  //     "plugindata": {
                  //         "plugin": "janus.plugin.audiobridge",
                  //         "data": {
                  //             "audiobridge": "joined" || "event",
                  //             "room": 752034451059375,
                  //             "id": 6668253447814730,
                  //             "participants": [],
                  //         }
                  //       }
                  //   },
                  //   _plugin:{...}
                  // }
                    console.log("JANUS message ",message)
                    if(message._plainMessage && message._plainMessage.plugindata && message._plainMessage.plugindata.data){

                    }
                    if(message._plainMessage && message._plainMessage.janus && message._plainMessage.janus=='hangup'){
                      this.events.publish("chat-room-event", {message:'hangup'})
                    }
                });


                plugin.join(this.room_id)
                .then(function() {
                    return plugin.connect(room_id);
                })
                .then(function() {
                  return plugin.getUserMedia({audio: true, video: false});
                })
                .then(function(stream) {
                  return plugin.offerStream(stream, null, {muted: false});
                });
                ///////////////////////
        // plugin.create(room_id)
        // .then(function() {
        //   return plugin.connect(room_id);
        // })
        // .then(function() {
        //   return plugin.getUserMedia({audio: true, video: false});
        // })
        // .then(function(stream) {
        //   return plugin.offerStream(stream, null, {muted: false});
        // });
        ////////////////////////
               
              //   // this.room_id = Math.floor(100000 + Math.random() * 900000);
              //   // this.plugin.create(this.room_id, {admin_key:'secret'}).then((room)=>{
              //       // console.log("JANUS room", room)
              //       plugin.join(this.room_id)
              //       plugin.getUserMedia({audio: true, video: false})
              //       .then((stream)=> {
              //         console.log("JANUS getUserMedia ",stream)
              //         var peer_connection = plugin.createPeerConnection()
              //         console.log("JANUS ----createPeerConnection", peer_connection)
                      
              //         var audio = document.getElementById('audio');
              //         audio.addEventListener('playing', function() {
              //           console.log("JANUS PLAYING")

              //           //done();
              //         });
              //         stream.getTracks().forEach(function(track) {
              //           console.log("JANUS getTracks ",track)
              //           plugin.addTrack(track, stream);
              //         });
              //         // plugin.createOffer({tracks: [
              //       //     { type: 'audio', capture: true, recv: true },
              //       // ],}).then(res=>{
              //         plugin.createOffer().then(res=>{
              //           console.log("JANUS createOffer ",res)
              //           // plugin.send({}).then(function(response){
              //           //     console.log("JANUS send ",response)
              //           // });
              //           plugin.on('message', function(message) {
              //               console.log("JANUS message ",message)
              //           });
              //           plugin.on("remotetrack", function(message) {
              //             console.log("JANUS remotetrack ",message)
              //         });
              //       })
                    
              //       }).catch(res=>{console.error("JANUS getUserMedia err", res)})
                    
                    
              //       // plugin.detach();
              //   // })
              });
            });
          });
        // this.client = new Client(this.address, this.clientOptions, mediaDevices, webRTC);
        // this.client.createConnection('client')
        // .then(connection => connection.createSession())
        // .then(session => session.attachPlugin(AudioBridgePlugin.NAME))
        // .then(audioBridgePlugin => audioBridgePlugin.create(room_id)
        // .then(e=>audioBridgePlugin.join(room_id,{keepalive: true})))
        // // this.audioBridgePlugin.create(room_id,{})
    }
    close(room_id){
        // this.plugin?.destroy(room_id, {})
        this.plugin?.leave(room_id, {})
        this.session?.destroy()
        this.connection?.close()
        this.connection = this.session = this.plugin = null
    }

    // public onRoomJoined(f: (e: JanusMessage) => void) {
    //     this._onRoomJoined = f;
    //   }
    
    //   public onLocalVideo(f: (e: MediaStream) => void) {
    //     this._onLocalVideo = f;
    //   }
    
    // //   public onRemoteVideo(f: (e: RemoteVideo) => void) {
    // //     this._onRemoteVideo = f;
    // //   }
    
    //   public onUnpublished(f: (e: number) => void) {
    //     this._onUnpublished = f;
    //   }
    
    //   public onLeaving(f: (e: number) => void) {
    //     this._onLeaving = f;
    //   }
      
      // join = async (options:any={}) => {
      //   // options = Object.assign(options, { ptype: 'publisher' });
    
      //   // Attach video plugin.
      //   await this.attachPlugin();
    
      //   // Join room.
      //   const data: JanusPluginMessage = await this.plugin?.join(this.room_id, options);
      //   this.joinInfo = data.getPlainMessage().plugindata.data as JanusMessage;
      //   this._onRoomJoined(this.joinInfo);
      //   console.log("message", this.joinInfo)
      //   // Request local video.
      //   // await this.plugin?.processIncomeMessage(this.joinInfo);
      //   await this.processLocalVideo(this.joinInfo,this.mediaConstraints )

      // };
    
      // processLocalVideo(info: JanusMessage, constraints: MediaStreamConstraints) {
      //   this.joinInfo = info;
      //   console.log("message processLocalVideo",this.plugin)
      //   return this.plugin?.getUserMedia({
      //       audio: true,
      //       video: false,
      //     })
      //   // navigator.mediaDevices.getUserMedia({ audio : true, video : false })
      //     .then(stream => {
      //       this.plugin?.createPeerConnection({});
      //       stream.getTracks().forEach(track => this.plugin.addTrack(track, stream));
      //     })
      //     .then(() => this.plugin?.createOffer({}))
      //     .then((jsep) =>{
      //       var message = {body: {audio: true}, jsep: jsep};
      //       return this.plugin?.sendWithTransaction(message);
      //     })
      //     .then((response)=> {
      //       var jsep = response.get('jsep');
      //       if (jsep) {
      //           this.plugin?.setRemoteSDP(jsep);
      //         return jsep;
      //       }
      //     });
      //   //   .then(jsep => this.plugin.configure({ audio: true, video: false }, jsep))
      //   //   .then(resp => {
      //   //     const jsep = resp.get('jsep');
      //   //     if (jsep) {
      //   //       this.plugin?.setRemoteSDP(jsep);
      //   //       return jsep;
      //   //     }
      //   //   });
      // }
    //   unpublish = async () => {
    //     return this.plugin?.unpublish();
    //   };
    
      // private _onRoomJoined = (_: JanusMessage) => {};
    
      // private _onLocalVideo = (_: MediaStream) => {};
    
      
      // private _onUnpublished = (_: number) => {};
    
      // private _onLeaving = (_: number) => {};
    
      private createConnection = async () => {
        if (this.connection) return this.connection;
        this.connection = await this.client.createConnection('client');
        return this.connection;
      };
    
      private createSession = async () => {
        if (this.session) return this.session;
        await this.createConnection();
        this.session = await this.connection?.createSession();
        return this.session;
      };
    
      // private attachPlugin = async () => {
      //   await this.createSession();
      //   if (this.plugin) return this.plugin;
      //   this.plugin = await this.session?.attachPlugin('janus.plugin.audiobridge');
    

        
      //   // Event when user accepts permissions.
      //   // this.plugin?.on('consent-dialog:stop', (media: UserMediaResult) => {
      //   //   if (media.stream) this._onLocalVideo(media.stream);
      //   //   else console.log(media.error);
      //   // });
    
      //   // Event when remote stream is available.
      //   // this.plugin?.on('videoroom-remote-feed:received', (feed: RemoteVideo) => {
      //   //   this._onRemoteVideo(feed);
      //   // });
    
      //   // Event when remote feed unpublished.
      //   // this.plugin?.on('videoroom-remote-feed:unpublished', (feedId: number) => {
      //   //   this._onUnpublished(feedId);
      //   // });
    
      //   // Event when remote participant left the room.
      //   // this.plugin?.on('videoroom-remote-feed:leaving', (feedId: number) => {
      //   //   this._onLeaving(feedId);
      //   // });
    
      //   return this.plugin;
      // };
    
}


//////////////////////////////////////////////////////////////////////

 


/////////////////////////////////////////////////////////////////////////

// import { Injectable } from "@angular/core";
// // import { Headers, Http, URLSearchParams, RequestOptions } from "@angular/http";
// import { HttpClient } from "@angular/common/http";
// import { catchError } from 'rxjs/operators';

// // import { ToastController, AlertController, Toast } from "ionic-angular";
// import { ToastController, AlertController } from '@ionic/angular';
// import { Observable, throwError } from "rxjs";
// import { Events } from '../providers/events';
// import { AudioBridgePlugin, WebRTC, MediaDevices } from "janus-gateway-tsdx";
// import { Client } from 'janus-gateway-tsdx'
// // import { ConnectionOptions } from "janus-gateway-tsdx/dist/client/connection";
// // import { MediaDevices, WebRTC } from '../../plugin/base/shims/definitions';
// // import EchoTest from "./janus-plugin"
// import JanusPluginMessage from 'janus-gateway-tsdx/dist/client/misc/plugin-message';
// import Connection, { ConnectionOptions } from 'janus-gateway-tsdx/dist/client/connection';
// import { UserMediaResult } from 'janus-gateway-tsdx/dist/plugin/base/media-plugin';
// // import { JanusId, JoinInfo, JoinOptions, RemoteVideo } from 'janus-gateway-tsdx/dist/plugin/dto/video-room';
// // import Client from '../../client/client';
// import Session from 'janus-gateway-tsdx/dist/client/session';
// import JanusMessage from "janus-gateway-tsdx/dist/client/misc/message";
// // import VideoRoomPlugin from '../../plugin/video-room-plugin';
// // import { MediaDevices, WebRTC } from '../../plugin/base/shims/definitions';
// import { MediaDevicesShim, WebRTCShim } from 'janus-gateway-tsdx'
// //import {p as Promise} from 'bluebird';
// import { Promise as Promise2 } from 'bluebird';

// declare var CONFIG:any;
// const MEDIA_CONSTRAINTS = {
//     audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
//     video: false,
//   }
// @Injectable()
// export class AudioCallService {
    
//     clientOptions: ConnectionOptions = { keepalive: true }
//     // mediaDevices: MediaDevices 
//     // webRTC: WebRTC
//     private readonly address: string;

//   private client: Client;
//   private connection?: Connection;
//   private session?: Session;
//   private plugin?: AudioBridgePlugin;
//   mediaConstraints:MediaStreamConstraints

//   private joinInfo?: JanusMessage;
//   room_id;
//   toasts: any[] = [];
//   constructor(
//     // private http: HttpClient,
//     // private events: Events,
//     // private toastCtrl: ToastController,
//     // private alertCtrl: AlertController,
//     // mediaConstraints: MediaStreamConstraints,
//     // private audioBridgePlugin: AudioBridgePlugin,
//     // public translate: TranslateService
//     //  public mediaDevices: MediaDevices,
//     //  public webRTC: WebRTC
//   ) { 
//     // this.mediaConstraints = mediaConstraints
//     // this.mediaDevices = mediaDevices
//     // this.client = new Client(CONFIG.WEBSOCKETS_JANUS_URL, this.clientOptions, mediaDevices, webRTC);
        
//   }
//   media:any;
//     init(room_id){
//         this.room_id = room_id
//         this.media = new MediaDevicesShim()
//         console.log("janus this.media", this.media)
//         this.client = new Client(CONFIG.WEBSOCKETS_JANUS_URL, this.clientOptions,  this.media, new WebRTCShim());
        
//         // this.client = new Client(this.address, this.clientOptions, mediaDevices, webRTC);
//         // this.client.createConnection('client')
//         // .then(connection => connection.createSession())
//         // .then(session => session.attachPlugin(AudioBridgePlugin.NAME))
//         // .then(audioBridgePlugin => audioBridgePlugin.create(room_id)
//         // .then(e=>audioBridgePlugin.join(room_id,{keepalive: true})))
//         // // this.audioBridgePlugin.create(room_id,{})
//     }
//     close(room_id){
//         // this.plugin?.destroy(room_id, {})
//     }

//     public onRoomJoined(f: (e: JanusMessage) => void) {
//         this._onRoomJoined = f;
//       }
    
//       public onLocalVideo(f: (e: MediaStream) => void) {
//         this._onLocalVideo = f;
//       }
    
//     //   public onRemoteVideo(f: (e: RemoteVideo) => void) {
//     //     this._onRemoteVideo = f;
//     //   }
    
//       public onUnpublished(f: (e: number) => void) {
//         this._onUnpublished = f;
//       }
    
//       public onLeaving(f: (e: number) => void) {
//         this._onLeaving = f;
//       }
      
//       join = async (options:any={}) => {
//         // options = Object.assign(options, { ptype: 'publisher' });
    
//         // Attach video plugin.
//         await this.attachPlugin();
    
        
//         Promise2.try(() => this.plugin.getUserMedia({ audio: true, video: false }))
//         .then(stream => {
//           console.log("janus getUserMedia MEDIA", stream)
//           this.plugin.createPeerConnection();
//           stream.getTracks().forEach(track => this.plugin.addTrack(track, stream));
//         })
//         .then(() => this.plugin.createOffer({}))
//         .then(jsep => {
//           let message = { body: { audio: true }, jsep };
//           return this.plugin.sendWithTransaction(message);
//         })
//         .then(response => {
//           let jsep = response.get('jsep');
//           if (jsep) {
//             this.plugin.setRemoteSDP(jsep);
//             return jsep;
//           }
//         }).then(res=>{
         
//         })

//          // Join room.
//         const data: JanusPluginMessage = await this.plugin?.join(this.room_id, options);
//         this.joinInfo = data.getPlainMessage().plugindata.data as JanusMessage;
//         this._onRoomJoined(this.joinInfo);
//         console.log("message", this.joinInfo)
//         // Request local video.
//         // await this.plugin?.processIncomeMessage(this.joinInfo);
         
//         // await this.processLocalVideo(this.joinInfo,this.mediaConstraints )

        
//       };
    
//       processLocalVideo(info: JanusMessage, constraints: MediaStreamConstraints) {
//         this.joinInfo = info;
//         console.log("message processLocalVide---o",this.plugin)
//         return this.plugin?.getUserMedia({
//             audio: true,
//             video: false,
//           })
//         // navigator.mediaDevices.getUserMedia({ audio : true, video : false })
//           .then(stream => {
//             console.log("JANUS getUserMedia",stream)
//             this.plugin?.createPeerConnection({});
//             stream.getTracks().forEach(track => this.plugin.addTrack(track, stream));
//           })
//           .then(() => this.plugin?.createOffer({}))
//           .then((jsep) =>{
//             var message = {body: {audio: true}, jsep: jsep};
//             return this.plugin?.sendWithTransaction(message);
//           })
//           .then((response)=> {
//             var jsep = response.get('jsep');
//             if (jsep) {
//                 this.plugin?.setRemoteSDP(jsep);
//               return jsep;
//             }
//           })
//           .catch(err=>{console.error("JANUS getUserMedia error",err)})
//         //   .then(jsep => this.plugin.configure({ audio: true, video: false }, jsep))
//         //   .then(resp => {
//         //     const jsep = resp.get('jsep');
//         //     if (jsep) {
//         //       this.plugin?.setRemoteSDP(jsep);
//         //       return jsep;
//         //     }
//         //   });
//       }
//     //   unpublish = async () => {
//     //     return this.plugin?.unpublish();
//     //   };
    
//       private _onRoomJoined = (_: JanusMessage) => {};
    
//       private _onLocalVideo = (_: MediaStream) => {};
    
      
//       private _onUnpublished = (_: number) => {};
    
//       private _onLeaving = (_: number) => {};
    
//       private createConnection = async () => {
//         if (this.connection) return this.connection;
//         this.connection = await this.client.createConnection('client');
//         return this.connection;
//       };
    
//       private createSession = async () => {
//         if (this.session) return this.session;
//         await this.createConnection();
//         this.session = await this.connection?.createSession();
//         return this.session;
//       };
    
//       private attachPlugin = async () => {
//         await this.createSession();
//         if (this.plugin) return this.plugin;
//         this.plugin = await this.session?.attachPlugin(AudioBridgePlugin.NAME);
//         // .then(echoTestPlugin => {
//         //   this.plugin = echoTestPlugin
//         //   echoTestPlugin.audio(true)})
//         // Event when user accepts permissions.
//         this.plugin?.on('consent-dialog:stop', (media: UserMediaResult) => {
//           if (media.stream) this._onLocalVideo(media.stream);
//           else console.log(media.error);
//         });
    
//         // Event when remote stream is available.
//         // this.plugin?.on('videoroom-remote-feed:received', (feed: RemoteVideo) => {
//         //   this._onRemoteVideo(feed);
//         // });
    
//         // Event when remote feed unpublished.
//         this.plugin?.on('videoroom-remote-feed:unpublished', (feedId: number) => {
//           this._onUnpublished(feedId);
//         });
//         this.plugin.on('pc:track:remote', (feedId) => {
//           console.log("pc:track:remote", feedId)
//         });
//         this.plugin.on('pc:track:local', (feedId) => {
//           console.log("pc:track:local", feedId)
//         });
//         // Event when remote participant left the room.
//         // this.plugin?.on('videoroom-remote-feed:leaving', (feedId: number) => {
//         //   this._onLeaving(feedId);
//         // });
    
//         // return this.plugin;
    
// }
// }
