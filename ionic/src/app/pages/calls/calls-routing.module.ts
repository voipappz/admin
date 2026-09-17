import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CallsPage } from './calls';
const routes: Routes = [
  {
    path: '',
    component: CallsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CallsPageRoutingModule {}
