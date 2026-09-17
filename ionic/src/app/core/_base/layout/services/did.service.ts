import { Injectable } from '@angular/core';
import { Observable,of, Subject } from 'rxjs';
import { HandleRequest } from './handleRequest.service';
// import { TyDid } from '../models/ty-did.model';

@Injectable()
export class DidService {
    
    constructor(private handleRequest:HandleRequest) {

    }
    getUploadRequestData(){
        return {
            url: this.handleRequest.getBaseUrl()+"api/did_numbers/import",
            authHeader: this.handleRequest.getAuthHeader(),
            authToken: this.handleRequest.getAuthToken(),
            action:"POST"
        }
    }
    public get(): Observable<any> {
        return this.handleRequest.get("/api/dids")
        //   .map(res => res.json())
            // .toPromise();
    }
    public getByUuid(uuid:string): Observable<any> {
      return this.handleRequest.get("/api/dids/"+uuid)//+'?action=load')
      //   .map(res => res.json())
          // .toPromise();
    }
    
    public export(uuid:string, filters={}): Observable<any> {
        return this.handleRequest.getWithParams("/api/dids/"+uuid+'?action=export', filters)
        //   .map(res => res.json())
            // .toPromise();
      }
    
    update(uuid, data, data_options?):Promise<any> {
        let options={did:'caller_id_number',
                    user:'user',
                    rule:'rule',
                    number_group:'file'}
        return this.handleRequest.patch("/api/dids/"+uuid, data)
        //("/api/dids/"+uuid+"?workflow_event=default&type="+options[data_options.field], data)
        // .map(res => res.json())
        .toPromise();
    }
    
    getData(type): Observable<any> {
        return this.handleRequest.get("/api/"+type)
        //   .map(res => res.json())
            // .toPromise();
    }
    
  
}