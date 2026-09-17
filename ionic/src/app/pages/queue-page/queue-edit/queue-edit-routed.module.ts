import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { QueueEditPageModule } from './queue-edit.module';
import { QueueEditPage } from './queue-edit';

// Thin routed wrapper so QueueEditPage opens as an in-page route (push + back).
@NgModule({
  imports: [
    QueueEditPageModule,
    RouterModule.forChild([{ path: '', component: QueueEditPage }])
  ]
})
export class QueueEditRoutedModule {}
