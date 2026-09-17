import { Component, Input } from '@angular/core';
import { ConferenceData } from '../../core/providers/conference-data';
import { Router } from '@angular/router';
import { UserData } from '../../core/providers/user-data';
import { Events } from '../../core/providers/events';


import { PopoverController } from '@ionic/angular';

@Component({
    selector: 'va-logo',
    templateUrl: 'logo.component.html',
    styleUrls: ['./logo.component.scss'],
    standalone: false
})
export class LogoComponent {
  src:string='assets/img/logo.png';
  customer_data;
  constructor(public popoverController: PopoverController,private events: Events, private userData:UserData, public router: Router,) {}

  ngOnInit(){
    this.customer_data = this.userData.getCustomerData()
    // if(this.customer_data && this.customer_data.logo_url) this.src = this.customer_data.logo_url;
    this.src = 'assets/img/VA_logo_white_sm.png'
  }

  ionViewWillEnter() {
    
  }
  
}
