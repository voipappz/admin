import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { ConversationPage } from './conversation-page';
import { ConversationPageRoutingModule } from './conversation-page-routing.module';

@NgModule({
    imports: [
        CommonModule,
        IonicModule,
        TranslateModule,
        ConversationPageRoutingModule
    ],
    declarations: [
        ConversationPage
    ]
})
export class ConversationPageModule {}
