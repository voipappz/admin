import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { NumberEditPage } from './number-edit';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        TranslateModule
    ],
    declarations: [NumberEditPage],
    exports: [NumberEditPage]
})
export class NumberEditModule {}
