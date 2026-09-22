import { Component, Input, ViewChild } from '@angular/core';
import { TranslationService } from '../../core/_base/layout/services/translation.service';
import { Event, Router } from '@angular/router';
import { UserData } from '../../core/providers/user-data';
import { Events } from '../../core/providers/events';


import { IonModal, ModalController, PopoverController } from '@ionic/angular';
import { LocationsPage } from '../../pages/locations-page/locations-page';

@Component({
    selector: 'va-settings',
    templateUrl: 'settings.component.html',
    styleUrls: ['./settings.component.scss'],
    standalone: false
})
export class SettingsComponent {
  @Input('page')page:string=''
  @ViewChild ('popover') popover;
  isOpen:boolean = false;
  src:string='assets/img/logo.png';
  user:any={language:''}
  @ViewChild(IonModal) modal: IonModal;
  constructor(private modalCtrl: ModalController,private translateSvc:TranslationService, public popoverController: PopoverController,private events: Events, private userData:UserData, public router: Router,) {
    
  }

  ngOnInit(){
    this.user = this.userData.getUserData()
    this.user.language = this.userData.getUserLanguage()
    console.log("ngOnInit settings",this.user.language, this.user)
  }
  presentPopover(e:Event){
    this.popover.event = e;
    this.isOpen = true;
  }
  getData(event){
    this.user = this.userData.getUserData()
    this.user.language = this.userData.getUserLanguage()
  }
  languageChanged(event){
    this.userData.setUserData(event.detail.value,'language')
    this.translateSvc.setLanguage(event.detail.value)
    this.user.language = event.detail.value;
  }
  ionViewWillEnter() {
    
  }
  popoverDidDismiss(e, data){
    if(data.role=='language'){
      this.languageChanged({detail:{value:data.data}})
    }else if(data.role=='logout'){
      this.logout()
    }else if(data.role=='locations'){
      this.openLocations()
    }

  }
  async openLocations(){
    const modal = await this.modalCtrl.create({
      component: LocationsPage,
      componentProps: {
        
      },
    });
    modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'save') {
      console.log("save",data, role)
      
    }
  }
  cancel() {
    this.modal.dismiss(null, 'cancel');
  }
  logout(){
    this.events.publish("app-logout")
  }
  confirm() {
    this.modal.dismiss(this.user, 'confirm');
  }

  onWillDismiss(event: Event) {
    // const ev = event as CustomEvent<OverlayEventDetail<string>>;
    // if (ev.detail.role === 'confirm') {
    //   this.user = `Hello, ${ev.detail.data}!`;
    // }
  }
  
}
