import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { ActionSheetController } from '@ionic/angular';

// import { ContactListPage } from './settings';
import { ConferenceData } from '../../core/providers/conference-data';

const confDataSub = {};

describe('ContactListPage', () => {
  let fixture, app;
  beforeEach(waitForAsync(() => {
    const actionSheetSpy = jasmine.createSpyObj('ActionSheetController', [
      'create'
    ]);
    const routerSpy = jasmine.createSpyObj('Router', ['navigateByUrl']);

    TestBed.configureTestingModule({
      // declarations: [ContactListPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: ActionSheetController, useValue: actionSheetSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ConferenceData, useValue: confDataSub }
      ]
    }).compileComponents();
  }));
  beforeEach(() => {
    // fixture = TestBed.createComponent(ContactListPage);
    // app = fixture.debugElement.componentInstance;
  });
  it('placeholder (component not yet under test)', () => {
    expect(true).toBeTrue();
  });
});
