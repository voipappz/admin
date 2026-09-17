import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { ContactListPage } from './contact-list';
import { ContactListPageRoutingModule } from './contact-list-routing.module';
import { DialpadComponent } from '../../partials/dialpad/dialpad.component';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ContactListPageRoutingModule,
    TranslateModule
  ],
  declarations: [ContactListPage]
})
export class ContactListModule {}
