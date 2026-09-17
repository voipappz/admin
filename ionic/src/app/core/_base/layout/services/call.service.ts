import { Injectable } from '@angular/core';
import { Observable,of, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WebsocketService } from './action-cable.service';
import { HandleRequest } from './handleRequest.service';

@Injectable()
export class CallService {
    constructor(private handleRequest:HandleRequest, private ws:WebsocketService,) {

    }
    private _colFieldToSegmentName = {
      "call.created_at": '',
      "call.environment_name":"environment_uuid",
      "call.direction": "direction",
      "call.type": "",
      "call.leg_a_type":"",
      "call.leg_b_type":"",
      "call.caller_id_number":"caller_id_number",
      "call.duration":"duration",
      "call.billsec_duration":"billing_duration",
      "call.cause":"cause",
      "call.sip_provider_name":"",
      "call.user_username": "user_uuid",
      "call.campaign_name":"campaign_uuid",
      "call.status":"",
      "call.comment":"",
      "call.amd":"",
      "call.disposition":"disposition",
      "call.sip_provider_disposition":"",
      "call.sip_provider_status":"",
      "call.hangup_disposition":"",
      "call.contact_id":"",
      "call.contact_first_name":"contact_first_name",
      "call.contact_last_name":"contact_last_name",
      "call.number":"contact_number",
      "call.tags":"tag_uuid",
    }
    public getSegmentName(field){
      return this._colFieldToSegmentName[field]
    }
    public get(): Observable<any> {
        return this.handleRequest.get("/api/calls?page=1&per_page=20&order_by=created_at&order_type=desc&search%5Bcreated_at%5D=1720904400-1720990799&inline_search=")
        //   .map(res => res.json())
            // .toPromise();
    }
    public getParams(): Promise<any> {
      return this.handleRequest.get("/api/calls?action=params")
      //   .map(res => res.json())
          .toPromise();
    }
    public saveParams(params): Observable<any>{
      return this.handleRequest.patch("/api/calls?action=save_params", params)
    }
    public getSegments(): Promise<any> {
      return this.handleRequest.get("/api/calls?action=segments")
      //   .map(res => res.json())
          .toPromise();
    }
    getPage(page,filter:any={}): Observable<any>{
        return this.handleRequest.getPage("/api/calls?page="+page, filter,{})
        // .toPromise();
      }
    block(uuid,blocked): Observable<any>{

      return this.handleRequest.patch("/api/calls/"+uuid+'?action='+((!blocked)?'blacklist_add':'blacklist_remove'), {action:(!blocked)?'blacklist_add':'blacklist_remove'})
      // .toPromise();
    }
    public getColumns(): Observable<any> {
        return this.handleRequest.get("/api/calls?action=columns")
    }
    public getByUuid(uuid:string): Observable<any> {
      return this.handleRequest.get("/api/calls/"+uuid+'?action=load')
      //   .map(res => res.json())
          // .toPromise();
    }
    public run(uuid:string): Observable<any> {
      return this.handleRequest.get("/api/calls/"+uuid+'?action=run')
      //   .map(res => res.json())
          // .toPromise();
    }
    public export(filters={}): Observable<any> {
      return this.handleRequest.getWithParams("/api/calls?action=export", filters)
      //   .map(res => res.json())
          // .toPromise();
    }
  
}
