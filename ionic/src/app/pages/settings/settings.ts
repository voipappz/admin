import { Component, Input, ViewChild } from '@angular/core';
import { TranslationService } from '../../core/_base/layout/services/translation.service';
import { Router } from '@angular/router';
import { UserData } from '../../core/providers/user-data';
import { Events } from '../../core/providers/events';


import { IonModal, ModalController, NavController, PopoverController } from '@ionic/angular';
import { OverlayEventDetail } from '@ionic/core/components';
import { TimeConditionPage } from '../time-condition-page/time-condition-page';

@Component({
    selector: 'settings',
    templateUrl: 'settings.html',
    styleUrls: ['./settings.scss'],
    standalone: false
})
export class SettingsPage {
  src:string='assets/img/logo.png';
  user:any={language:''}
  serverUrl:string = localStorage.getItem('connectix-server') || ''
  detailIcon
  constructor(private translateSvc:TranslationService, public popoverController: PopoverController,private modalCtrl: ModalController,
    private events: Events, private userData:UserData, public router: Router,private navCtrl:NavController) {
      this.detailIcon = document.dir === 'rtl' ? 'ios-arrow-back' : 'ios-arrow-forward';
  }

  ngOnInit(){
    this.user = this.userData.getUserData()
    this.user.language = this.userData.getUserLanguage()
  }
  getData(event){
    this.user = this.userData.getUserData()
    this.user.language = this.userData.getUserLanguage()
  }
  languageChanged(event){
    this.user.language = event.detail.value
    this.userData.setUserData(event.detail.value,'language')
    this.translateSvc.setLanguage(event.detail.value)
  }
  // The connectix server override (see assets/config/main.js resolution
  // order). Blank clears it back to same-origin/dev; applies on next load.
  serverChanged(event){
    const url = (event.detail.value || '').trim().replace(/\/$/, '')
    this.serverUrl = url
    if (url) {
      localStorage.setItem('connectix-server', url)
    } else {
      localStorage.removeItem('connectix-server')
    }
  }
  ionViewWillEnter() {
    
  }
  async goTo(target){
    const modal = await this.modalCtrl.create({
      component: TimeConditionPage,
    });
    modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'save') {
      console.log("save",data, role)
    }
  
  }
  logout(){
    this.events.publish("app-logout")
  }

  onWillDismiss(event: Event) {
    // const ev = event as CustomEvent<OverlayEventDetail<string>>;
    // if (ev.detail.role === 'confirm') {
    //   this.user = `Hello, ${ev.detail.data}!`;
    // }
  }
  
}
