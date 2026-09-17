import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { SettingsPage } from './settings';
import { SettingsPageRoutingModule } from './settings-routing.module';
// import { Settingservice } from '../../core/_base/layout';
import { PipesModule } from '../../core/_base/layout/pipes/pipes-module';
import { PartialsModule } from '../../partials/partials.module';
import { TimeConditionPage } from '../time-condition-page/time-condition-page';
import { TimeConditionPageModule } from '../time-condition-page/time-condition-page.module';


@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    SettingsPageRoutingModule,
    PartialsModule,
    PipesModule,
    TranslateModule.forChild(),
    TimeConditionPageModule
  ],
  declarations: [SettingsPage]
  // providers:[Settingservice]
})
export class SettingsModule {}
