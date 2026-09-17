import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConferenceData } from '../../core/providers/conference-data';
import { ActionSheetController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Browser } from '@capacitor/browser';
import { MediaDevicesShim, VideoRoomBuilder, WebRTCShim } from 'janus-gateway-tsdx'

@Component({
  selector: 'page-contact-detail',
  templateUrl: 'contact-detail.html',
  styleUrls: ['./contact-detail.scss'],
  standalone: false
})
export class ContactDetailPage {
  contact: any;
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
    private translate: TranslateService
  ) {
    // this.room = new VideoRoomBuilder('ws://homer.voipappz.io:8188', this.MEDIA_CONSTRAINTS, new MediaDevicesShim(), new WebRTCShim())
    //     .onLocalVideo(stream => console.log('Local video:', stream))
    //     .onRemoteVideo(event => console.log('Remote video:', event))
    //     .onUnpublished((feeId) => console.log('Unpublished:', feeId))
    //     .onLeaving((feeId) => console.log('Unpublished:', feeId));

    //     this.room.join(this.room, this.route.snapshot.paramMap.get('contactId'))
    //     .then(room => console.log(room))
  }
  ionViewWillEnter() {
    this.dataProvider.load().subscribe((data: any) => {
      const contactId = this.route.snapshot.paramMap.get('contactId');
      if (data && data.contacts) {
        for (const contact of data.contacts) {
          if (contact && contact.id === contactId) {
            this.contact = contact;
            break;
          }
        }
      }
    });
  }

  async openExternalUrl(url: string) {
    await Browser.open({ url });
  }

  async openContactShare(contact: any) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: this.translate.instant('CONTACTS.SHARE_HEADER', { name: contact.name }),
      buttons: [
        {
          text: this.translate.instant('CONTACTS.COPY_LINK'),
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
          text: this.translate.instant('CONTACTS.SHARE_VIA')
        },
        {
          text: this.translate.instant('BUTTONS.CANCEL'),
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async openContact(contact: any) {
    const mode = 'ios'; // this.config.get('mode');

    const actionSheet = await this.actionSheetCtrl.create({
      header: this.translate.instant('CONTACTS.CONTACT_HEADER', { name: contact.name }),
      buttons: [
        {
          text: this.translate.instant('CONTACTS.EMAIL_ACTION', { email: contact.email }),
          icon: mode !== 'ios' ? 'mail' : null,
          handler: () => {
            window.open('mailto:' + contact.email);
          }
        },
        {
          text: this.translate.instant('CONTACTS.CALL_ACTION', { phone: contact.phone }),
          icon: mode !== 'ios' ? 'call' : null,
          handler: () => {
            window.open('tel:' + contact.phone);
          }
        },
        {
          text: this.translate.instant('BUTTONS.CANCEL'),
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }
}
