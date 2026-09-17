import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { ContactDetailPage } from './contact-detail';
import { ContactDetailPageRoutingModule } from './contact-detail-routing.module';
import { IonicModule } from '@ionic/angular';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ContactDetailPageRoutingModule,
    TranslateModule
  ],
  declarations: [
    ContactDetailPage,
  ]
})
export class ContactDetailModule { }
