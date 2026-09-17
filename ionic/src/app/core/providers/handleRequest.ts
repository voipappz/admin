

import { Injectable } from "@angular/core";
// import { Headers, Http, URLSearchParams, RequestOptions } from "@angular/http";
import { HttpClient } from "@angular/common/http";
import { catchError } from 'rxjs/operators';

// import { ToastController, AlertController, Toast } from "ionic-angular";
import { ToastController, AlertController } from '@ionic/angular';
import { Observable, throwError } from "rxjs";
import { Events } from './events';
// import { ITEMS_PER_PAGE } from '../config';
// import { TranslateService } from '@ngx-translate/core';

declare var CONFIG:any;
@Injectable()
export class HandleRequest2 {
  toasts: any[] = [];
  constructor(
    private http: HttpClient,
    private events: Events,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    // public translate: TranslateService
  ) { }

  /*********************
  *
  *     CRUD
  *
  *********************/
  // getUrl(){
  //   return CONFIG.API_ENDPOINT
  // }
  getAuthHeader(){
    if(window.location.href.indexOf('app/room/')>-1){
      return {
        Authorization:  window.location.href.slice(window.location.href.lastIndexOf("/")+1)
      }
    }else{
      return {
        Authorization:  localStorage.getItem("voipboxIonAppToken")
      }
    }
  }
  get(url:string){
    return this.http.get(CONFIG.API_ENDPOINT+url, {headers:this.getAuthHeader()})
    .pipe(
      catchError((error) => {
        this.handleErrors(error._body, error.status);
        return throwError(error.message || 'server Error');
      }))
  }
  post(url:string, params){
    return this.http.post(CONFIG.API_ENDPOINT+url,params ,{headers:this.getAuthHeader()})
    .pipe(
      catchError((error) => {
        this.handleErrors(error._body, error.status);
        return throwError(error.message || 'server Error');
      }))
  }
  wsStatus():Promise<any> {
    return new Promise((resolve,reject)=>{
      //let ws = new WebSocket(CONFIG.WEBSOCKETS_URL);
      let ws = new WebSocket(CONFIG.WEBSOCKETS_URL + "/health");
      ws.onerror = (v) => {
        reject(v);
      }
      ws.onopen = (v) => {
        ws.close(1000);
        resolve(v)
      }
    });

  }
  // post(url: string, data: any, options?:{force_url:boolean}) {
  //   console.log(HandleRequest.serialize(data));
  //   var jwt = localStorage.getItem("voipboxAppToken");
  //   var requestHeaders = new Headers();
  //   requestHeaders.append("X-VA-Auth", "user");
  //   if (jwt) {
  //     requestHeaders.append("Authorization", "Basic " + jwt);
  //   }
  //   requestHeaders.append("Content-Type", "application/x-www-form-urlencoded");
  //   let fixed_url = (options && options.force_url)? url : CONFIG.API_ENDPOINT + url;
  //   return this.http
  //     .post(
  //       fixed_url,
  //       HandleRequest.serialize(data) /*urlSearchParams.toString()*/,
  //       { headers: requestHeaders }
  //     )
  //     .catch(error => {
  //       this.handleErrors(error._body, error.status);
  //       return Observable.throw(error);
  //     });
  // }
  // post_with_files(url: string, data: FormData) {
  //   var jwt = localStorage.getItem("voipboxAppToken");
  //   const headers = {
  //     'Authorization': "Basic " + jwt,
  //     "X-VA-Auth": "user"
  //   };
  //   return this.httpClient
  //     .post(url,data,{ headers: headers })
  //     .catch(error => {
  //       // this.handleErrors(error.error, error.status);
  //       return Observable.throw(error);
  //     });
  // }
  // update_with_files(url: string, data: FormData) {
  //   var jwt = localStorage.getItem("voipboxAppToken");
  //   const headers = {
  //     'Authorization': "Basic " + jwt,
  //     "X-VA-Auth": "user"
  //   };
  //   return this.httpClient
  //     .patch(url,data,{ headers: headers })
  //     .catch(error => {
  //       // this.handleErrors(error.error, error.status);
  //       return Observable.throw(error);
  //     });
  // }
  // resetPassword(url: string, data: any) {
  //   console.log(HandleRequest.serialize(data));
  //   var requestHeaders = new Headers();
  //   requestHeaders.append("X-VA-Auth", "user");
  //   requestHeaders.append("Content-Type", "application/x-www-form-urlencoded");
  //   return this.http
  //     .post(
  //       CONFIG.API_ENDPOINT + url,
  //       HandleRequest.serialize(data) ,
  //       { headers: requestHeaders }
  //     )
  //     .catch(error => {
  //       this.handleErrors(error._body, error.status);
  //       return Observable.throw(error);
  //     });
  // }
  // loginWithToken(url: string, token: string) {
  //   console.log("loginWithToken", token);
  //   var requestHeaders = new Headers();
  //   requestHeaders.append("X-VA-Auth", "user");
  //   requestHeaders.append("Content-Type", "application/x-www-form-urlencoded");
  //   return this.http
  //     .post(
  //       CONFIG.API_ENDPOINT + url,
  //       HandleRequest.serialize({token:token}) ,
  //       { headers: requestHeaders }
  //     )
  //     .catch(error => {
  //       this.handleErrors(error._body, error.status);
  //       return Observable.throw(error);
  //     });
  // }

