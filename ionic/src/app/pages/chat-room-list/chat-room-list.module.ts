import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ChatRoomListPage } from './chat-room-list';
import { ChatRoomListPageRoutingModule } from './chat-room-list-routing.module';
import { IonicModule } from '@ionic/angular';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ChatRoomListPageRoutingModule
  ],
  declarations: [
    ChatRoomListPage,
  ]
})
export class ChatRoomListModule { }
