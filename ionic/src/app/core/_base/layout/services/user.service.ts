import { Injectable } from '@angular/core';
import { Observable,of, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WebsocketService } from './action-cable.service';
import { HandleRequest } from './handleRequest.service';

@Injectable()
export class UserService {
    current_user:any=null;
    constructor(private handleRequest:HandleRequest, private ws:WebsocketService) {

    }
    getUploadRequestData(){
        return {
            url: this.handleRequest.getBaseUrl()+"api/extensions/import",
            authHeader: this.handleRequest.getAuthHeader(),
            authToken: this.handleRequest.getAuthToken(),
            action:"POST"
        }
    }
    setActiveUser(user){
        this.current_user = user;
    }
    getActiveUser(user_uuid){
        if(this.current_user && this.current_user.uuid == user_uuid ) return this.current_user;
        else return null;
    }
    public get(): Promise<any> {
        return this.handleRequest.get("/api/users")
        //   .map(res => res.json())
            .toPromise();
    }
    public getByUuid(uuid:string): Observable<any> {
      return this.handleRequest.get("/api/users/"+uuid)
      //   .map(res => res.json())
          // .toPromise();
    }
    getFieldData(url): Observable<any> {
        return this.handleRequest.get(url)
    }
    getProfileParam(): Observable<any> {
        return this.handleRequest.get('api/assets/profile_params?type=user')
    }
    getExtension(uuid): Observable<any> {
        return this.handleRequest.get('api/extensions/'+uuid)
    }
    getExtensionSwitch(uuid): Observable<any> {
        return this.handleRequest.get('api/extensions/'+uuid+'?action=switch')
    }
    public update(uuid, data):Promise<any> {
        
        return this.handleRequest.patch("/api/users/"+uuid, data)
        //("/api/campaigns/"+uuid+"?workflow_event=default&type="+options[data_options.field], data)
        // .map(res => res.json())
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
