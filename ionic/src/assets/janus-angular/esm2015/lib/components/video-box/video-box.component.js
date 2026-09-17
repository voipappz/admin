import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewChild, } from '@angular/core';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { JanusService } from '../../services/janus.service';
import { VideoQualityHelper } from './video-quality-helper';
/** @internal */
export class VideoBoxComponent {
    constructor(janusService) {
        this.janusService = janusService;
        this.maximize = new EventEmitter();
        this.requestSubstream = new EventEmitter();
        this.optionsOpen = false;
        this.videoAvailable = false;
        this.destroy$ = new Subject();
        this.videoQualityHelper = new VideoQualityHelper(3);
    }
    get devices() {
        return this.localDevices;
    }
    set devices(devices) {
        this.localDevices = devices;
        this.onDeviceChange(devices);
    }
    ngOnInit() {
        // Set my unique id for the video
        this.videoId = 'video-' + this.remoteFeed.id + this.mode;
        this.setupSubscriptions();
    }
    ngAfterViewInit() {
        this._attachMediaStream();
        this.setSpeaker(this.devices);
    }
    ngOnChanges(changes) {
        if ('remoteFeed' in changes) {
            // If there's a change in the remoteFeed, run the video quality monitor task
            let slowLink = false;
            if (changes.remoteFeed.previousValue
                && changes.remoteFeed.previousValue.slowLink !== changes.remoteFeed.currentValue.slowLink) {
                slowLink = true;
            }
            this.monitorVideoQuality(slowLink);
        }
    }
    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        if (this.video) {
            this.video.nativeElement.pause();
        }
    }
    setupSubscriptions() {
        interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.monitorVideoQuality(false);
        });
    }
    _attachMediaStream() {
        this.janusService.attachMediaStream(this.videoId, this.remoteFeed.streamId);
    }
    setSpeaker(devices) {
        // Given the devices, set the output sound device
        if (this.video
            && this.video.nativeElement
            && this.video.nativeElement.setSinkId
            && devices
            && devices.speakerDeviceId) {
            this.video.nativeElement.setSinkId(devices.speakerDeviceId);
        }
    }
    onPlay() {
        this.videoAvailable = true;
    }
    monitorVideoQuality(slowLink) {
        // Periodic task to monitor the video quality and change substream if necessary
        if (!this.remoteFeed) {
            // If we don't have a remoteFeed, nothing we can do here
            return;
        }
        if (!this.videoAvailable && this.video) {
            // Sometimes this needs a kick start. For example, if the user takes a second to click
            // the "allow" button for video/mic access, the autoplay on the video element won't
            // actually autoplay
            this.video.nativeElement.play();
        }
        const currentSubstream = this.remoteFeed.currentSubstream;
        if (this.remoteFeed.numVideoTracks === 0 || slowLink) {
            this.videoQualityHelper.streamError(currentSubstream);
            if (currentSubstream > 0) {
                this.switchSubstream(currentSubstream - 1);
            }
        }
        else {
            const newSubstream = this.videoQualityHelper.ping(currentSubstream);
            if (newSubstream > currentSubstream) {
                this.videoQualityHelper.streamEnd(currentSubstream);
                this.switchSubstream(newSubstream);
            }
        }
    }
    switchSubstream(substreamId) {
        // Switch the substream if we haven't already requested this substream
        if (this.remoteFeed.requestedSubstream !== substreamId) {
            console.log('switching substream', substreamId, this.videoId);
            this.requestSubstream.emit({ feed: this.remoteFeed, substreamId });
        }
    }
    onMaximize() {
        this.maximize.emit(this.remoteFeed);
    }
    onDeviceChange(devices) {
        this.setSpeaker(devices);
    }
}
VideoBoxComponent.decorators = [
    { type: Component, args: [{
                selector: 'janus-video-box',
                template: "<div class='video-container'>\n  <div class='interior-box'>\n    <video\n      #videoElement\n      id='{{videoId}}'\n      autoplay\n      playsinline\n      (play)='onPlay()'\n    ></video>\n\n    <div\n      *ngIf=\"remoteFeed.displayName\"\n      data-cy='video-box-display-name'\n      class='overlay display-name'>\n      {{ remoteFeed.displayName }}\n    </div>\n\n    <div\n      data-cy='video-box-maximize-button'\n      class='overlay maximize'\n      (click)='onMaximize()' \n      >\n\n      <i\n        *ngIf='mode === \"grid\"'\n        class=\"fas fa-expand\"\n        matTooltip=\"Show Full Size\">\n      </i>\n\n      <i\n        *ngIf='mode === \"speaker\"'\n        class=\"fas fa-compress\"\n        matTooltip=\"Show All Speakers\">\n      </i>\n    </div>\n\n    <div \n      *ngIf='!videoAvailable'\n      class='loading-blocker'>\n      <p> Loading... </p>\n    </div>\n  </div>\n</div>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                styles: ["div.display-name{display:flex;z-index:1}div.display-name span.separator{margin:0 5px 0 10px}div.display-name i.fas{cursor:pointer;font-size:14px;margin:0 5px}div.maximize{cursor:pointer;left:auto!important;right:1px;z-index:1}", "div.video-container{height:100%}div.video-container canvas,div.video-container video{-o-object-fit:fill;display:block;font-size:0;height:100%;object-fit:fill;width:100%}div.video-container canvas{transform:scaleX(-1)}div.video-container div.interior-box{border:1px solid rgba(0,0,0,.5);height:100%;position:relative}div.video-container div.self{border:1px solid #8ae010}div.video-container div.overlay{background-color:rgba(53,53,53,.7);color:#fff;font-family:OpenSans;font-size:16px;font-stretch:normal;font-style:normal;font-weight:600;left:1px;letter-spacing:-.24px;line-height:normal;padding:5px;position:absolute;top:1px}div.loading-blocker{align-items:center;background-color:hsla(0,0%,100%,.85);display:flex;height:100%;justify-content:center;left:0;position:absolute;top:0;width:100%}div.loading-blocker p{color:#777;font-size:24px}"]
            },] }
];
VideoBoxComponent.ctorParameters = () => [
    { type: JanusService }
];
VideoBoxComponent.propDecorators = {
    remoteFeed: [{ type: Input }],
    mode: [{ type: Input }],
    devices: [{ type: Input }],
    maximize: [{ type: Output }],
    requestSubstream: [{ type: Output }],
    video: [{ type: ViewChild, args: ['videoElement',] }]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlkZW8tYm94LmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLi8uLi8uLi9wcm9qZWN0cy9qYW51cy9zcmMvIiwic291cmNlcyI6WyJsaWIvY29tcG9uZW50cy92aWRlby1ib3gvdmlkZW8tYm94LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxPQUFPLEVBRUwsdUJBQXVCLEVBQ3ZCLFNBQVMsRUFFVCxZQUFZLEVBQ1osS0FBSyxFQUlMLE1BQU0sRUFDTixTQUFTLEdBQ1YsTUFBTSxlQUFlLENBQUM7QUFFdkIsT0FBTyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQWEsTUFBTSxNQUFNLENBQUM7QUFDcEQsT0FBTyxFQUFTLFNBQVMsRUFBWSxNQUFNLGdCQUFnQixDQUFDO0FBSTVELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUU1RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUc1RCxnQkFBZ0I7QUFVaEIsTUFBTSxPQUFPLGlCQUFpQjtJQThCNUIsWUFDVSxZQUEwQjtRQUExQixpQkFBWSxHQUFaLFlBQVksQ0FBYztRQWpCcEMsYUFBUSxHQUFHLElBQUksWUFBWSxFQUFjLENBQUM7UUFHMUMscUJBQWdCLEdBQUcsSUFBSSxZQUFZLEVBQTJDLENBQUM7UUFHeEUsZ0JBQVcsR0FBRyxLQUFLLENBQUM7UUFDcEIsbUJBQWMsR0FBRyxLQUFLLENBQUM7UUFLdEIsYUFBUSxHQUFHLElBQUksT0FBTyxFQUFFLENBQUM7UUFPL0IsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQTlCRCxJQUNJLE9BQU87UUFDVCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUM7SUFDM0IsQ0FBQztJQUNELElBQUksT0FBTyxDQUFDLE9BQWdCO1FBQzFCLElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDO1FBQzVCLElBQUks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SzttQkFDTCxLQUFLO3NCQUNMLEtBQUs7dUJBU0wsTUFBTTsrQkFHTixNQUFNO29CQVlOLFNBQVMsU0FBQyxjQUFjIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgbW9tZW50IGZyb20gJ21vbWVudCc7XG5cbmltcG9ydCB7XG4gIEFmdGVyVmlld0luaXQsXG4gIENoYW5nZURldGVjdGlvblN0cmF0ZWd5LFxuICBDb21wb25lbnQsXG4gIEVsZW1lbnRSZWYsXG4gIEV2ZW50RW1pdHRlcixcbiAgSW5wdXQsXG4gIE9uRGVzdHJveSxcbiAgT25Jbml0LFxuICBPbkNoYW5nZXMsXG4gIE91dHB1dCxcbiAgVmlld0NoaWxkLFxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcblxuaW1wb3J0IHsgU3ViamVjdCwgaW50ZXJ2YWwsIGZyb21FdmVudCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgZmlyc3QsIHRha2VVbnRpbCwgZGVib3VuY2UgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5cbmltcG9ydCB7IFJlbW90ZUZlZWQsIEphbnVzUm9sZSwgRGV2aWNlcyB9IGZyb20gJy4uLy4uL21vZGVscy9qYW51cy5tb2RlbHMnO1xuaW1wb3J0IHsgcmFuZG9tU3RyaW5nIH0gZnJvbSAnLi4vLi4vc2hhcmVkJztcbmltcG9ydCB7IEphbnVzU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2phbnVzLnNlcnZpY2UnO1xuXG5pbXBvcnQgeyBWaWRlb1F1YWxpdHlIZWxwZXIgfSBmcm9tICcuL3ZpZGVvLXF1YWxpdHktaGVscGVyJztcblxuXG4vKiogQGludGVybmFsICovXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICdqYW51cy12aWRlby1ib3gnLFxuICB0ZW1wbGF0ZVVybDogJy4vdmlkZW8tYm94LmNvbXBvbmVudC5odG1sJyxcbiAgc3R5bGVVcmxzOiBbXG4gICAgJy4vdmlkZW8tYm94LmNvbXBvbmVudC5zY3NzJyxcbiAgICAnLi4vLi4vc3R5bGVzL3ZpZGVvLXN0eWxlcy5zY3NzJyxcbiAgXSxcbiAgY2hhbmdlRGV0ZWN0aW9uOiBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5PblB1c2hcbn0pXG5leHBvcnQgY2xhc3MgVmlkZW9Cb3hDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIE9uQ2hhbmdlcywgT25EZXN0cm95LCBBZnRlclZpZXdJbml0IHtcblxuICBASW5wdXQoKSByZW1vdGVGZWVkOiBSZW1vdGVGZWVkO1xuICBASW5wdXQoKSBtb2RlOiAnc3BlYWtlcicgfCAnZ3JpZCc7XG4gIEBJbnB1dCgpXG4gIGdldCBkZXZpY2VzKCk6IERldmljZXMge1xuICAgIHJldHVybiB0aGlzLmxvY2FsRGV2aWNlcztcbiAgfVxuICBzZXQgZGV2aWNlcyhkZXZpY2VzOiBEZXZpY2VzKSB7XG4gICAgdGhpcy5sb2NhbERldmljZXMgPSBkZXZpY2VzO1xuICAgIHRoaXMub25EZXZpY2VDaGFuZ2UoZGV2aWNlcyk7XG4gIH1cblxuICBAT3V0cHV0KClcbiAgbWF4aW1pemUgPSBuZXcgRXZlbnRFbWl0dGVyPFJlbW90ZUZlZWQ+KCk7XG5cbiAgQE91dHB1dCgpXG4gIHJlcXVlc3RTdWJzdHJlYW0gPSBuZXcgRXZlbnRFbWl0dGVyPHtmZWVkOiBSZW1vdGVGZWVkLCBzdWJzdHJlYW1JZDogbnVtYmVyfT4oKTtcblxuICBwdWJsaWMgdmlkZW9JZDogc3RyaW5nO1xuICBwdWJsaWMgb3B0aW9uc09wZW4gPSBmYWxzZTtcbiAgcHVibGljIHZpZGVvQXZhaWxhYmxlID0gZmFsc2U7XG5cbiAgdmlkZW9RdWFsaXR5SGVscGVyOiBWaWRlb1F1YWxpdHlIZWxwZXI7IC8vIHB1YmxpYyBmb3IgdGVzdGluZyBwdXJwb3Nlc1xuXG4gIHByaXZhdGUgbG9jYWxEZXZpY2VzOiBEZXZpY2VzO1xuICBwcml2YXRlIGRlc3Ryb3kkID0gbmV3IFN1YmplY3QoKTtcblxuICBAVmlld0NoaWxkKCd2aWRlb0VsZW1lbnQnKSB2aWRlbzogRWxlbWVudFJlZjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGphbnVzU2VydmljZTogSmFudXNTZXJ2aWNlXG4gICkge1xuICAgIHRoaXMudmlkZW9RdWFsaXR5SGVscGVyID0gbmV3IFZpZGVvUXVhbGl0eUhlbHBlcigzKTtcbiAgfVxuXG4gIG5nT25Jbml0KCk6IHZvaWQge1xuICAgIC8vIFNldCBteSB1bmlxdWUgaWQgZm9yIHRoZSB2aWRlb1xuICAgIHRoaXMudmlkZW9JZCA9ICd2aWRlby0nICsgdGhpcy5yZW1vdGVGZWVkLmlkICsgdGhpcy5tb2RlO1xuICAgIHRoaXMuc2V0dXBTdWJzY3JpcHRpb25zKCk7XG4gIH1cblxuICBuZ0FmdGVyVmlld0luaXQoKTogdm9pZCB7XG4gICAgdGhpcy5fYXR0YWNoTWVkaWFTdHJlYW0oKTtcbiAgICB0aGlzLnNldFNwZWFrZXIodGhpcy5kZXZpY2VzKTtcbiAgfVxuXG4gIG5nT25DaGFuZ2VzKGNoYW5nZXMpOiB2b2lkIHtcbiAgICBpZiAoJ3JlbW90ZUZlZWQnIGluIGNoYW5nZXMpIHtcbiAgICAgIC8vIElmIHRoZXJlJ3MgYSBjaGFuZ2UgaW4gdGhlIHJlbW90ZUZlZWQsIHJ1biB0aGUgdmlkZW8gcXVhbGl0eSBtb25pdG9yIHRhc2tcbiAgICAgIGxldCBzbG93TGluayA9IGZhbHNlO1xuXG4gICAgICBpZiAoXG4gICAgICAgIGNoYW5nZXMucmVtb3RlRmVlZC5wcmV2aW91c1ZhbHVlXG4gICAgICAgICYmIGNoYW5nZXMucmVtb3RlRmVlZC5wcmV2aW91c1ZhbHVlLnNsb3dMaW5rICE9PSBjaGFuZ2VzLnJlbW90ZUZlZWQuY3VycmVudFZhbHVlLnNsb3dMaW5rXG4gICAgICApIHtcbiAgICAgICAgc2xvd0xpbmsgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICB0aGlzLm1vbml0b3JWaWRlb1F1YWxpdHkoc2xvd0xpbmspO1xuICAgIH1cbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuZGVzdHJveSQubmV4dCgpO1xuICAgIHRoaXMuZGVzdHJveSQuY29tcGxldGUoKTtcbiAgICBpZiAodGhpcy52aWRlbykge1xuICAgICAgdGhpcy52aWRlby5uYXRpdmVFbGVtZW50LnBhdXNlKCk7XG4gICAgfVxuICB9XG5cbiAgc2V0dXBTdWJzY3JpcHRpb25zKCk6IHZvaWQge1xuICAgIGludGVydmFsKDEwMDApLnBpcGUoXG4gICAgICB0YWtlVW50aWwodGhpcy5kZXN0cm95JClcbiAgICApLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICB0aGlzLm1vbml0b3JWaWRlb1F1YWxpdHkoZmFsc2UpO1xuICAgIH0pO1xuICB9XG5cbiAgX2F0dGFjaE1lZGlhU3RyZWFtKCk6IHZvaWQge1xuICAgIHRoaXMuamFudXNTZXJ2aWNlLmF0dGFjaE1lZGlhU3RyZWFtKHRoaXMudmlkZW9JZCwgdGhpcy5yZW1vdGVGZWVkLnN0cmVhbUlkKTtcbiAgfVxuXG4gIHByaXZhdGUgc2V0U3BlYWtlcihkZXZpY2VzOiBEZXZpY2VzKTogdm9pZCB7XG4gICAgLy8gR2l2ZW4gdGhlIGRldmljZXMsIHNldCB0aGUgb3V0cHV0IHNvdW5kIGRldmljZVxuICAgIGlmIChcbiAgICAgIHRoaXMudmlkZW9cbiAgICAgICYmIHRoaXMudmlkZW8ubmF0aXZlRWxlbWVudFxuICAgICAgJiYgdGhpcy52aWRlby5uYXRpdmVFbGVtZW50LnNldFNpbmtJZFxuICAgICAgJiYgZGV2aWNlc1xuICAgICAgJiYgZGV2aWNlcy5zcGVha2VyRGV2aWNlSWRcbiAgICApIHtcbiAgICAgIHRoaXMudmlkZW8ubmF0aXZlRWxlbWVudC5zZXRTaW5rSWQoZGV2aWNlcy5zcGVha2VyRGV2aWNlSWQpO1xuICAgIH1cbiAgfVxuXG4gIG9uUGxheSgpOiB2b2lkIHtcbiAgICB0aGlzLnZpZGVvQXZhaWxhYmxlID0gdHJ1ZTtcbiAgfVxuXG4gIG1vbml0b3JWaWRlb1F1YWxpdHkoc2xvd0xpbms6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICAvLyBQZXJpb2RpYyB0YXNrIHRvIG1vbml0b3IgdGhlIHZpZGVvIHF1YWxpdHkgYW5kIGNoYW5nZSBzdWJzdHJlYW0gaWYgbmVjZXNzYXJ5XG5cbiAgICBpZiAoIXRoaXMucmVtb3RlRmVlZCkge1xuICAgICAgLy8gSWYgd2UgZG9uJ3QgaGF2ZSBhIHJlbW90ZUZlZWQsIG5vdGhpbmcgd2UgY2FuIGRvIGhlcmVcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMudmlkZW9BdmFpbGFibGUgJiYgdGhpcy52aWRlbykge1xuICAgICAgLy8gU29tZXRpbWVzIHRoaXMgbmVlZHMgYSBraWNrIHN0YXJ0LiBGb3IgZXhhbXBsZSwgaWYgdGhlIHVzZXIgdGFrZXMgYSBzZWNvbmQgdG8gY2xpY2tcbiAgICAgIC8vIHRoZSBcImFsbG93XCIgYnV0dG9uIGZvciB2aWRlby9taWMgYWNjZXNzLCB0aGUgYXV0b3BsYXkgb24gdGhlIHZpZGVvIGVsZW1lbnQgd29uJ3RcbiAgICAgIC8vIGFjdHVhbGx5IGF1dG9wbGF5XG4gICAgICB0aGlzLnZpZGVvLm5hdGl2ZUVsZW1lbnQucGxheSgpO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnJlbnRTdWJzdHJlYW0gPSB0aGlzLnJlbW90ZUZlZWQuY3VycmVudFN1YnN0cmVhbTtcbiAgICBpZiAodGhpcy5yZW1vdGVGZWVkLm51bVZpZGVvVHJhY2tzID09PSAwIHx8IHNsb3dMaW5rKSB7XG4gICAgICB0aGlzLnZpZGVvUXVhbGl0eUhlbHBlci5zdHJlYW1FcnJvcihjdXJyZW50U3Vic3RyZWFtKTtcbiAgICAgIGlmIChjdXJyZW50U3Vic3RyZWFtID4gMCkge1xuICAgICAgICB0aGlzLnN3aXRjaFN1YnN0cmVhbShjdXJyZW50U3Vic3RyZWFtIC0gMSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld1N1YnN0cmVhbSA9IHRoaXMudmlkZW9RdWFsaXR5SGVscGVyLnBpbmcoY3VycmVudFN1YnN0cmVhbSk7XG4gICAgICBpZiAobmV3U3Vic3RyZWFtID4gY3VycmVudFN1YnN0cmVhbSkge1xuICAgICAgICB0aGlzLnZpZGVvUXVhbGl0eUhlbHBlci5zdHJlYW1FbmQoY3VycmVudFN1YnN0cmVhbSk7XG4gICAgICAgIHRoaXMuc3dpdGNoU3Vic3RyZWFtKG5ld1N1YnN0cmVhbSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3dpdGNoU3Vic3RyZWFtKHN1YnN0cmVhbUlkOiBudW1iZXIpOiB2b2lkIHtcbiAgICAvLyBTd2l0Y2ggdGhlIHN1YnN0cmVhbSBpZiB3ZSBoYXZlbid0IGFscmVhZHkgcmVxdWVzdGVkIHRoaXMgc3Vic3RyZWFtXG4gICAgaWYgKHRoaXMucmVtb3RlRmVlZC5yZXF1ZXN0ZWRTdWJzdHJlYW0gIT09IHN1YnN0cmVhbUlkKSB7XG4gICAgICBjb25zb2xlLmxvZygnc3dpdGNoaW5nIHN1YnN0cmVhbScsIHN1YnN0cmVhbUlkLCB0aGlzLnZpZGVvSWQpO1xuICAgICAgdGhpcy5yZXF1ZXN0U3Vic3RyZWFtLmVtaXQoe2ZlZWQ6IHRoaXMucmVtb3RlRmVlZCwgc3Vic3RyZWFtSWR9KTtcbiAgICB9XG4gIH1cblxuICBvbk1heGltaXplKCk6IHZvaWQge1xuICAgIHRoaXMubWF4aW1pemUuZW1pdCh0aGlzLnJlbW90ZUZlZWQpO1xuICB9XG5cbiAgb25EZXZpY2VDaGFuZ2UoZGV2aWNlczogRGV2aWNlcyk6IHZvaWQge1xuICAgIHRoaXMuc2V0U3BlYWtlcihkZXZpY2VzKTtcbiAgfVxufVxuIl19