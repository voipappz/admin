import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ChatRoomListPage } from './chat-room-list';

const routes: Routes = [
  {
    path: '',
    component: ChatRoomListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ChatRoomListPageRoutingModule { }
