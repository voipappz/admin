import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { ExtensionEditPage } from './extension-edit';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        TranslateModule
    ],
    declarations: [ExtensionEditPage],
    exports: [ExtensionEditPage]
})
export class ExtensionEditModule {}
