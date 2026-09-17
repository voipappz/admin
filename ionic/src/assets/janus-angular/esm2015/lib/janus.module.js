import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { JanusVideoroomComponent } from './containers/janus-videoroom/janus-videoroom.component';
import { DeviceSelectorComponent } from './containers/device-selector/device-selector.component';
import { AudioBoxComponent } from './components/audio-box/audio-box.component';
import { DefaultVideoRoomComponent } from './components/default-video-room/default-video-room.component';
import { SelfVideoComponent } from './components/self-video/self-video.component';
import { VideoBoxComponent } from './components/video-box/video-box.component';
export class JanusModule {
}
JanusModule.decorators = [
    { type: NgModule, args: [{
                declarations: [
                    JanusVideoroomComponent,
                    DeviceSelectorComponent,
                    AudioBoxComponent,
                    DefaultVideoRoomComponent,
                    SelfVideoComponent,
                    VideoBoxComponent,
                ],
                imports: [
                    ReactiveFormsModule,
                    CommonModule,
                ],
                exports: [
                    JanusVideoroomComponent,
                    DeviceSelectorComponent,
                ]
            },] }
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamFudXMubW9kdWxlLmpzIiwic291cmNlUm9vdCI6Ii4uLy4uLy4uLy4uL3Byb2plY3RzL2phbnVzL3NyYy8iLCJzb3VyY2VzIjpbImxpYi9qYW51cy5tb2R1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUN6QyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFHckQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDakcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDakcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDL0UsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sOERBQThELENBQUM7QUFDekcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDbEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFxQi9FLE1BQU0sT0FBTyxXQUFXOzs7WUFsQnZCLFFBQVEsU0FBQztnQkFDUixZQUFZLEVBQUU7b0JBQ1osdUJBQXVCO29CQUN2Qix1QkFBdUI7b0JBQ3ZCLGlCQUFpQjtvQkFDakIseUJBQXlCO29CQUN6QixrQkFBa0I7b0JBQ2xCLGlCQUFpQjtpQkFDbEI7Z0JBQ0QsT0FBTyxFQUFFO29CQUNQLG1CQUFtQjtvQkFDbkIsWUFBWTtpQkFDYjtnQkFDRCxPQUFPLEVBQUU7b0JBQ1AsdUJBQXVCO29CQUN2Qix1QkFBdUI7aUJBQ3hCO2FBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOZ01vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IFJlYWN0aXZlRm9ybXNNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9mb3Jtcyc7XG5cblxuaW1wb3J0IHsgSmFudXNWaWRlb3Jvb21Db21wb25lbnQgfSBmcm9tICcuL2NvbnRhaW5lcnMvamFudXMtdmlkZW9yb29tL2phbnVzLXZpZGVvcm9vbS5jb21wb25lbnQnO1xuaW1wb3J0IHsgRGV2aWNlU2VsZWN0b3JDb21wb25lbnQgfSBmcm9tICcuL2NvbnRhaW5lcnMvZGV2aWNlLXNlbGVjdG9yL2RldmljZS1zZWxlY3Rvci5jb21wb25lbnQnO1xuaW1wb3J0IHsgQXVkaW9Cb3hDb21wb25lbnQgfSBmcm9tICcuL2NvbXBvbmVudHMvYXVkaW8tYm94L2F1ZGlvLWJveC5jb21wb25lbnQnO1xuaW1wb3J0IHsgRGVmYXVsdFZpZGVvUm9vbUNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50cy9kZWZhdWx0LXZpZGVvLXJvb20vZGVmYXVsdC12aWRlby1yb29tLmNvbXBvbmVudCc7XG5pbXBvcnQgeyBTZWxmVmlkZW9Db21wb25lbnQgfSBmcm9tICcuL2NvbXBvbmVudHMvc2VsZi12aWRlby9zZWxmLXZpZGVvLmNvbXBvbmVudCc7XG5pbXBvcnQgeyBWaWRlb0JveENvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50cy92aWRlby1ib3gvdmlkZW8tYm94LmNvbXBvbmVudCc7XG5cblxuQE5nTW9kdWxlKHtcbiAgZGVjbGFyYXRpb25zOiBbXG4gICAgSmFudXNWaWRlb3Jvb21Db21wb25lbnQsXG4gICAgRGV2aWNlU2VsZWN0b3JDb21wb25lbnQsXG4gICAgQXVkaW9Cb3hDb21wb25lbnQsXG4gICAgRGVmYXVsdFZpZGVvUm9vbUNvbXBvbmVudCxcbiAgICBTZWxmVmlkZW9Db21wb25lbnQsXG4gICAgVmlkZW9Cb3hDb21wb25lbnQsXG4gIF0sXG4gIGltcG9ydHM6IFtcbiAgICBSZWFjdGl2ZUZvcm1zTW9kdWxlLFxuICAgIENvbW1vbk1vZHVsZSxcbiAgXSxcbiAgZXhwb3J0czogW1xuICAgIEphbnVzVmlkZW9yb29tQ29tcG9uZW50LFxuICAgIERldmljZVNlbGVjdG9yQ29tcG9uZW50LFxuICBdXG59KVxuZXhwb3J0IGNsYXNzIEphbnVzTW9kdWxlIHsgfVxuIl19