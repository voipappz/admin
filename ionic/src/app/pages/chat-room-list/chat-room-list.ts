import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConferenceData } from '../../core/providers/conference-data';
import { ActionSheetController } from '@ionic/angular';
import { Browser } from '@capacitor/browser';
// import { MediaDevicesShim, VideoRoomBuilder, WebRTCShim } from 'janus-gateway-tsdx'

@Component({
  selector: 'page-chat-room-list',
  templateUrl: 'chat-room-list.html',
  styleUrls: ['./chat-room-list.scss'],
})
export class ChatRoomListPage {
  rooms: any[] = [{room:3074349039659591, description:"test-3074349039659591"}];
  room:any;
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
  constructor(
    private dataProvider: ConferenceData,
    private route: ActivatedRoute,
    public actionSheetCtrl: ActionSheetController,
    public confData: ConferenceData,
  ) {
    // this.room = new VideoRoomBuilder('ws://homer.voipappz.io:8188', this.MEDIA_CONSTRAINTS, new MediaDevicesShim(), new WebRTCShim())
    //     .onLocalVideo(stream => console.log('Local video:', stream))
    //     .onRemoteVideo(event => console.log('Remote video:', event))
    //     .onUnpublished((feeId) => console.log('Unpublished:', feeId))
    //     .onLeaving((feeId) => console.log('Unpublished:', feeId));

    //     this.room.join(this.room, this.route.snapshot.paramMap.get('roomId'))
    //     .then(room => console.log(room))
  }
  ionViewWillEnter() {
    this.confData.list().toPromise().then((res)=>{
      this.rooms=<any[]>res
    })
    // this.dataProvider.load().subscribe((data: any) => {
    //   const roomId = this.route.snapshot.paramMap.get('roomId');
    //   if (data && data.rooms) {
    //     for (const room of data.rooms) {
    //       if (room && room.id === roomId) {
    //         this.room = room;
    //         break;
    //       }
    //     }
    //   }
    // });
  }
  createRoom(){
    this.confData.createRoom().toPromise().then((res)=>{
      this.rooms.unshift(res)
    })
  }
  async openExternalUrl(url: string) {
    await Browser.open({ url });
  }

  async openRoomShare(room: any) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Share ' + room.name,
      buttons: [
        {
          text: 'Copy Link',
          handler: () => {
            console.log(
              'Copy link clicked on https://twitter.com/' + room.twitter
            );
            if (
              (window as any).cordova &&
              (window as any).cordova.plugins.clipboard
            ) {
              (window as any).cordova.plugins.clipboard.copy(
                'https://twitter.com/' + room.twitter
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

  async openContact(room: any) {
    const mode = 'ios'; // this.config.get('mode');

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Contact ' + room.name,
      buttons: [
        {
          text: `Email ( ${room.email} )`,
          icon: mode !== 'ios' ? 'mail' : null,
          handler: () => {
            window.open('mailto:' + room.email);
          }
        },
        {
          text: `Call ( ${room.phone} )`,
          icon: mode !== 'ios' ? 'call' : null,
          handler: () => {
            window.open('tel:' + room.phone);
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
