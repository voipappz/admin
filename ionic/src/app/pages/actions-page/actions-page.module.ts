import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { ActionsPage } from './actions-page';
import { ActionsPageRoutingModule } from './actions-page-routing.module';
import { PartialsModule } from '../../partials/partials.module';
import { IvrService } from '../../core/_base/layout/services/ivr.service';
import { IvrDetailModule } from '../ivr-page/ivr-detail/ivr-detail.module';
import { QueueDetailModule } from '../queue-page/queue-detail/queue-detail.module';
import { ExtensionDetailModule } from '../extension-page/extension-detail/extension-detail.module';
import { NumberDetailModule } from '../number-page/number-detail/number-detail.module';
import { TimeConditionDetailModule } from '../time-condition-page/time-condition-detail/time-condition-detail.module';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        TranslateModule,
        ActionsPageRoutingModule,
        PartialsModule,
        IvrDetailModule,
        QueueDetailModule,
        ExtensionDetailModule,
        NumberDetailModule,
        TimeConditionDetailModule
    ],
    declarations: [
        ActionsPage
    ],
    providers: [
        IvrService
    ]
})
export class ActionsPageModule {}
