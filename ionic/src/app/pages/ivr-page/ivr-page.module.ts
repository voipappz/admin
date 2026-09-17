import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { IvrPage } from './ivr-page';
import { IvrPageRoutingModule } from './ivr-page-routing.module';
import { PartialsModule } from '../../partials/partials.module';
import { IvrService } from '../../core/_base/layout/services/ivr.service';
import { IvrEditPageModule } from './ivr-edit/ivr-edit.module';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        IvrPageRoutingModule,
        PartialsModule,
        TranslateModule.forChild(),
        IvrEditPageModule,
    ],
    declarations: [IvrPage],
    providers: [IvrService]
})
export class IvrPageModule {}
