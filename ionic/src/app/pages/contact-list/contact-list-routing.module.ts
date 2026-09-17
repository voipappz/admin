import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ContactListPage } from './contact-list';
const routes: Routes = [
  {
    path: '',
    component: ContactListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ContactListPageRoutingModule {}
