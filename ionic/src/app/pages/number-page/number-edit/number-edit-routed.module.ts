import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NumberEditModule } from './number-edit.module';
import { NumberEditPage } from './number-edit';

// Thin routed wrapper so NumberEditPage opens as an in-page route (push + back).
@NgModule({
  imports: [
    NumberEditModule,
    RouterModule.forChild([{ path: '', component: NumberEditPage }])
  ]
})
export class NumberEditRoutedModule {}
