import { CUSTOM_ELEMENTS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { Router } from '@angular/router';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { ModalController, PopoverController, MenuController } from '@ionic/angular';
import { of } from 'rxjs';

import { CallsPage } from './calls';
import { Events } from '../../core/providers/events';
import { UserData } from '../../core/providers/user-data';
import { CallService } from '../../core/_base/layout/services/call.service';

// Stub the template pipes so the component renders without the real modules.
@Pipe({ name: 'translate', standalone: false })
class MockTranslatePipe implements PipeTransform { transform(v: string): string { return v; } }
@Pipe({ name: 'groupByDate', standalone: false })
class MockGroupByDatePipe implements PipeTransform { transform(v: any): any[] { return []; } }

describe('CallsPage', () => {
  let fixture: any;
  let app: CallsPage;
  let callSvcSpy: jasmine.SpyObj<CallService>;

  beforeEach(waitForAsync(() => {
    const modalSpy = jasmine.createSpyObj('ModalController', ['create']);
    const popoverSpy = jasmine.createSpyObj('PopoverController', ['create']);
    const menuSpy = jasmine.createSpyObj('MenuController', ['toggle', 'enable']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigateByUrl', 'navigate']);
    const eventsSpy = jasmine.createSpyObj('Events', ['subscribe', 'publish']);
    const userDataSpy = jasmine.createSpyObj('UserData', ['getUserData', 'getUserInfo']);

    callSvcSpy = jasmine.createSpyObj('CallService', ['getPage', 'block']);
    // Return an empty page so loadCalls() resolves immediately (no real HTTP).
    callSvcSpy.getPage.and.returnValue(of({ body: [] }));

    TestBed.configureTestingModule({
      declarations: [CallsPage, MockTranslatePipe, MockGroupByDatePipe],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: ModalController, useValue: modalSpy },
        { provide: PopoverController, useValue: popoverSpy },
        { provide: MenuController, useValue: menuSpy },
        { provide: Router, useValue: routerSpy },
        { provide: Events, useValue: eventsSpy },
        { provide: UserData, useValue: userDataSpy },
        { provide: CallService, useValue: callSvcSpy }
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CallsPage);
    app = fixture.debugElement.componentInstance;
  });

  it('should create the calls page', () => {
    expect(app).toBeTruthy();
  });

  it('should load calls on view enter', () => {
    app.ionViewDidEnter();
    expect(callSvcSpy.getPage).toHaveBeenCalled();
  });

  it('should set the inline filter when searching', () => {
    app.search('Alice');
    expect(app.filters.inline).toBe('alice');
  });

  it('should filter locally instead of refetching (the box takes no search params)', () => {
    app.ionViewDidEnter();
    callSvcSpy.getPage.calls.reset();

    app.calls = [
      { uuid: '1', meta: { _direction: 'incoming', _contact_number: '972545234585', _contact_fullname: 'unknown' } },
      { uuid: '2', meta: { _direction: 'outgoing', _contact_number: '9001', _contact_fullname: 'unknown' } }
    ];

    app.filter('outgoing');
    expect(callSvcSpy.getPage).not.toHaveBeenCalled();
    expect(app.visibleCalls.length).toBe(1);
    expect(app.visibleCalls[0].uuid).toBe('2');

    app.filter('all');
    app.search('972545');
    expect(app.visibleCalls.length).toBe(1);
    expect(app.visibleCalls[0].uuid).toBe('1');
  });
});
