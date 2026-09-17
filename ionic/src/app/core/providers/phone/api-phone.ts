import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserData } from '../user-data';
import { HandleRequest } from '../../_base/layout/services/handleRequest.service';




@Injectable()
export class ApiPhone {


  constructor(public http: HttpClient,public handleRequest:HandleRequest, private sharedData:UserData) {
  }

  call(target:any, caller_id_number:string, options?:any):Promise<any> {
    let body:any = {
      leg_b: {type: options.leg_b_type,},
      profile:{caller_id_number:caller_id_number}
    }
    if(options.leg_a){
      body.leg_a = options.leg_a
    }else{
      const extension = this.sharedData.getUserData('extension');
      body.leg_a = {type:"extension", username: extension?.username || ''}
    }
    if(options.leg_b_type == 'number'){
      body.leg_b.number = target
    }else if(options.leg_b_type == 'extension' || options.leg_b_type == 'conference'){
      body.leg_b.username = target
    }
    return this.handleRequest.post("/api/calls", body)
    .pipe(map(res => res))
    .toPromise();
  }

  forward(target:any, caller_id_number:string, options?:any):Promise<any> {
    if(options.leg_b_type != 'conference'){
      //TODO return
    }
    let body:any = {
      leg_a: options.leg_a,
      leg_b: {type: options.leg_b_type,username: target},
      profile:{caller_id_number:caller_id_number},
      type: "transfer_call"
    }
    return this.handleRequest.post("/api/calls", body)
          .pipe(map(res => res))
          .toPromise()
    // .then(call => {
    //   body = {type:"conference_bridge"}
    //   this.handleRequest.update("/api/calls/"+call.uuid, body)
    //   .toPromise()
    //   .then(call => {
    //     return this.handleRequest.delete("/api/calls/"+call.uuid+"?type=leg_b").toPromise()
    //   })
    //   .catch(err=>{
    //     console.error(err);
    //   });
    // })
    // .catch(err=>{
    //   console.error(err);
    // });
  }
  merge(call_uuid){
    let body = {type:"conference_bridge"}
    return this.handleRequest.patch("/api/calls/"+call_uuid, body)
    .toPromise()
  }
  mute(call_uuid, options){
    return this.handleRequest.patch("/api/calls/"+call_uuid, options)
    .toPromise()
  }
  hold(call_uuid, options){
    return this.mute(call_uuid, options)
  }
  // update(body,uuid):Promise<Campaign> {
  //   return this.handleRequest.update("/api/campaigns/"+uuid, body)
  //   .map(res => res.json())
  //   .toPromise();
  // }
  hangup(call_id:string, options?:any){
    //TODO add parameter 'type' (leg_a/leg_b/leg_c)
    console.warn("hangup API mode")
    let url:string = "/api/calls/"+call_id;
    if(options.type){
      url+="?type="+options.type
    }
    return this.handleRequest.delete(url, "")
    .pipe(map(res => res))
    .toPromise();
  }
  conferenceDeleteMember(call_id:string, options?:any){
    return this.handleRequest.delete("/api/calls/"+call_id+"?conference="+options.confernce_uuid+"&member_id="+options.member_id, "")
    .pipe(map(res => res))
    .toPromise();
  }
  answer(call_id:string, options?:any){

  }
}