  // getPage(url: string, urlParams: any, data: any) {
  //   console.log("gggggg", url, urlParams, data)
  //   let urlString = url// + "&per_page=" + (urlParams.per_page || CONFIG.ITEMS_PER_PAGE);
  //   if(urlParams && urlParams.per_page){
  //     urlString += "&per_page="+urlParams.per_page
  //     delete urlParams.per_page
  //   }else{
  //     urlString += "&per_page="+ITEMS_PER_PAGE
  //   }

  //   if (urlParams.order) {
  //     urlString +=
  //       "&order_by=" +
  //       urlParams.order.order_by +
  //       "&order_type=" +
  //       urlParams.order.order_type;
  //     delete urlParams.order;
  //   }
  //   return this.getAll(urlString, urlParams, data);
  // }

  // getAll(url: string, urlParams?: any, data?: any) {
  //   //let params: URLSearchParams;
  //   let dataUrl;
  //   var jwt = localStorage.getItem("voipboxAppToken");
  //   var requestHeaders = new Headers();
  //   requestHeaders.append("X-VA-Auth", "user");

  //   if (jwt) {
  //     requestHeaders.append("Authorization", "Basic " + jwt);
  //     dataUrl = { headers: requestHeaders };
  //   }

  //   if (urlParams != "") {
  //     if (!jwt) dataUrl = { search: HandleRequest.serialize(urlParams) };
  //     else dataUrl.search = HandleRequest.serialize(urlParams);
  //   }
  //   console.log(urlParams);

  //   console.log(CONFIG.API_ENDPOINT + url, dataUrl);
  //   var temp_api = CONFIG.API_ENDPOINT;
  //     if(url.includes("https") && url.includes("mute"))
  //       temp_api = "";
  //   return this.http
  //     .get(temp_api + url, dataUrl)
  //     .map((res: any) => {
  //       return res;
  //     })
  //     .catch(error => {
  //       this.handleErrors(error._body, error.status);
  //       return Observable.throw(error);
  //     });
  // }

  // getById(url: string) {
  //   let params: URLSearchParams;
  //   let dataUrl;
  //   var jwt = localStorage.getItem("voipboxAppToken");
  //   // var authHeader = new Headers();
  //   var requestHeaders = new Headers();
  //   requestHeaders.append("X-VA-Auth", "user");
  //   if (jwt) {
  //     // authHeader.append('Authorization', 'Basic ' + jwt);
  //     // dataUrl = {headers: authHeader}
  //     requestHeaders.append("Authorization", "Basic " + jwt);
  //     dataUrl = { headers: requestHeaders };
  //   }
  //   return this.http.get(CONFIG.API_ENDPOINT + url, dataUrl)
  //     .catch(error => {
  //       this.handleErrors(error._body, error.status);
  //       return Observable.throw(error);
  //     });
  // }

