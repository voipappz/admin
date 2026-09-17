import { Component, Input } from '@angular/core';
import { ConferenceData } from '../../core/providers/conference-data';
import { Router } from '@angular/router';
import { UserData } from '../../core/providers/user-data';
import { Events } from '../../core/providers/events';


import { PopoverController } from '@ionic/angular';

@Component({
    selector: 'date-time-picker-popover',
    templateUrl: 'date-time-picker-popover.component.html',
    styleUrls: ['./date-time-picker-popover.component.scss'],
    standalone: false
})
export class DateTimePickerPopoverComponent {
  dialInput:any ="";
  @Input() data:{time:Date} = {time:new Date()}
  @Input('min_date') min_date: any = undefined;
  init_data:{time:Date} = {time:new Date()}
  constructor(public popoverController: PopoverController,private events: Events, private userData:UserData, public confData: ConferenceData, public router: Router,) {}

  
  
  timeChanged($event){
    console.log("timeChanged",$event,
    new Date($event.detail.value).getHours(), new Date($event.detail.value).getMinutes())
    this.data.time = $event.detail.value
  }
  // applyFilters() {
  //   // Pass back a new array of track names to exclude
    
  //   this.dismiss(this.data);
  // }
  setTime(){
    this.dismiss(this.data,'save');
    this.popoverController.dismiss({data:this.data,role:'save'},'save');
  }
  dismiss(data=this.init_data,role?:string) {
    // using the injected ModalController this page
    // can "dismiss" itself and pass back data
    this.popoverController.dismiss(data,role);
  }
  ionViewWillEnter() {
    this.init_data = {time:this.data.time}
  }
  ionViewWillLeave() {
    console.log("ionViewWillLeave---", this.data, this.init_data)
    // this.dismiss();
  }
  ngOnDestroy() {
    
  }
}
