import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { IvrEditPage } from './ivr-edit';
import { IvrService } from '../../../core/_base/layout/services/ivr.service';
import { PartialsModule } from '../../../partials/partials.module';
import { TimeConditionPageModule } from '../../time-condition-page/time-condition-page.module';
import { QueueEditPageModule } from '../../queue-page/queue-edit/queue-edit.module';
import { ExtensionEditModule } from '../../extension-page/extension-edit/extension-edit.module';
import { NumberEditModule } from '../../number-page/number-edit/number-edit.module';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        TranslateModule.forChild(),
        PartialsModule,
        TimeConditionPageModule,
        QueueEditPageModule,
        ExtensionEditModule,
        NumberEditModule
    ],
    declarations: [IvrEditPage],
    exports: [IvrEditPage],
    providers: [IvrService]
})
export class IvrEditPageModule {}
