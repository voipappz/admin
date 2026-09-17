import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { QueueEditPage } from './queue-edit';
import { PartialsModule } from '../../../partials/partials.module';
import { ExtensionEditModule } from '../../extension-page/extension-edit/extension-edit.module';
import { NumberEditModule } from '../../number-page/number-edit/number-edit.module';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        TranslateModule.forChild(),
        PartialsModule,
        ExtensionEditModule,
        NumberEditModule
    ],
    declarations: [QueueEditPage],
    exports: [QueueEditPage]
})
export class QueueEditPageModule {}
