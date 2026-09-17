import { Injectable,Component, ElementRef } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class DateRangeService {
  public date_range_opeartor = new Subject<'today'|'month'|'year'|'week'>();
  
  constructor() {

  }
  public init(allSegments:any[], params:any[], openSearchBox=false){
    
  }
  
}
