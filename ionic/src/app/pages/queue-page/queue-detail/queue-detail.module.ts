import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { QueueDetailPage } from './queue-detail';
import { PartialsModule } from '../../../partials/partials.module';
import { QueueEditPageModule } from '../queue-edit/queue-edit.module';

const routes: Routes = [
    {
        path: '',
        component: QueueDetailPage
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
        QueueEditPageModule,
    ],
    declarations: [QueueDetailPage],
    exports: [QueueDetailPage]
})
export class QueueDetailModule {}
