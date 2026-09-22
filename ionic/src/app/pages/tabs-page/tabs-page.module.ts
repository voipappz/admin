import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { TabsPage } from './tabs-page';
import { TabsPageRoutingModule } from './tabs-page-routing.module';

import { TranslateModule } from '@ngx-translate/core';
import { PartialsModule } from '../../partials/partials.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    TabsPageRoutingModule,
    TranslateModule,
    PartialsModule
  ],
  declarations: [
    TabsPage,
  ]
})
export class TabsModule { }
