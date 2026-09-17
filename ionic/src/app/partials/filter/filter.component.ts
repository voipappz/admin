import { Component, Input } from '@angular/core';
import { ConferenceData } from '../../core/providers/conference-data';
import { Router } from '@angular/router';
import { UserData } from '../../core/providers/user-data';
import { Events } from '../../core/providers/events';


import { ModalController, PopoverController } from '@ionic/angular';

@Component({
    selector: 'filter',
    templateUrl: 'filter.component.html',
    styleUrls: ['./filter.component.scss'],
    standalone: false
})
export class FilterComponent {
  filters:any ={};
  callTypes=["all","missed","rejected","outgoing","incoming"]
  constructor(private modalCtrl: ModalController,private events: Events, private userData:UserData, public router: Router) {}

  

  ionViewWillEnter() {
    this.filters.type='all'
  }
  typeChanged(event){
    console.log("typechanged",event, this.filters.type)
    // this.filters.type=event.detail.value;
  }
  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }
  handleChange(event) {
    this.filters.inline = event.target.value.toLowerCase();
  }
  confirm() {
    this.modalCtrl.dismiss(this.filters, 'filter');
  }
}
