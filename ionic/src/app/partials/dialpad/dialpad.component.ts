import { Component, Input } from '@angular/core';
import { ConferenceData } from '../../core/providers/conference-data';
import { Router } from '@angular/router';
import { UserData } from '../../core/providers/user-data';
import { Events } from '../../core/providers/events';


import { PopoverController } from '@ionic/angular';

@Component({
    selector: 'dialpad',
    templateUrl: 'dialpad.component.html',
    styleUrls: ['./dialpad.component.scss'],
    standalone: false
})
export class DialpadComponent {
  dialInput:any ="";
  @Input() permissions:{allow_dialer:boolean,allow_audio:boolean,allow_video:boolean} = {
    allow_audio: true,
    allow_dialer: true,
    allow_video: false,
  }
  constructor(public popoverController: PopoverController,private events: Events, private userData:UserData, public confData: ConferenceData, public router: Router,) {}

  

  ionViewDidEnter() {

  }
  clear(){
    console.log("clear", this.dialInput)
    this.dialInput=this.dialInput.slice(0, -1);
  }
  digitClick(digit:string){
    this.dialInput = this.dialInput+digit;
  }
  call(call_type){
    // console.log("call", call_type, contact)
    this.popoverController.dismiss(this.dialInput,call_type)
  }
}
