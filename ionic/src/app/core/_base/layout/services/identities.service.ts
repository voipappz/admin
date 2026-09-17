import { Injectable } from '@angular/core';
import { Observable,of, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WebsocketService } from './action-cable.service';
import { HandleRequest } from './handleRequest.service';

@Injectable()
export class IdentitiesService {
    constructor(private handleRequest:HandleRequest, private ws:WebsocketService,) {

    }
    public get(): Observable<any> {
        return this.handleRequest.get("/api/call_conditions?page=1&per_page=20&order_by=created_at&order_type=desc")
        //   .map(res => res.json())
            // .toPromise();
    }
    public update(uuid,data): Observable<any>{
      return this.handleRequest.patch("/api/call_conditions/"+uuid, data)
    }
    public getUuids(type):Observable<any>{
      return this.handleRequest.get("/api/"+type+'s')
    }
    public getNumber(uuid):Observable<any>{
      return this.handleRequest.get("/api/numbers/"+uuid)
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
    public getColumns(): Observable<any> {
        return this.handleRequest.get("/api/calls?action=columns")
    }
    public getByUuid(uuid:string): Observable<any> {
      return this.handleRequest.get("/api/call_conditions/"+uuid+'?action=load')
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
