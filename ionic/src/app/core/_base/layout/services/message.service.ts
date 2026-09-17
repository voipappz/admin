
import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { TranslationService } from './translation.service';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  translationSubscription:Subscription;
  constructor( private translateSvc:TranslationService, private toastController: ToastController) {}

  async show(message: string, type='success', options:{duration?: any, translate:boolean}={duration:3000, translate:false}) {
    // type= success/error/info

    // this.translateSvc.getTranslation('HTTP.RESPONSE.SUCCESS.'+request.method).subscribe(msg=>{
									
								// 		this.msgSvc.show(msg, 'success');
									
								// })
    // if(options.translate){
    //   this.translationSubscription = this.translateSvc.getTranslation(message).subscribe(msg=>{

    //     const toast = await this.toastController.create({
    //       message: msg,
    //       duration: 3000,
    //       cssClass: 'error-toast',
    //       // buttons: [
    //       //   {
    //       //     text: 'Dismiss',
    //       //     role: 'cancel',
    //       //   },
    //       // ],
    //     });
    
    //     await toast.present();
    //   // }
    //     // this.snackBar.openFromComponent(MessageComponent, { 
    //     //   data: {type: type, message: msg},
    //     //   panelClass: ["snackbar-container",type] ,
    //     //   duration: options.duration ? options.duration : 3000,
    //     //   horizontalPosition: (this.translateSvc.isRTL())? 'left':'right',
    //     //   direction:dir
    //     // }).afterDismissed().subscribe(info=>{
    //     //   this.translationSubscription.unsubscribe()
    //     // });		  
    //   })
    // }else{
      const toast = await this.toastController.create({
        message: message,
        duration: 5000,
        cssClass: ['error-toast','toast-danger'],
        // buttons: [
        //   {
        //     text: 'Dismiss',
        //     role: 'cancel',
        //   },
        // ],
      });
  
      await toast.present();
    // }
      // this.snackBar.openFromComponent(MessageComponent, { 
      //   data: {type: type, message: message},
      //   panelClass: ["snackbar-container",type] ,
      //   duration: options.duration ? options.duration : 3000,
      //   horizontalPosition: (this.translateSvc.isRTL())? 'left':'right',
      //   direction:dir
      // });
      // }
    
  }
}
