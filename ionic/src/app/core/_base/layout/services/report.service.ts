import { Injectable } from '@angular/core';
import { Observable,of, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WebsocketService } from './action-cable.service';
import { HandleRequest } from './handleRequest.service';

@Injectable()
export class ReportService {
    constructor(private handleRequest:HandleRequest, private ws:WebsocketService) {

    }
    public get(): Promise<any> {
        return this.handleRequest.get("/api/reports")
        //   .map(res => res.json())
            .toPromise();
    }
    public getByUuid(uuid:string): Observable<any> {
      return this.handleRequest.get("/api/reports/"+uuid+'?action=load')
      //   .map(res => res.json())
          // .toPromise();
    }
    public export(uuid:string, filters={}): Observable<any> {
        return this.handleRequest.getWithParams("/api/reports/"+uuid+'?action=export', filters)
        //   .map(res => res.json())
            // .toPromise();
      }
    public run(uuid:string, filters={}): Observable<any> {
      return this.handleRequest.getWithParams("/api/reports/"+uuid+'?action=run', filters)
      //   .map(res => res.json())
          // .toPromise();
    }
    public saveParams(uuid:string, params:any): Observable<any> {
      return this.handleRequest.patch("/api/reports/"+uuid+'?action=save_params', params)
      //   .map(res => res.json())
          // .toPromise();
    }
    public getParams(uuid:string): Promise<any> {
        return this.handleRequest.get("/api/reports/"+uuid+"?action=params")
        //   .map(res => res.json())
            .toPromise();
      }
    public getSegments(uuid:string): Promise<any> {
    return this.handleRequest.get("/api/reports/"+uuid+"?action=segments")
    //   .map(res => res.json())
        .toPromise();
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
