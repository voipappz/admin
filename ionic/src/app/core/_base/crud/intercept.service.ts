// Angular
import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
// RxJS
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { HandleRequest } from '../layout/services/handleRequest.service';
import { Events } from '../layout/services/events.service';
import { MessageService } from '../layout';
import { UserData } from '../../providers/user-data';
// import { MessageService } from '../../layout/services/message.service';

/**
 * More information there => https://medium.com/@MetonymyQT/angular-http-interceptors-what-are-they-and-how-to-use-them-52e060321088
 */
@Injectable()
export class InterceptService implements HttpInterceptor {
	constructor(
		private events: Events,
		private msgSvc: MessageService,
		private userData: UserData
	) {}

	// intercept request and add token
	intercept(
		request: HttpRequest<any>,
		next: HttpHandler
	): Observable<HttpEvent<any>> {
		// Add X-VA-User header to all requests
		// const userUuid = this.userData.getUserData('uuid') || '';
		// if (userUuid) {
		// 	request = request.clone({
		// 		setHeaders: {
		// 			'X-VA-User': userUuid
		// 		}
		// 	});
		// }

		return next.handle(request).pipe(
			tap(
				event => {
					
					 if (event instanceof HttpResponse) {
						// console.log("", event, request)
						// console.log('all looks good');
						// // http response status code
						// console.log(event.status);
						if(request.method=='PATCH' || request.method=='POST'){
							if(request.url.indexOf('auth')==-1){
								// this.msgSvc.show('HTTP.RESPONSE.SUCCESS.'+request.method, 'success',{translate:true});
							}
							
						}
					}
				},
				error => {
					console.error("--------------------",error);
					let status = error.status;
					let body = error.error;
					body = (typeof body === 'object' && 'message' in body) ? body : HandleRequest.parseIfValidJson(body) || { message: "Server Error" };
					// http response status code
					// console.log('----response----');
					// console.error('status code:');
					// tslint:disable-next-line:no-debugger
					console.error(error.status);
					console.error(error.message);
					// console.log('--- end of response---');
					switch (status) {
						// case 666:
						//   this.lostConnection(body.message, options.retry_timeout);
						//   break;
						case 401:
						  console.log("handleErrors 401",typeof body,body,typeof status, status)
						  this.events.publish("app-logout");
						  
						  // break;
						case 0:
						case 404:
							// this.store.dispatch(new Logout());
						case 500:
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
						  this.msgSvc.show(body.message, 'error');
						  break;
					  }
					  if(error.url.indexOf("/auth/token_status")>-1){
						// this.store.dispatch(new Logout());
                        this.events.publish("app-logout");
					  }
					  console.log(
						"%c " + status + ": " + body.message,
						"background: #222; color: #bada55;font-size:16px;"
					  );
				}
			)
		);
	}
}