  // update(url: string, data: any) {
  //   var jwt = localStorage.getItem("voipboxAppToken");
  //   var requestHeaders = new Headers();
  //   requestHeaders.append("X-VA-Auth", "user");
  //   if (jwt) {
  //     requestHeaders.append("Authorization", "Basic " + jwt);
  //   }
  //   requestHeaders.append("Content-Type", "application/x-www-form-urlencoded");
  //   return this.http
  //     .patch(CONFIG.API_ENDPOINT + url, HandleRequest.serialize(data), {
  //       headers: requestHeaders
  //     })
  //     .catch(error => {
  //       this.handleErrors(error._body, error.status);
  //       return Observable.throw(error);
  //     });
  // }

  // delete(url: string, options?:{force_url:boolean}) {
  //   console.log("delete http");
  //   var jwt = localStorage.getItem("voipboxAppToken");
  //   var requestHeaders = new Headers();
  //   requestHeaders.append("X-VA-Auth", "user");
  //   if (jwt) {
  //     requestHeaders.append("Authorization", "Basic " + jwt);
  //   }
  //   let fixed_url = (options && options.force_url)? url : CONFIG.API_ENDPOINT + url;
  //   return this.http.delete(fixed_url, {
  //     headers: requestHeaders
  //   })
  //   .catch(error => {
  //     this.handleErrors(error._body, error.status);
  //     return Observable.throw(error);
  //   });;
  // }

  // getCustomerData(){
  //   let dataUrl;
  //   var requestHeaders = new Headers();
  //   requestHeaders.append("X-VA-Auth", "user");
  //   dataUrl = { headers: requestHeaders };
  //   return this.http.get(CONFIG.API_ENDPOINT + '/tasks/customer_portal_data', dataUrl)
  // }
  /*********************
  *
  *     HELPERS
  *
  *********************/
  private static serialize(obj, prefix?) {
    var str = [],
      p;
    for (p in obj) {
        if (obj.hasOwnProperty(p)) {
          var k = prefix ?
                    Array.isArray(obj) ?
                      prefix + "[]" :
                      prefix + "[" + encodeURIComponent(p) + "]"
                    : encodeURIComponent(p),
            v = obj[p];
          str.push((v !== null && typeof v === "object") ?
            HandleRequest2.serialize(v, k) :
            k + "=" + v);
            //console.log(obj[p]);

        }
    }
    return str.join("&");
  }
  private static parseIfValidJson(str: string): Object | boolean {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return JSON.parse(str);
  }
  /*********************
  *
  *     HANDLERS
  *
  *********************/
  // wsStatus():Promise<any> {
  //   return new Promise((resolve,reject)=>{
  //     let ws = new WebSocket(CONFIG.WEBSOCKETS_URL);
  //     ws.onerror = (v) => {
  //       reject(v);
  //     }
  //     ws.onopen = (v) => {
  //       ws.close(1000);
  //       resolve(v)
  //     }
  //   });

