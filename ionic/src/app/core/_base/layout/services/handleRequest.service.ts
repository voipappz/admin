import { Injectable } from "@angular/core";
// import { Headers, Http, URLSearchParams, RequestOptions } from "@angular/http";
import { HttpClient, HttpParams } from "@angular/common/http";
import { catchError } from 'rxjs/operators';

import { Observable, throwError } from "rxjs";
// import { environment } from "src/environments/environment";
import { environment } from '../../../../../environments/environment';
import { AuthService } from "../../../providers/simple-auth.service";
import { ToastService } from "../../../providers/toast.service";
// import { Events } from '../providers/events';
// import { ITEMS_PER_PAGE } from '../config';
// import { TranslateService } from '@ngx-translate/core';

export const ITEMS_PER_PAGE = 20;

declare var CONFIG:any;
@Injectable()
export class HandleRequest {
  toasts: any[] = [];
  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private toast: ToastService
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
    const token = this.getAuthToken();
    return {
      Authorization: token ? 'Basic ' + token : '',
      'X-VA-Auth': 'user'
    }
  }
  getAuthToken(){
    // let token = 
    return  localStorage.getItem(environment.authTokenKey)
  }
  getBaseUrl(){
    return CONFIG.API_ENDPOINT;
  }
  get(url:string, options?:{force_url:boolean}){
    let fixed_url = (options && options.force_url)? url : CONFIG.API_ENDPOINT + url;
    
    return this.http.get(fixed_url, {headers:this.getAuthHeader()})
    .pipe(
      catchError((error) => {
        console.log("handleErrors",error)
        this.handleErrors(error.error||error.statusText, error.status);
        return throwError(error.message || 'server Error');
      }))
  }
  getPage(url: string, urlParams: any, data: any) {
    console.log("gggggg", url, urlParams, data)
    let urlString = url// + "&per_page=" + (urlParams.per_page || CONFIG.ITEMS_PER_PAGE);
    if(urlParams && urlParams.per_page){
      urlString += "&per_page="+urlParams.per_page
      delete urlParams.per_page
    }else{
      urlString += "&per_page="+ITEMS_PER_PAGE
    }

    if (urlParams.order) {
      urlString +=
        "&order_by=" +
        urlParams.order.order_by +
        "&order_type=" +
        urlParams.order.order_type;
      delete urlParams.order;
    }
    return this.getWithParams(urlString, urlParams, data);
  }
  getWithParams(url: string, urlParams?: any, data?: any) {
    //let params: URLSearchParams;
    let dataUrl:any = { headers: this.getAuthHeader(), observe: 'response' };
    if (urlParams != "") {
      dataUrl = { ...dataUrl, ...{params: new HttpParams({ fromString:HandleRequest.serialize(urlParams)})}};
    }
    console.log(dataUrl, HandleRequest.serialize(urlParams));

    return this.http
      .get(CONFIG.API_ENDPOINT + url, dataUrl)
      .pipe(
        catchError((error) => {
          this.handleErrors(error.error||error.statusText, error.status);
          return throwError(error.message || 'server Error');
        }))
  }
  post(url:string, params, options?:{force_url:boolean}):Observable<any>{
    // requestHeaders.append("Content-Type", "application/x-www-form-urlencoded");
    // HandleRequest.serialize(params)
    let fixed_url = (options && options.force_url)? url : CONFIG.API_ENDPOINT + url;
    return this.http.post(fixed_url,HandleRequest.serialize(params) ,{headers:{...this.getAuthHeader(),...{"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"}}})
    .pipe(
      catchError((error) => {
        this.handleErrors(error.error||error.statusText, error.status);
        return throwError(error.message || 'server Error');
      }))
  }
  postWithFiles(url: string, formData: FormData, options?:{force_url:boolean}): Observable<any> {
    let fixed_url = (options && options.force_url) ? url : CONFIG.API_ENDPOINT + url;
    // Don't set Content-Type - browser will set it with correct boundary for multipart
    return this.http.post(fixed_url, formData, { headers: this.getAuthHeader() })
      .pipe(
        catchError((error) => {
          this.handleErrors(error.error || error.statusText, error.status);
          return throwError(error.message || 'server Error');
        }))
  }
  patch(url: string, data: any, options?:{force_url:boolean}):Observable<any> {
    console.log("patch", url,data)
    let fixed_url = (options && options.force_url)? url : CONFIG.API_ENDPOINT + url;
    return this.http
      .patch(fixed_url, HandleRequest.serialize(data),{headers:{...this.getAuthHeader(),...{"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"}}})
      .pipe(
        catchError((error) => {
          this.handleErrors(error.error||error.statusText, error.status);
          return throwError(error.message || 'server Error');
        }))
  }
  delete(url: string,params:any, options?:{force_url:boolean}) {
    let fixed_url = (options && options.force_url)? url : CONFIG.API_ENDPOINT + url;
    let dataUrl = {headers:{...this.getAuthHeader(),...{"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"}}}
    if (params != "") {
      dataUrl = { ...dataUrl, ...{params: new HttpParams({ fromString:HandleRequest.serialize(params)})}};
    }
    return this.http.delete(fixed_url,dataUrl)
    .pipe(
      catchError((error) => {
        this.handleErrors(error.error||error.statusText, error.status);
        return throwError(error.message || 'server Error');
      }))
  }
  getCustomerData(){
    return JSON.parse(localStorage.getItem(environment.customerDataKey));
  }
  getCustomerDataFromServer():Observable<any>{
    return this.http.get(CONFIG.API_ENDPOINT + '/tasks/customer_portal_data')
  }
  loadCustomerData(): Promise<any>{
    ////////
    var data:any = {};
    if(window.location.href.indexOf('login')==-1){//not login page
      data = JSON.parse(localStorage.getItem(environment.customerDataKey))
    }//else{}//login page
    return new Promise((resolve, reject) => {
      
      if(!data || !data.url){//TODO add condition to validate data
          this.getCustomerDataFromServer()
          .subscribe(
          (res:any)=> {
              if(!res){res={}}
              console.log("-------------------loadCustomerData", res);
              res.url = (res.url)? res.url : "https://sbc-ingress.voipappz.io/assets/admin/layout4/img/VA_logo_white.png"
              res.url_login = (res.url_login)? res.url_login : "assets/img/VA_logo_white.png"
              localStorage.setItem(environment.customerDataKey,JSON.stringify(res));
              // this.store.dispatch(new CustomerLoaded({data:res})) // TODO 
              // this.sharedData.setCustomerData(res) 
              resolve(true) 
          },
          (err)=>{
              //TODO use default data?
              console.error("ERR-------------------loadCustomerData", err);
              let d:any = {}
              d.url =  "https://sbc-ingress.voipappz.io/assets/admin/layout4/img/VA_logo_white.png"
              d.url_login = "assets/img/VA_logo_white.png"
              localStorage.setItem(environment.customerDataKey,JSON.stringify(d));
              // this.store.dispatch(new CustomerLoaded({data:d})) // TODO 
              // this.sharedData.setCustomerData(d)
              resolve(true)
          })
      }else{
          // this.sharedData.setCustomerData(storage_data)
          resolve(true)
      }
      console.log("loadCustomerData", data);
    });
    //////////
}
  wsStatus():Promise<any> {
    // ActionCable-era reachability probe, no longer meaningful: the Phoenix
    // socket (WebsocketProvider/WebsocketService) authenticates on connect and
    // handles its own reconnection — a bare WS to the base URL would 404.
    return Promise.resolve(true);
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
                      (typeof obj[p]=='string'? prefix + "[]" : prefix + "[" +p+"]") :
                      prefix + "[" + encodeURIComponent(p) + "]"
                    : encodeURIComponent(p),
            v = obj[p];
          str.push((v !== null && typeof v === "object") ?
            HandleRequest.serialize(v, k) :
            k + "=" + v);
            //console.log(obj[p]);

        }
    }
    return str.join("&");
  }
  public static parseIfValidJson(str: string): Object | boolean {
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

    // this.toasts.push(toast);

    // if (this.toasts.length == 1) {
    //   this.toasts[0].present();
    // }

    // this.toasts[this.toasts.length - 1].onDidDismiss(() => {
    //   this.presentNextAlert();
    // });
  }
  public presentNextAlert() {
    // this.toasts.shift();
    // if (this.toasts.length != 0) {
    //   this.toasts[0].present();
    // }
  }
  public async handleErrors(body: any, status: number = 500, options = { retry_timeout: 8 }) {
    console.log("handleErrors",typeof body,body,typeof status, status)
    body = (typeof body === 'object' && 'message' in body) ? body : HandleRequest.parseIfValidJson(body) || { message: "Server Error" };
    
    switch (status) {
      // case 666:
      //   this.lostConnection(body.message, options.retry_timeout);
      //   break;
      case 401:
        console.log("handleErrors 401",typeof body,body,typeof status, status)
        // Auth errors are surfaced inline by the login/page; don't toast.
        break;
      case 0:
      case 404:
      case 500:
        this.toast.error((body && body.message) ? body.message : 'Server error');
        break;
      //   this.alertCtrl
      //     .create({
      //       title: body.message,
      //       subTitle: status.toString() +" "+this.translate.instant('ALERT.SUPPORT_MSG'),//" Please contact support",
      //       buttons: [this.translate.instant('ALERT.DISMISS')]//["Dismiss"]
      //     })
      //     .present();
      //   break;
      // case 501://upload file - file type error
      //   this.alertCtrl
      //     .create({
      //       title: body.message.title,
      //       subTitle: body.message.sub_title,//status.toString(),
      //       buttons: [this.translate.instant('ALERT.OK')]//["Ok"]
      //     })
      //     .present();
      //   break;
      //   case 502://webrtc phone - user media error
      //   this.alertCtrl
      //     .create({
      //       title: body.message,
      //       // subTitle: body.message.sub_title,//status.toString(),
      //       buttons: [this.translate.instant('ALERT.OK')]//["Ok"]
      //     })
      //     .present();
      //   break;
      default:
        // // toast = this.toastCtrl
        // //   .create({
        // //     message: body.message,
        // //     showCloseButton: true,
        // //     position: "top",
        // //     cssClass: "toast-danger"
        // //   });
        // // this.handleAlerts(toast);
        // this.events.publish("app:notifications:error", body);
        // this.msgSvc.show(body.message, 'error');
        console.error("ERROR",body.message)
        break;
    }
    console.log(
      "%c " + status + ": " + body.message,
      "background: #222; color: #bada55;font-size:16px;"
    );
  }

}
