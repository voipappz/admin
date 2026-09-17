import { Component } from '@angular/core';
import { ConferenceData } from '../../core/providers/conference-data';
import { Router } from '@angular/router';
import { UserData } from '../../core/providers/user-data';
import { Events } from '../../core/providers/events';
import { DialpadComponent } from '../../partials/dialpad/dialpad.component'; 

import { PopoverController } from '@ionic/angular';

@Component({
    selector: 'page-contact-list',
    templateUrl: 'contact-list.html',
    styleUrls: ['./contact-list.scss'],
    standalone: false
})
export class ContactListPage {
  contacts: any[] = [];//[{name: "user1", number: "1123412341"}];
  permissions:any= {
    allow_audio: true,
    allow_dialer: false,
    allow_video: false,
  }
  data:any ={username:"", credit:null};
  constructor(public popoverController: PopoverController,private events: Events, private userData:UserData, public confData: ConferenceData, public router: Router,) {}

  async presentPopover(e: Event) {
    const popover = await this.popoverController.create({
      component: DialpadComponent,
      componentProps: {permissions: this.permissions},
      event: e,
    });

    await popover.present();

    await popover.onDidDismiss().then(data=>{
      console.log("DATAAAAAAAAAA", data)
      if(data && data.data && data.data.length>4){
        if(data.role=='voice' || data.role=='video'){
          this.call(data.role, {number:data.data})
        }
      }
    });
  }

  ionViewDidEnter() {
    this.confData.getContacts().subscribe((res: any) => {
      this.contacts = res.contact_list;
      this.permissions = {
        allow_audio: res.allow_audio,//(res.allow_audio=='true' || res.allow_audio==true)?true:false,
        allow_dialer: res.allow_dialer,//==true(res.allow_dialer=='true' || res.allow_dialer==true)?true:false,
        allow_video: res.allow_video//(res.allow_video=='true' || res.allow_video==true)?true:false,
      }

      this.data.username = this.userData.getUsername();
      this.data.credit = res.credit;
    });
    

  }
  logout(){
    this.events.publish("app-logout")
  }
  call(call_type:string,contact){
    console.log("call", call_type, contact)
    this.confData.call(call_type, contact).subscribe(
      (res:any) => {
        if(res.plugindata && res.plugindata.data && res.plugindata.data.room){
          this.router.navigateByUrl('/room/'+res.plugindata.data.room+"/"+call_type);
        }else{
          throw new Error("Invalid call status ...")
        }
        
      },
      err => {
        // loading.dismiss();
        console.log("error login")
        throw new Error(err)
      }
    );
  }
}
