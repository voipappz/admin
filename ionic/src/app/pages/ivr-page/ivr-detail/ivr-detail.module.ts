import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { IvrDetailPage } from './ivr-detail';
import { PartialsModule } from '../../../partials/partials.module';
import { IvrService } from '../../../core/_base/layout/services/ivr.service';
import { IvrEditPageModule } from '../ivr-edit/ivr-edit.module';

const routes: Routes = [
    {
        path: '',
        component: IvrDetailPage
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
        IvrEditPageModule,
    ],
    declarations: [IvrDetailPage],
    exports: [IvrDetailPage],
    providers: [IvrService]
})
export class IvrDetailModule {}
