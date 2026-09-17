import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { CallsPage } from './calls';
import { CallsPageRoutingModule } from './calls-routing.module';
import { CallService } from '../../core/_base/layout';
import { PipesModule } from '../../core/_base/layout/pipes/pipes-module';
import { PartialsModule } from '../../partials/partials.module';
import { FilterComponent } from '../../partials/filter/filter.component';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    CallsPageRoutingModule,
    PartialsModule,
    PipesModule,
    TranslateModule.forChild(),
  ],
  declarations: [CallsPage],
  providers:[CallService]
})
export class CallsModule {}
