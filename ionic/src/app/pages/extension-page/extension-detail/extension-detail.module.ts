import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { ExtensionDetailPage } from './extension-detail';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        TranslateModule
    ],
    declarations: [ExtensionDetailPage],
    exports: [ExtensionDetailPage]
})
export class ExtensionDetailModule {}
