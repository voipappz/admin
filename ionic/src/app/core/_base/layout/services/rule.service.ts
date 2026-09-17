import { Injectable } from '@angular/core';
import { Observable,of, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WebsocketService } from './action-cable.service';
import { HandleRequest } from './handleRequest.service';

@Injectable()
export class RuleService {
    constructor(private handleRequest:HandleRequest, private ws:WebsocketService) {

    }
    public get(): Promise<any> {
        return this.handleRequest.get("/api/workflows")
        //   .map(res => res.json())
            .toPromise();
    }
    getRules(type, type_uuid){
        return this.handleRequest.get("/api/workflows?type="+type+"&type_uuid="+type_uuid)
        //   .map(res => res.json())
            .toPromise();
    }
    public getByUuid(uuid:string): Observable<any> {
      return this.handleRequest.get("/api/workflows/"+uuid)
      //   .map(res => res.json())
          // .toPromise();
    }
    getDataUrl(url){
        return this.handleRequest.get(url).toPromise()
    }
    getConditions(type, uuid){
        return this.handleRequest.get('/api/workflows?action=conditions&type='+type+"&"+type+"_uuid="+uuid)
    }
    getActions(type){
        return this.handleRequest.get('/api/workflows?action=actions&type='+type)
    }
    getFieldData(url): Observable<any> {
        return this.handleRequest.get(url)
    }
    getProfileParam(): Observable<any> {
        return this.handleRequest.get('/api/assets/profile_params?type=user')
    }
    getExtension(uuid): Observable<any> {
        return this.handleRequest.get('/api/extensions/'+uuid)
    }
    getExtensionSwitch(uuid): Observable<any> {
        return this.handleRequest.get('/api/extensions/'+uuid+'?action=switch')
    }
    public update(uuid,type, type_uuid, data):Promise<any> {
     
        return this.handleRequest.patch("/api/workflows/"+uuid+"?type="+type+"&type_uuid="+type_uuid, data)
        //("/api/campaigns/"+uuid+"?workflow_event=default&type="+options[data_options.field], data)
        // .map(res => res.json())
        .toPromise();
    }
    public create(type, type_uuid, data):Promise<any> {
        
        return this.handleRequest.post("/api/workflows?type="+type+"&type_uuid="+type_uuid, data)
        .toPromise();
    }
    public export(uuid:string, filters={}): Observable<any> {
        return this.handleRequest.getWithParams("/api/users/"+uuid+'?action=export', filters)
        //   .map(res => res.json())
            // .toPromise();
      }
    public run(uuid:string, filters={}): Observable<any> {
      return this.handleRequest.getWithParams("/api/users/"+uuid+'?action=run', filters)
      //   .map(res => res.json())
          // .toPromise();
    }
    public saveParams(uuid:string, params:any): Observable<any> {
      return this.handleRequest.patch("/api/users/"+uuid+'?action=save_params', params)
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
  
}
