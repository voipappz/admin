import { __awaiter } from "tslib";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RoomInfoState, PublishState, } from '../../models/janus.models';
/** @internal
 *
 * Minor dragons:
 * publishOwnFeed won't work unless we know the devices **and** the canvas element already exists.
 * Therefore, the first call to publishOwnFeed comes in ngAfterViewInit. After the first publish, we
 * can adjust the devices in onDevicesChange.
 */
export class SelfVideoComponent {
    constructor() {
        this.publishOwnFeed = new EventEmitter();
        this.devicesInitialized = false;
        this.afterViewInitRan = false;
    }
    get devices() { return this.currentDevices; }
    set devices(devices) {
        this.onDevicesChange(this.currentDevices, devices);
        this.currentDevices = devices;
    }
    ngOnInit() { }
    ngAfterViewInit() {
        return __awaiter(this, void 0, void 0, function* () {
            // Attach the canvas-self element
            this.afterViewInitRan = true;
            if (this.roomInfo.state !== RoomInfoState.joined) {
                throw new Error('RoomInfo.state must be "joined" before creating a self-video component');
            }
            const audioDeviceId = this.devices ? this.devices.audioDeviceId : null;
            const videoDeviceId = this.devices ? this.devices.videoDeviceId : null;
            this._publishOwnFeed(audioDeviceId, videoDeviceId);
        });
    }
    _publishOwnFeed(audioDeviceId, videoDeviceId) {
        // Separate this for testing
        this.publishOwnFeed.emit({
            audioDeviceId,
            videoDeviceId,
            canvasId: 'canvas-self',
        });
    }
    onDevicesChange(previousDevices, newDevices) {
        if (!newDevices) {
            return;
        }
        if (!this.afterViewInitRan) {
            // Haven't loaded yet
            return;
        }
        if (newDevices
            && previousDevices
            && newDevices.videoDeviceId === previousDevices.videoDeviceId
            && newDevices.audioDeviceId === previousDevices.audioDeviceId) {
            // Same capture devices. nothing to do here
            return;
        }
        // There still exists a tiny race condition here. If the user changes the deviceId between a publishOwnFeed
        // call in ngAfterViewInit and before the publish is complete, that change won't be registered :/
        if (this.roomInfo.publishState === PublishState.publishRequested) {
            return;
        }
        this._publishOwnFeed(newDevices.audioDeviceId, newDevices.videoDeviceId);
    }
}
SelfVideoComponent.decorators = [
    { type: Component, args: [{
                selector: 'janus-self-video',
                template: "<div class='video-container'>\n  <div class='interior-box self'>\n    <canvas id='canvas-self'></canvas>\n  </div>\n</div>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                styles: ["ul.filter-list{margin:0;padding:0}ul.filter-list li{display:block}ul.filter-list img.active{border:1px solid #fff}ul.filter-list img:hover{border:1px solid #ccc}div.filter-box{padding:2px!important}div.filter-box img{border:1px solid transparent;border-radius:5px;cursor:pointer;height:25px;padding:3px;width:25px}", "div.video-container{height:100%}div.video-container canvas,div.video-container video{-o-object-fit:fill;display:block;font-size:0;height:100%;object-fit:fill;width:100%}div.video-container canvas{transform:scaleX(-1)}div.video-container div.interior-box{border:1px solid rgba(0,0,0,.5);height:100%;position:relative}div.video-container div.self{border:1px solid #8ae010}div.video-container div.overlay{background-color:rgba(53,53,53,.7);color:#fff;font-family:OpenSans;font-size:16px;font-stretch:normal;font-style:normal;font-weight:600;left:1px;letter-spacing:-.24px;line-height:normal;padding:5px;position:absolute;top:1px}div.loading-blocker{align-items:center;background-color:hsla(0,0%,100%,.85);display:flex;height:100%;justify-content:center;left:0;position:absolute;top:0;width:100%}div.loading-blocker p{color:#777;font-size:24px}"]
            },] }
];
SelfVideoComponent.ctorParameters = () => [];
SelfVideoComponent.propDecorators = {
    roomInfo: [{ type: Input }],
    devices: [{ type: Input }],
    publishOwnFeed: [{ type: Output }]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VsZi12aWRlby5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiLi4vLi4vLi4vLi4vcHJvamVjdHMvamFudXMvc3JjLyIsInNvdXJjZXMiOlsibGliL2NvbXBvbmVudHMvc2VsZi12aWRlby9zZWxmLXZpZGVvLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxFQUVMLHVCQUF1QixFQUN2QixTQUFTLEVBQ1QsWUFBWSxFQUNaLEtBQUssRUFFTCxNQUFNLEVBQ1AsTUFBTSxlQUFlLENBQUM7QUFFdkIsT0FBTyxFQUVMLGFBQWEsRUFDYixZQUFZLEdBRWIsTUFBTSwyQkFBMkIsQ0FBQztBQUluQzs7Ozs7O0dBTUc7QUFVSCxNQUFNLE9BQU8sa0JBQWtCO0lBa0I3QjtRQU5BLG1CQUFjLEdBQUcsSUFBSSxZQUFZLEVBQXlCLENBQUM7UUFHbkQsdUJBQWtCLEdBQUcsS0FBSyxDQUFDO1FBQzNCLHFCQUFnQixHQUFHLEtBQUssQ0FBQztJQUVqQixDQUFDO0lBZGpCLElBQ0ksT0FBTyxLQUFjLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7SUFDdEQsSUFBSSxPQUFPLENBQUMsT0FBTztRQUNqQixJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDbkQsSUFBSSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUM7SUFDaEMsQ0FBQztJQVdELFFBQVEsS0FBVyxDQUFDO0lBRWQsZUFBZTs7WUFDbkIsaUNBQWlDO1lBQ2pDLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7WUFDN0IsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssS0FBSyxhQUFhLENBQUMsTUFBTSxFQUFFO2dCQUNoRCxNQUFNLElBQUksS0FBSyxDQUFDLHdFQUF3RSxDQUFDLENBQUM7YUFDM0Y7WUFFRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ3ZFLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDdkUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxhQUFhLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDckQsQ0FBQztLQUFBO0lBRUQsZUFBZSxDQUFDLGFBQXFCLEVBQUUsYUFBcUI7UUFDMUQsNEJBQTRCO1FBQzVCLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDO1lBQ3ZCLGFBQWE7WUFDYixhQUFhO1lBQ2IsUUFBUSxFQUFFLGFBQWE7U0FDeEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELGVBQWUsQ0FBQyxlQUF3QixFQUFFLFVBQW1CO1FBQzNELElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDZixPQUFPO1NBQ1I7UUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFO1lBQzFCLHFCQUFxQjtZQUNyQixPQUFPO1NBQ1I7UUFFRCxJQUNFLFVBQVU7ZUFDUCxlQUFlO2VBQ2YsVUFBVSxDQUFDLGFBQWEsS0FBSyxlQUFlLENBQUMsYUFBYTtlQUMxRCxVQUFVLENBQUMsYUFBYSxLQUFLLGVBQWUsQ0FBQyxhQUFhLEVBQzdEO1lBQ0EsMkNBQTJDO1lBQzNDLE9BQU87U0FDUjtRQUVELDJHQUEyRztRQUMzRyxpR0FBaUc7UUFDakcsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksS0FBSyxZQUFZLENBQUMsZ0JBQWdCLEVBQUU7WUFDaEUsT0FBTztTQUNSO1FBQ0QsSUFBSSxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsYUFBYSxFQUFFLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUMzRSxDQUFDOzs7WUE5RUYsU0FBUyxTQUFDO2dCQUNULFFBQVEsRUFBRSxrQkFBa0I7Z0JBQzVCLHdJQUEwQztnQkFLMUMsZUFBZSxFQUFFLHVCQUF1QixDQUFDLE1BQU07O2FBQ2hEOzs7O3VCQUdFLEtBQUs7c0JBRUwsS0FBSzs2QkFPTCxNQUFNIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgQWZ0ZXJWaWV3SW5pdCxcbiAgQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksXG4gIENvbXBvbmVudCxcbiAgRXZlbnRFbWl0dGVyLFxuICBJbnB1dCxcbiAgT25Jbml0LFxuICBPdXRwdXRcbn0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5cbmltcG9ydCB7XG4gIFJvb21JbmZvLFxuICBSb29tSW5mb1N0YXRlLFxuICBQdWJsaXNoU3RhdGUsXG4gIERldmljZXMsXG59IGZyb20gJy4uLy4uL21vZGVscy9qYW51cy5tb2RlbHMnO1xuXG5pbXBvcnQgeyBQdWJsaXNoT3duRmVlZFBheWxvYWQgfSBmcm9tICcuLi8uLi9zdG9yZS9hY3Rpb25zL2phbnVzLmFjdGlvbnMnO1xuXG4vKiogQGludGVybmFsXG4gKlxuICogTWlub3IgZHJhZ29uczpcbiAqIHB1Ymxpc2hPd25GZWVkIHdvbid0IHdvcmsgdW5sZXNzIHdlIGtub3cgdGhlIGRldmljZXMgKiphbmQqKiB0aGUgY2FudmFzIGVsZW1lbnQgYWxyZWFkeSBleGlzdHMuXG4gKiBUaGVyZWZvcmUsIHRoZSBmaXJzdCBjYWxsIHRvIHB1Ymxpc2hPd25GZWVkIGNvbWVzIGluIG5nQWZ0ZXJWaWV3SW5pdC4gQWZ0ZXIgdGhlIGZpcnN0IHB1Ymxpc2gsIHdlXG4gKiBjYW4gYWRqdXN0IHRoZSBkZXZpY2VzIGluIG9uRGV2aWNlc0NoYW5nZS5cbiAqL1xuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnamFudXMtc2VsZi12aWRlbycsXG4gIHRlbXBsYXRlVXJsOiAnLi9zZWxmLXZpZGVvLmNvbXBvbmVudC5odG1sJyxcbiAgc3R5bGVVcmxzOiBbXG4gICAgJy4vc2VsZi12aWRlby5jb21wb25lbnQuc2NzcycsXG4gICAgJy4uLy4uL3N0eWxlcy92aWRlby1zdHlsZXMuc2NzcycsXG4gIF0sXG4gIGNoYW5nZURldGVjdGlvbjogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuT25QdXNoXG59KVxuZXhwb3J0IGNsYXNzIFNlbGZWaWRlb0NvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgQWZ0ZXJWaWV3SW5pdCB7XG5cbiAgQElucHV0KCkgcm9vbUluZm86IFJvb21JbmZvO1xuXG4gIEBJbnB1dCgpXG4gIGdldCBkZXZpY2VzKCk6IERldmljZXMgeyByZXR1cm4gdGhpcy5jdXJyZW50RGV2aWNlczsgfVxuICBzZXQgZGV2aWNlcyhkZXZpY2VzKSB7XG4gICAgdGhpcy5vbkRldmljZXNDaGFuZ2UodGhpcy5jdXJyZW50RGV2aWNlcywgZGV2aWNlcyk7XG4gICAgdGhpcy5jdXJyZW50RGV2aWNlcyA9IGRldmljZXM7XG4gIH1cblxuICBAT3V0cHV0KClcbiAgcHVibGlzaE93bkZlZWQgPSBuZXcgRXZlbnRFbWl0dGVyPFB1Ymxpc2hPd25GZWVkUGF5bG9hZD4oKTtcblxuICBwcml2YXRlIGN1cnJlbnREZXZpY2VzOiBEZXZpY2VzO1xuICBwcml2YXRlIGRldmljZXNJbml0aWFsaXplZCA9IGZhbHNlO1xuICBwcml2YXRlIGFmdGVyVmlld0luaXRSYW4gPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcigpIHsgfVxuXG4gIG5nT25Jbml0KCk6IHZvaWQgeyB9XG5cbiAgYXN5bmMgbmdBZnRlclZpZXdJbml0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIEF0dGFjaCB0aGUgY2FudmFzLXNlbGYgZWxlbWVudFxuICAgIHRoaXMuYWZ0ZXJWaWV3SW5pdFJhbiA9IHRydWU7XG4gICAgaWYgKHRoaXMucm9vbUluZm8uc3RhdGUgIT09IFJvb21JbmZvU3RhdGUuam9pbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Jvb21JbmZvLnN0YXRlIG11c3QgYmUgXCJqb2luZWRcIiBiZWZvcmUgY3JlYXRpbmcgYSBzZWxmLXZpZGVvIGNvbXBvbmVudCcpO1xuICAgIH1cblxuICAgIGNvbnN0IGF1ZGlvRGV2aWNlSWQgPSB0aGlzLmRldmljZXMgPyB0aGlzLmRldmljZXMuYXVkaW9EZXZpY2VJZCA6IG51bGw7XG4gICAgY29uc3QgdmlkZW9EZXZpY2VJZCA9IHRoaXMuZGV2aWNlcyA/IHRoaXMuZGV2aWNlcy52aWRlb0RldmljZUlkIDogbnVsbDtcbiAgICB0aGlzLl9wdWJsaXNoT3duRmVlZChhdWRpb0RldmljZUlkLCB2aWRlb0RldmljZUlkKTtcbiAgfVxuXG4gIF9wdWJsaXNoT3duRmVlZChhdWRpb0RldmljZUlkOiBzdHJpbmcsIHZpZGVvRGV2aWNlSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIFNlcGFyYXRlIHRoaXMgZm9yIHRlc3RpbmdcbiAgICB0aGlzLnB1Ymxpc2hPd25GZWVkLmVtaXQoe1xuICAgICAgYXVkaW9EZXZpY2VJZCxcbiAgICAgIHZpZGVvRGV2aWNlSWQsXG4gICAgICBjYW52YXNJZDogJ2NhbnZhcy1zZWxmJyxcbiAgICB9KTtcbiAgfVxuXG4gIG9uRGV2aWNlc0NoYW5nZShwcmV2aW91c0RldmljZXM6IERldmljZXMsIG5ld0RldmljZXM6IERldmljZXMpOiB2b2lkIHtcbiAgICBpZiAoIW5ld0RldmljZXMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuYWZ0ZXJWaWV3SW5pdFJhbikge1xuICAgICAgLy8gSGF2ZW4ndCBsb2FkZWQgeWV0XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgbmV3RGV2aWNlc1xuICAgICAgJiYgcHJldmlvdXNEZXZpY2VzXG4gICAgICAmJiBuZXdEZXZpY2VzLnZpZGVvRGV2aWNlSWQgPT09IHByZXZpb3VzRGV2aWNlcy52aWRlb0RldmljZUlkXG4gICAgICAmJiBuZXdEZXZpY2VzLmF1ZGlvRGV2aWNlSWQgPT09IHByZXZpb3VzRGV2aWNlcy5hdWRpb0RldmljZUlkXG4gICAgKSB7XG4gICAgICAvLyBTYW1lIGNhcHR1cmUgZGV2aWNlcy4gbm90aGluZyB0byBkbyBoZXJlXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVGhlcmUgc3RpbGwgZXhpc3RzIGEgdGlueSByYWNlIGNvbmRpdGlvbiBoZXJlLiBJZiB0aGUgdXNlciBjaGFuZ2VzIHRoZSBkZXZpY2VJZCBiZXR3ZWVuIGEgcHVibGlzaE93bkZlZWRcbiAgICAvLyBjYWxsIGluIG5nQWZ0ZXJWaWV3SW5pdCBhbmQgYmVmb3JlIHRoZSBwdWJsaXNoIGlzIGNvbXBsZXRlLCB0aGF0IGNoYW5nZSB3b24ndCBiZSByZWdpc3RlcmVkIDovXG4gICAgaWYgKHRoaXMucm9vbUluZm8ucHVibGlzaFN0YXRlID09PSBQdWJsaXNoU3RhdGUucHVibGlzaFJlcXVlc3RlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLl9wdWJsaXNoT3duRmVlZChuZXdEZXZpY2VzLmF1ZGlvRGV2aWNlSWQsIG5ld0RldmljZXMudmlkZW9EZXZpY2VJZCk7XG4gIH1cbn1cbiJdfQ==