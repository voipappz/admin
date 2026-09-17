import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TimeConditionPage } from './time-condition-page';


const routes: Routes = [
  {
    path: '',
    component: TimeConditionPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TimeConditionPageRoutingModule {}
