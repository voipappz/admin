import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { DashboardPage } from './dashboard';
// import { PopoverPage } from '../dashboard-popover/dashboard-popover';
import { DashboardPageRoutingModule } from './dashboard-routing.module';
import { PartialsModule } from '../../partials/partials.module';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PartialsModule,
    TranslateModule,
    DashboardPageRoutingModule
  ],
  declarations: [
    DashboardPage,
    // PopoverPage
  ],
  // DashboardService is providedIn: 'root'.
  // entryComponents: [PopoverPage],
  bootstrap: [DashboardPage],
})
export class DashboardModule {}
