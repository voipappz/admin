
import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
// Import directly from the service file, NOT the ../_base/layout barrel — the
// barrel re-exports dozens of services (some of which import UserData), forming
// a circular dependency that crashes the test bundle with
// "Cannot access 'UserData' before initialization".
import { HandleRequest } from '../_base/layout/services/handleRequest.service';
import { Helper } from '../_base/layout/config';
import { TranslationService } from '../_base/layout/services/translation.service';
import { Events } from './events';
import { AclService } from './acl.service';


@Injectable({
  providedIn: 'root'
})
export class UserData {
  favorites: string[] = [];
  HAS_LOGGED_IN = 'username'//'hasLoggedIn';
  HAS_SEEN_TUTORIAL = 'hasSeenTutorial';
  private username;
  language: string = '';
  customer_data;
  private user:any={profile:{}}
  constructor(
    public storage: Storage,
    private translateSvc:TranslationService,
    private events:Events,
    private handleRequest:HandleRequest,
    private aclSvc:AclService
  ) { }

  hasFavorite(sessionName: string): boolean {
    return (this.favorites.indexOf(sessionName) > -1);
  }

  addFavorite(sessionName: string): void {
    this.favorites.push(sessionName);
  }

  removeFavorite(sessionName: string): void {
    const index = this.favorites.indexOf(sessionName);
    if (index > -1) {
      this.favorites.splice(index, 1);
    }
  }

  // login(username: string): Promise<any> {
  //   return this.storage.set(this.HAS_LOGGED_IN, true).then(() => {
  //     this.setUsername(username);
  //     return window.dispatchEvent(new CustomEvent('user:login'));
  //   });
  // }

  // signup(username: string): Promise<any> {
  //   return this.storage.set(this.HAS_LOGGED_IN, true).then(() => {
  //     this.setUsername(username);
  //     return window.dispatchEvent(new CustomEvent('user:signup'));
  //   });
  // }

  // logout(): Promise<any> {
  //   return this.storage.remove(this.HAS_LOGGED_IN).then(() => {
  //     return this.storage.remove('username');
  //   }).then(() => {
  //     window.dispatchEvent(new CustomEvent('user:logout'));
  //   });
  // }
  saveUserData(user, field=null){
    if(!field){
      this.handleRequest.patch('/api/users/'+this.user.uuid, user).subscribe(res=>{
        this.setUserData(res)
      })
    }else{
      let data:any={}
      data[field] = user[field]
      this.handleRequest.patch('/api/users/'+this.user.uuid, data).subscribe(res=>{
        this.setUserData(res)
        if(field=='resources'){
          this.events.publish('user:reload-resources')
        }
      },(err=>{
        this.events.publish('user:reload',{user:this.user});
      }))
    }
    
  }
  updateUserResource(action, type, type_uuid){
    if(action=='default_identity'){
      this.handleRequest.patch('/api/users/'+this.user.uuid,{meta:{default_identity:type_uuid}}).subscribe(res=>{
        this.setUserData(res)
      })
    }else{
      this.handleRequest.patch('/api/users/'+this.user.uuid+'?action='+action+"&type="+type+"&type_uuid="+type_uuid,{}).subscribe(res=>{
        this.setUserData(res)
      })
    }
    
  }
  updateUserLocation(action,location){
    this.handleRequest.patch('/api/users/'+this.user.uuid+'?action='+action,location).subscribe(res=>{
      this.setUserData(res)
    })
  }
  setUserData(data, _field=""){
    if(_field != "" && _field != "language"){
      this.user[_field] = data;
    }else if (_field == "language"){
      this.user.profile.language = data;
      this.language = data;
      //this.events.publish('reloadLanguage',this.language);
      console.warn("ShareUserDataService setAcl:false",this.user.acl)
      this.translateSvc.setLanguage(this.language)
      this.events.publish('user:reload',{user:this.user, setAcl:false});
    }else{
      this.user = data;
      if(this.user.extension){
        this.user.extension.environment = this.user.environment
      }
      this.language = (this.user.profile && this.user.profile.language)? this.user.profile.language : 'he';
      //this.events.publish('reloadLanguage',this.language);
      this.aclSvc.setAbilities(this.user?.acl?.data)
      this.events.publish('user:reload',{user:this.user, setAcl:true});

    }

    //console.log("setUserData", this.user, this.language )
  }
  getUserData(field=""){
    console.log("getUserData", field, this.user )
    if( Helper.equals(this.user, {})) {
      //this.authStatus.tokenStatus();
    }
    
    if(field!=""){
      return this.user[field]
    }else{
      return this.user;
    }
  }
  setUsername(username: string){//: Promise<any> {
    // return this.storage.set('username', username);
    this.username = username;
    console.warn("TODO setUserInfo ")
    // localStorage.setItem('voipboxIonAppUsername', username);//TODO remove localStorage.setItem voipboxIonAppUsername
    this.events.publish("user-update")
  }

  getUsername(): any{//Promise<string> {
    // return this.storage.get('username').then((value) => {
    //   return value;
    // });
    return this.username;
  }
  setUserInfo(user: any){//: Promise<any> {
    // return this.storage.set('username', username);
    this.user = user
    console.warn("TODO setUserInfo ")
    // localStorage.setItem('voipboxIonAppPassword', user.password);//TODO remove localStorage.setItem voipboxIonAppPassword
    // localStorage.setItem('voipboxIonAppInfo', JSON.stringify(user));
    this.events.publish("user-update")
  }
  getUserInfo(field: string){//: Promise<any> {
    // return this.storage.set('username', username);
    return this.user[field]
  }
  getUserCredit(){
    // return this.secondsToHms(this.user["credit"]);
    return this.user["credit"];

  }
  getUserLanguage(){
    if (!this.language) {
      this.language = this.translateSvc.getSelectedLanguage() || 'he';
    }
    return this.language;
  }
  private secondsToHms(d) {
    d = Number(d);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    var hDisplay = ((h==0)? "0":"") + h + ":";
    var mDisplay = ((m==0)? "0":"") + m + ":";
    var sDisplay = ((s==0)? "0":"") + s ;
    return hDisplay + mDisplay + sDisplay; 
}
  isLoggedIn(): Promise<boolean> {
    return this.storage.get(this.HAS_LOGGED_IN).then((value) => {
      return value === true;
    });
  }

  checkHasSeenTutorial(): Promise<string> {
    return this.storage.get(this.HAS_SEEN_TUTORIAL).then((value) => {
      return value;
    });
  }
  setCustomerData(data){
    console.log("setCustomerData",data, this.customer_data )
    this.customer_data = data;
    console.log("setCustomerData",data, this.customer_data )
  }
  getCustomerData(){
    console.log("getCustomerData", this.customer_data )
    return this.customer_data;


  }

  /**
   * Clear all user data (call on logout)
   */
  clearUserData() {
    this.user = { profile: {} };
    this.username = '';
    this.language = '';
    this.events.publish('user:logout');
  }
}
