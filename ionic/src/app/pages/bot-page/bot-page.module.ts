import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { BotPage } from './bot-page';
import { BotPageRoutingModule } from './bot-page-routing.module';
import { PartialsModule } from '../../partials/partials.module';
import { BotEditModule } from './bot-edit/bot-edit.module';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        BotPageRoutingModule,
        PartialsModule,
        TranslateModule.forChild(),
        BotEditModule
    ],
    declarations: [BotPage]
})
export class BotPageModule {}
