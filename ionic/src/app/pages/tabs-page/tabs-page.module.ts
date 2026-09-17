import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { TabsPage } from './tabs-page';
import { TabsPageRoutingModule } from './tabs-page-routing.module';

import { AboutModule } from '../about/about.module';
import { MapModule } from '../map/map.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { SessionDetailModule } from '../session-detail/session-detail.module';
import { TranslateModule } from '@ngx-translate/core';
import { PartialsModule } from '../../partials/partials.module';
// import { ContactDetailModule } from '../contact-detail/contact-detail.module';
// import { ContactListModule } from '../contact-list/contact-list.module';
// import { ChatRoomModule } from '../chat-room/chat-room.module';
// import { ChatRoomListModule } from '../chat-room-list/chat-room-list.module';

@NgModule({
  imports: [
    AboutModule,
    CommonModule,
    IonicModule,
    MapModule,
    ScheduleModule,
    SessionDetailModule,
    // ContactDetailModule,
    // ContactListModule,
    TabsPageRoutingModule,
    // ChatRoomModule,
    // ChatRoomListModule
    TranslateModule,
    PartialsModule
  ],
  declarations: [
    TabsPage,
  ]
})
export class TabsModule { }
