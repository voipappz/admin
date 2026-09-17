import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';


import { JanusVideoroomComponent } from './containers/janus-videoroom/janus-videoroom.component';
import { JanusAudioroomComponent } from './containers/janus-audioroom/janus-audioroom.component';
import { DeviceSelectorComponent } from './containers/device-selector/device-selector.component';
import { AudioBoxComponent } from './components/audio-box/audio-box.component';
import { DefaultVideoRoomComponent } from './components/default-video-room/default-video-room.component';
import { SelfVideoComponent } from './components/self-video/self-video.component';
import { VideoBoxComponent } from './components/video-box/video-box.component';
import { VideoRoomWrapperComponent } from './components/video-room-wrapper/video-room-wrapper.component';
import { VideoRoomWrapperDirective } from './components/video-room-wrapper/video-room-wrapper.directive';


@NgModule({
  declarations: [
    JanusVideoroomComponent,
    JanusAudioroomComponent,
    DeviceSelectorComponent,
    AudioBoxComponent,
    DefaultVideoRoomComponent,
    SelfVideoComponent,
    VideoBoxComponent,
    VideoRoomWrapperComponent,
    VideoRoomWrapperDirective,
  ],
  imports: [
    ReactiveFormsModule,
    CommonModule,
  ],
  exports: [
    JanusVideoroomComponent,
    JanusAudioroomComponent,
    DeviceSelectorComponent,
    SelfVideoComponent,
    VideoBoxComponent,
    AudioBoxComponent,
    DefaultVideoRoomComponent,
  ]
})
export class JanusModule { }
