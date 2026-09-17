import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { TimeConditionDetailPage } from './time-condition-detail';
import { PartialsModule } from '../../../partials/partials.module';
import { TimeConditionService, LocationsService } from '../../../core/_base/layout';

const routes: Routes = [
    {
        path: '',
        component: TimeConditionDetailPage
    }
];

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        RouterModule.forChild(routes),
        PartialsModule,
        TranslateModule.forChild(),
    ],
    declarations: [TimeConditionDetailPage],
    exports: [TimeConditionDetailPage],
    providers: [TimeConditionService, LocationsService]
})
export class TimeConditionDetailModule {}
