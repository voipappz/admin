import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { TimeConditionPage } from './time-condition-page';
import { TimeConditionPageRoutingModule } from './time-condition-page-routing.module';
// import { Settingservice } from '../../core/_base/layout';
import { PipesModule } from '../../core/_base/layout/pipes/pipes-module';
import { PartialsModule } from '../../partials/partials.module';
import { SetHoursPage } from './set-hours/set-hours';
import { LocationsService, TimeConditionService } from '../../core/_base/layout';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TimeConditionPageRoutingModule,
    PartialsModule,
    PipesModule,
    TranslateModule.forChild(),
  ],
  declarations: [TimeConditionPage, SetHoursPage],
  exports: [TimeConditionPage],
  providers:[TimeConditionService, LocationsService]
})
export class TimeConditionPageModule {}
