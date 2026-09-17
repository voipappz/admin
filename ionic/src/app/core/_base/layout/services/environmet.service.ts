import { Injectable,Component, ElementRef } from '@angular/core';
import {  Subject } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  isChanched:Subject<string> = new Subject<string>();//new BehaviorSubject<string>('')//
  constructor() {

  }
}

  

  
