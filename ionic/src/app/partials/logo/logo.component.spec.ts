import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { PopoverController } from '@ionic/angular';

import { LogoComponent } from './logo.component';
import { UserData } from '../../core/providers/user-data';
import { Events } from '../../core/providers/events';

describe('LogoComponent', () => {
  let fixture, app;
  beforeEach(waitForAsync(() => {
    const popoverSpy = jasmine.createSpyObj('PopoverController', ['create', 'dismiss']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigateByUrl']);
    const eventsSpy = jasmine.createSpyObj('Events', ['publish', 'subscribe']);
    const userDataSpy = jasmine.createSpyObj('UserData', ['getUserData', 'getCustomerData']);
    userDataSpy.getCustomerData.and.returnValue(null);

    TestBed.configureTestingModule({
      declarations: [LogoComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: PopoverController, useValue: popoverSpy },
        { provide: Router, useValue: routerSpy },
        { provide: UserData, useValue: userDataSpy },
        { provide: Events, useValue: eventsSpy }
      ]
    }).compileComponents();
  }));
  beforeEach(() => {
    fixture = TestBed.createComponent(LogoComponent);
    app = fixture.debugElement.componentInstance;
  });
  it('should create the logo component', () => {
    expect(app).toBeTruthy();
  });
});
