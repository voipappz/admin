import { Injectable } from '@angular/core';
import { Observable,of, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WebsocketService } from './action-cable.service';
import { HandleRequest } from './handleRequest.service';
import { TyCampaign } from '../models/ty-campaign.model';

@Injectable()
export class CampaignService {
    active_campaign:TyCampaign;
    campaign$ = new Subject<TyCampaign>();
    reloadNumbers = new Subject<'upload'|'reload'| 'export'|'add_numbers'>();
    constructor(private handleRequest:HandleRequest, private ws:WebsocketService) {

    }
    getUploadRequestData(){
        return {
            url: this.handleRequest.getBaseUrl()+"api/campaign_numbers/import",
            authHeader: this.handleRequest.getAuthHeader(),
            authToken: this.handleRequest.getAuthToken(),
            action:"POST"
        }
    }
    public get(): Promise<any> {
        return this.handleRequest.get("/api/campaigns")
        //   .map(res => res.json())
            .toPromise();
    }
    public getByUuid(uuid:string): Observable<any> {
      return this.handleRequest.get("/api/campaigns/"+uuid)//+'?action=load')
      //   .map(res => res.json())
          // .toPromise();
    }
    public getWorkflow(uuid:string): Observable<any> {
        return this.handleRequest.get("/api/campaigns/"+uuid+'?action=workflows')
        //   .map(res => res.json())
            // .toPromise();
    }
    public updateWorkflow(uuid, data):Promise<any> {
        
        return this.handleRequest.patch("/api/workflows/"+uuid, data)
        //("/api/campaigns/"+uuid+"?workflow_event=default&type="+options[data_options.field], data)
        // .map(res => res.json())
        .toPromise();
    }
    public getWorkflowEvents(uuid): Observable<any> {
        return this.handleRequest.get("/api/campaigns/"+uuid+'?action=workflow_events')
        //   .map(res => res.json())
            // .toPromise();
    }
    public getWorkflowEventSegments(uuid): Observable<any> {
        return this.handleRequest.get("/api/workflow_events/"+uuid+'?action=segments')
        //   .map(res => res.json())
            // .toPromise();
    }
    
    public getWorkflowEventParams(uuid): Observable<any> {
        return this.handleRequest.get("/api/workflow_events/"+uuid+'?action=segment_params')
        //   .map(res => res.json())
            // .toPromise();
    }
    public export(uuid:string, filters={}): Observable<any> {
        return this.handleRequest.getWithParams("/api/campaigns/"+uuid+'?action=export', filters)
        //   .map(res => res.json())
            // .toPromise();
      }
    run(status,uuid):Promise<any> {
        return this.handleRequest.patch("/api/campaigns/"+uuid, {action: status})
        // .map(res => res.json())
        .toPromise();
    }
    update(uuid, data, data_options?):Promise<any> {
        let options={did:'caller_id_number',
                    user:'user',
                    rule:'rule',
                    number_group:'file'}
        return this.handleRequest.patch("/api/campaigns/"+uuid, data)
        //("/api/campaigns/"+uuid+"?workflow_event=default&type="+options[data_options.field], data)
        // .map(res => res.json())
        .toPromise();
    }
    duplicate( data):Promise<any> {
        return this.handleRequest.post("/api/campaigns", data)
        // .map(res => res.json())
        .toPromise();
    }
    // public run(uuid:string, filters={}): Observable<any> {
    //   return this.handleRequest.getWithParams("/api/campaigns/"+uuid+'?action=run', filters)
    //   //   .map(res => res.json())
    //       // .toPromise();
    // }
    public getNumberGroups(): Observable<any> {
        return this.handleRequest.get("/api/number_groups")
        //   .map(res => res.json())
            // .toPromise();
    }
    getData(type): Promise<any> {
        return this.handleRequest.get("/api/"+type)
        //   .map(res => res.json())
            .toPromise();
    }
    getCampaignData(uuid,type): Observable<any> {
        let options={did:'caller_id_number',
                    user:'user',
                    rule:'rule',
                    number_group:'file'}
        return this.handleRequest.get("/api/campaigns/"+uuid+"?workflow_event=default&type="+options[type])
        //   .map(res => res.json())
            // .toPromise();
    }
    public saveParams(event_uuid:string, params:any): Observable<any> {
      return this.handleRequest.patch("/api/workflow_events/"+event_uuid, params)
      //   .map(res => res.json())
          // .toPromise();
    }
    link(url:string, action:'post'|'delete'|'patch', params:any): Observable<any>{
        switch (action) {
            case 'post':
                return this.handleRequest.post(url, params,{force_url:true})
                break;
            case 'patch':
                return this.handleRequest.patch(url, params,{force_url:true})
                break;
            case 'delete':
                return this.handleRequest.delete(url, params,{force_url:true})
                break;
            default:
                break;
        }
    }

    getActiveCampaign(uuid){
        // console.log("active_campaign", this.active_campaign)
        if(this.active_campaign && this.active_campaign.uuid == uuid){
            return this.active_campaign
        }else{
            return null
        }
    } 
    setActiveCampaign(campaign){
        console.log("active_campaign", campaign, this.active_campaign)
        this.active_campaign = campaign 
        this.campaign$.next(this.active_campaign)
    }

    
    // campaign numbers

    campaign_numbers_mode:string=''
    setCampaignNumbersMode(mode){
        this.campaign_numbers_mode =mode;
    }
    getCampaignNumbersMode(){
        return this.campaign_numbers_mode
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
      public getParams(uuid): Observable<any> {
        return this.handleRequest.get("/api/campaign_numbers?action=params&campaign_uuid="+uuid)
        //   .map(res => res.json())
            // .toPromise();
      }
      public saveCampaignNumbersParams(uuid,params): Observable<any>{
        return this.handleRequest.patch("/api/campaign_numbers?action=save_params&campaign_uuid="+uuid, params)
      }
      public getSegments(uuid): Observable<any> {
        return this.handleRequest.get("/api/campaign_numbers?action=segments&campaign_uuid="+uuid)
        //   .map(res => res.json())
            // .toPromise();
      }
      getPage(uuid,page,filter={}): Observable<any>{
          return this.handleRequest.getPage("/api/campaign_numbers?campaign_uuid="+uuid+"&page="+page, filter,{})
          // .toPromise();
        }

        DialNumber(uuid):Promise<any>{
            return this.handleRequest.patch("/api/campaign_numbers/"+uuid +"&action=dial", {})
            // .debounceTime(500)
            // .distinctUntilChanged()
            .toPromise();
          }

        batch(action,uuid,actionParams,uuids?,search?) {
            let body = {
              campaign_uuid:uuid,
              action,
              action_params:actionParams
            }
            if(uuids) {
              body['uuids'] = uuids
            }
            if(search) {
              body['search'] = search
            }
            console.log(body);
        
            return this.handleRequest.patch("/api/campaign_numbers", body)
            .toPromise();
          }

    filterNumbers(uuid,page,filter={}):Observable<any>{
        //mock: return Observable.of(campaign).toPromise();
        return this.handleRequest.getPage("/api/campaign_numbers?campaign_uuid="+uuid+"&page="+page,filter,{})
        // .toPromise();
        }

        getDataUrl(url):Observable<any> {
            //return Observable.of(this.ivrs);
            return this.handleRequest.get('/api/'+url)
            // .map(res => res.json())
            // .toPromise();
          }
  
}