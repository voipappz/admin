import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { NumberDetailPage } from './number-detail';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        TranslateModule
    ],
    declarations: [NumberDetailPage],
    exports: [NumberDetailPage]
})
export class NumberDetailModule {}
