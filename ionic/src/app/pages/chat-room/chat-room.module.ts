import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
// import { JanusModule } from 'janus-angular';
import { ChatRoomPage } from './chat-room';
import { ChatRoomPageRoutingModule } from './chat-room-routing.module';
import { IonicModule } from '@ionic/angular';
import { JanusModule } from '../../../assets/angular-janus-master/projects/janus/src/public-api';
import { AudioCallService } from '../../core/providers/audio-call.service';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ChatRoomPageRoutingModule,
    JanusModule
  ],
  declarations: [
    ChatRoomPage,
  ],
  providers:[
    AudioCallService
  ]
})
export class ChatRoomModule { }