  // }
  public handleAlerts(toast: any) {

    this.toasts.push(toast);

    if (this.toasts.length == 1) {
      this.toasts[0].present();
    }

    this.toasts[this.toasts.length - 1].onDidDismiss(() => {
      this.presentNextAlert();
    });
  }
  public presentNextAlert() {
    this.toasts.shift();
    if (this.toasts.length != 0) {
      this.toasts[0].present();
    }
  }
  public async handleErrors(body: any, status: number = 500, options = { retry_timeout: 8 }) {
    
    body = typeof body === 'object' && 'message' in body ? body : HandleRequest2.parseIfValidJson(body) || { message: "Server Error" };
    const toast = await this.toastCtrl.create({
            message: body.message,
            cssClass: "toast-danger",
            duration: 3000,
            position: "bottom",
            // buttons:[
            //   {
            //     text: 'Dismiss',
            //     role: 'cancel',
            //     handler: () => {  }
            //   }
            // ]
          });
    await toast.present();     
    
    // switch (status) {
    //   case 666:
    //     this.lostConnection(body.message, options.retry_timeout);
    //     break;
    //   case 401:
    //     toast = this.toastCtrl
    //       .create({
    //         message: body.message,
    //         showCloseButton: true,
    //         position: "top",
    //         cssClass: "toast-danger"
    //       });
    //     // this.handleAlerts(toast);
    //     // this.events.publish("app:notifications:error", body);
    //     // this.events.publish("app:logout");
    //     break;
    //   // case 0:
    //   // case 404:
    //   case 500:
    //     this.alertCtrl
    //       .create({
    //         title: body.message,
    //         subTitle: status.toString() +" "+this.translate.instant('ALERT.SUPPORT_MSG'),//" Please contact support",
    //         buttons: [this.translate.instant('ALERT.DISMISS')]//["Dismiss"]
    //       })
    //       .present();
    //     break;
    //   case 501://upload file - file type error
    //     this.alertCtrl
    //       .create({
    //         title: body.message.title,
    //         subTitle: body.message.sub_title,//status.toString(),
    //         buttons: [this.translate.instant('ALERT.OK')]//["Ok"]
    //       })
    //       .present();
    //     break;
    //     case 502://webrtc phone - user media error
    //     this.alertCtrl
    //       .create({
    //         title: body.message,
    //         // subTitle: body.message.sub_title,//status.toString(),
    //         buttons: [this.translate.instant('ALERT.OK')]//["Ok"]
    //       })
    //       .present();
    //     break;
    //   default:
    //     // toast = this.toastCtrl
    //     //   .create({
    //     //     message: body.message,
    //     //     showCloseButton: true,
    //     //     position: "top",
    //     //     cssClass: "toast-danger"
    //     //   });
    //     // this.handleAlerts(toast);
    //     this.events.publish("app:notifications:error", body);
    //     break;
    // }
    console.log(
      "%c " + status + ": " + body.message,
      "background: #222; color: #bada55;font-size:16px;"
    );
  }

  private lostConnection(message, timeout = 5) {
    // let toast = this.toastCtrl
    //   .create({
    //     message: message,
    //     showCloseButton: true,
    //     position: "bottom",
    //     cssClass: "toast-warn"
    //   });
    // toast.present();

    // let stop = false;
    // this.events.subscribe('app:connected', (isConnected) => {
    //   stop = isConnected;
    // })

    // let num = timeout;
    // let timer = setInterval(() => {
    //   toast.setMessage(message + " (retry in: " + num.toString() + ")");
    //   if (stop) {
    //     clearInterval(timer);
    //     toast.dismiss();
    //   }

    //   if (num > 0) {
    //     num -= 1;
    //   } else {
    //     clearInterval(timer);
    //     toast.dismiss();
    //   }
    // }, 1000);
  }

  //@TODO: handle success

  /*********************
  *
  *     DEPRECATED
  *
  *********************/
  // formData(myFormData, property: String = "") {
  //   let t = this;
  //   //console.log("typeof myFormData",myFormData, this)
  //   if (!myFormData) return "";

  //   return Object.keys(myFormData)
  //     .map(function (key) {
  //       //console.log("typeof myFormData[key]",typeof myFormData[key],myFormData[key])
  //       if (typeof myFormData[key] == "object")
  //         return t.formData(myFormData[key], property + "[" + key + "]");
  //       //console.log("typeof myFormData[key]2222",typeof myFormData[key],myFormData[key])
  //       if (property != "") {
  //         return (
  //           property +
  //           "[" +
  //           encodeURIComponent(key) +
  //           "]" +
  //           "=" +
  //           encodeURIComponent(myFormData[key])
  //         );
  //       } else {
  //         return (
  //           encodeURIComponent(key) + "=" + encodeURIComponent(myFormData[key])
  //         );
  //       }
  //     })
  //     .join("&");
  // }

  /*private load(observable){
    let loading = this.loadindCtrl.create({
      content: 'Please wait...'
    });
    loading.present();
    return observable.map(res=>{res.Json; loading.dismiss()})
    /*observable.subscribe(() =>
        loading.dismiss().then(res => {return res}//this.res = res
      ),
      err => {loading.dismiss(); console.log("error-calls", err);return err }//this.apiError = err;}
    );* /
  }*/
}
