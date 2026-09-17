import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { ReportsPage } from './reports-page';
import { ReportService } from '../../core/_base/layout/services/report.service';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule.forChild(),
    RouterModule.forChild([{ path: '', component: ReportsPage }])
  ],
  declarations: [ReportsPage],
  providers: [ReportService]
})
export class ReportsPageModule {}
