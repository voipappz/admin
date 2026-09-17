import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ExtensionEditModule } from './extension-edit.module';
import { ExtensionEditPage } from './extension-edit';

// Thin routed wrapper so ExtensionEditPage can be opened as an in-page route
// (push view + back) — reusing the same component that the modal flows use.
@NgModule({
  imports: [
    ExtensionEditModule,
    RouterModule.forChild([{ path: '', component: ExtensionEditPage }])
  ]
})
export class ExtensionEditRoutedModule {}
