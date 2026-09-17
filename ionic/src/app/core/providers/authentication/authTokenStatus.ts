
import {Injectable} from '@angular/core';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from 'rxjs/internal/Observable';
import { timeout, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
//import { CONFIG } from '../config';

import { JwtHelperService } from "@auth0/angular-jwt";
import { LoginPage } from '../../../pages/login/login';
import {UserData} from '../user-data';
// import { StorageService } from "../storage-service";
import {HandleRequest} from '../../_base/layout/services/handleRequest.service';//'../handleRequest';
import { AuthService } from '../simple-auth.service';
import { environment } from '../../../../environments/environment';
import { NavController } from '@ionic/angular';
//import { Page1 } from '../pages/page1/page1'; //TODO

declare var CONFIG:any;
@Injectable()
export class AuthTokenStatus {
  jwtHelper: JwtHelperService = new JwtHelperService();
  auth_status:boolean;
  constructor(private auth: AuthService,private http: HttpClient, private sharedData:UserData,private navCtrl:NavController, private handleRequest:HandleRequest/*,private storage: StorageService,*/) {
  }

  tokenStatus(gotoPage:any =""){
    console.warn("this.auth_status", this.auth_status)
    return this.auth_status;
  }
  logout(){
    this.auth_status = false;
  }
  load(){
    let url=window.location.href;
    console.log("url",url)
     
    console.log("AuthTokenStatus load", localStorage.getItem('voipboxIonAppToken'))
    var jwt = this.auth.getToken()//localStorage.getItem(environment.authTokenKey);
    // var authHeader = new Headers();
    // let content = new URLSearchParams();
    // if(jwt) {
    //   authHeader.append('Content-Type', 'application/x-www-form-urlencoded');
    //   content.set('token', jwt);
    // }
    return new Promise((resolve, reject) => {
      // console.log("tttttttttttttttttt1111", window.location)
      this.loadCustomerData().then(e=>{
        if(window.location.href.indexOf("/login")>-1) {
          // console.log("tttttttttttttttttt222222", window.location)
          resolve(true);
        }else{
          
          jwt = this.auth.getToken()
          // console.log("ttttttttttttttttt333333", window.location,jwt)
          this.handleRequest.post('/auth/user_token_status?token='+jwt,
                        {token:jwt})
          .pipe(
            timeout(10000), // 10 second timeout to prevent app from hanging if request is blocked
            catchError(err => {
              console.error('Token status request failed or timed out:', err);
              return throwError(() => err);
            })
          )
          .subscribe(res => {
                      // console.log("tttttt load--------------success-token status");
                      if(res.user){
                        let user = this.jwtHelper.decodeToken(res.user)
                        this.sharedData.setUserData(user);
                        // console.log("load--------------success-token status", res, user);
                        this.auth_status=true;
                      }else{
                        this.auth_status = false;
                      }
                      resolve(true);
                      this.auth_status = true;
                      resolve(true);
                    },
                    err => {
                      // //console.log("load-----------------error-token status", err);
                      // //this.navCtrl.setRoot(LoginPage)
                      this.auth_status = false;

                      // console.log("tttttttttttttttttt", window.location)
                      if(window.location.href.indexOf("/login")==-1) {
                        // window.location.href = 'https://acvideo.voipappz.io/api/error';//TODO
                        this.navCtrl.navigateRoot('/login')//.setRoot(LoginPage)
                      }
                      resolve(true);
                    }
                  );
        }
      })
    });
    

  }
  private loadCustomerData(){
    return new Promise(resolve=>{
      let storage_data;
      storage_data = JSON.parse(localStorage.getItem(environment.customerDataKey))
      console.log("-----------------loadCustomerData")
       if(!storage_data || !storage_data.url || window.location.href.indexOf("/login")>-1){//TODO add condition to validate data
         this.handleRequest.getCustomerDataFromServer().pipe(
           timeout(10000), // 10 second timeout to prevent app from hanging if request is blocked
           catchError(err => {
             console.error('Customer data request failed or timed out:', err);
             return throwError(() => err);
           })
         ).subscribe(res=>{
         
          // res = {
          //   "name": "hipocti",
          //   "logo_url": "https://900.nimbusip.com/assets/va/hipoti.png",
          //   "logo_icon": "https://900.nimbusip.com/assets/va/hipoti.png",
          //   "logo_title": "Hipocti",
          //   "logo_color": "#00b3b3"
          // }
          //  console.log("-------------------loadCustomerData", res);
           if(res.language && !localStorage.getItem('language'))this.sharedData.setUserData(res.language,'language')

           res.url = (res.logo_url)? res.logo_url : "https://admin-staging.voipappz.io/assets/admin/layout4/img/VA_logo_white.png"
           res.url_login = (res.logo_url)? res.logo_url : "assets/img/VA_logo_white.png"
           localStorage.setItem('voipboxAppCustomerData', JSON.stringify(res));
             this.sharedData.setCustomerData(res)
             resolve(true)
           },err=>{
             //TODO use default data?
             console.error("ERR-------------------loadCustomerData",err);
             let d:any = {}
             d.url =  "https://admin-staging.voipappz.io/assets/admin/layout4/img/VA_logo_white.png"
             d.url_login = "assets/img/VA_logo_white.png"
             this.sharedData.setCustomerData(d)
             resolve(true)
         })
       }else{
         this.sharedData.setCustomerData(storage_data)
         resolve(true)
       }
      //  console.log("loadCustomerData", storage_data);
     


    })
    
  }
  // private loadCustomerData(){
  //   let storage_data;
     
  //   //  .then(data => {
  //      storage_data = localStorage.getItem("voipboxAppCustomerData")
  //      if(!storage_data || !storage_data.url){//TODO add condition to validate data
  //        this.handleRequest.getCustomerData()
  //        .map(res => res.json())
  //        .subscribe(res=> {
  //          console.log("-------------------loadCustomerData", res);
  //          res.url = (res.url)? res.url : "https://admin-staging.voipappz.io/assets/admin/layout4/img/VA_logo_white.png"
  //          res.url_login = (res.url_login)? res.url_login : "assets/img/VA_logo_white.png"
  //          localStorage.setData('voipboxAppCustomerData', res);
  //            this.sharedData.setCustomerData(res)
  //          },
  //          (err)=>{
  //            //TODO use default data?
  //            console.error("ERR-------------------loadCustomerData", err);
  //            let d:any = {}
  //            d.url =  "https://admin-staging.voipappz.io/assets/admin/layout4/img/VA_logo_white.png"
  //            d.url_login = "assets/img/VA_logo_white.png"
  //            this.sharedData.setCustomerData(d)
  //        })
  //      }else{
  //        this.sharedData.setCustomerData(storage_data)
  //      }
  //      console.log("loadCustomerData", storage_data);
  //   //  })
  //   //  .catch(error => {
  //   //    console.error(error);
  //   //  });


  // }
  private loadUserData(token){
    //   console.log(
    //   this.jwtHelper.decodeToken(token),
    //   this.jwtHelper.getTokenExpirationDate(token),
    //   this.jwtHelper.isTokenExpired(token)
    // );
    var authHeader = new HttpHeaders();
    authHeader.append('Authorization', 'Basic ' + token);
    authHeader.append('X-VA-Auth', "user")
    let dataUrl = {headers: authHeader}
    return this.http.get(CONFIG.API_ENDPOINT + '/api/users/'+this.jwtHelper.decodeToken(token).user_uuid, dataUrl)
  }

}
