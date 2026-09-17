import { Component, Input, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { JanusService } from '../../services/janus.service';
/** @internal */
export class AudioBoxComponent {
    constructor(janusService) {
        this.janusService = janusService;
    }
    get devices() {
        return this.localDevices;
    }
    set devices(devices) {
        this.onDeviceChange(devices);
        this.localDevices = devices;
    }
    ngOnInit() {
        // Set my unique id for the audio
        const instance = this;
        this.audioId = 'audio-' + this.remoteFeed.id;
    }
    ngAfterViewInit() {
        this.janusService.attachMediaStream(this.audioId, this.remoteFeed.streamId);
    }
    setSpeaker(devices) {
        if (this.audio
            && this.audio.nativeElement
            && this.audio.nativeElement.setSinkId
            && devices
            && devices.speakerDeviceId) {
            this.audio.nativeElement.setSinkId(devices.speakerDeviceId);
        }
    }
    onDeviceChange(devices) {
        this.setSpeaker(devices);
    }
}
AudioBoxComponent.decorators = [
    { type: Component, args: [{
                selector: 'janus-nvid-audio-box',
                template: "<audio\n  #audioElement\n  id='{{audioId}}'\n  autoplay\n></audio>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                styles: [""]
            },] }
];
AudioBoxComponent.ctorParameters = () => [
    { type: JanusService }
];
AudioBoxComponent.propDecorators = {
    remoteFeed: [{ type: Input }],
    devices: [{ type: Input }],
    audio: [{ type: ViewChild, args: ['audioElement',] }]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW8tYm94LmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLi8uLi8uLi9wcm9qZWN0cy9qYW51cy9zcmMvIiwic291cmNlcyI6WyJsaWIvY29tcG9uZW50cy9hdWRpby1ib3gvYXVkaW8tYm94LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQWlCLFNBQVMsRUFBRSxLQUFLLEVBQVUsdUJBQXVCLEVBQUUsU0FBUyxFQUFjLE1BQU0sZUFBZSxDQUFDO0FBR3hILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUU1RCxnQkFBZ0I7QUFPaEIsTUFBTSxPQUFPLGlCQUFpQjtJQWlCNUIsWUFDVSxZQUEwQjtRQUExQixpQkFBWSxHQUFaLFlBQVksQ0FBYztJQUNoQyxDQUFDO0lBaEJMLElBQ0ksT0FBTztRQUNULE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQztJQUMzQixDQUFDO0lBQ0QsSUFBSSxPQUFPLENBQUMsT0FBZ0I7UUFDMUIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQztJQUM5QixDQUFDO0lBV0QsUUFBUTtRQUNOLGlDQUFpQztRQUNqQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUM7UUFDdEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxRQUFRLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7SUFDL0MsQ0FBQztJQUVELGVBQWU7UUFDYixJQUFJLENBQUMsWUFBWSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBRUQsVUFBVSxDQUFDLE9BQWdCO1FBQ3pCLElBQ0UsSUFBSSxDQUFDLEtBQUs7ZUFDUCxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWE7ZUFDeEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBUztlQUNsQyxPQUFPO2VBQ1AsT0FBTyxDQUFDLGVBQWUsRUFDMUI7WUFDQSxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1NBQzdEO0lBQ0gsQ0FBQztJQUVELGNBQWMsQ0FBQyxPQUFnQjtRQUM3QixJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzNCLENBQUM7OztZQW5ERixTQUFTLFNBQUM7Z0JBQ1QsUUFBUSxFQUFFLHNCQUFzQjtnQkFDaEMsZ0ZBQXlDO2dCQUV6QyxlQUFlLEVBQUUsdUJBQXVCLENBQUMsTUFBTTs7YUFDaEQ7OztZQVJRLFlBQVk7Ozt5QkFXbEIsS0FBSztzQkFDTCxLQUFLO29CQVlMLFNBQVMsU0FBQyxjQUFjIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQWZ0ZXJWaWV3SW5pdCwgQ29tcG9uZW50LCBJbnB1dCwgT25Jbml0LCBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSwgVmlld0NoaWxkLCBFbGVtZW50UmVmIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5cbmltcG9ydCB7IFJlbW90ZUZlZWQsIERldmljZXMgfSBmcm9tICcuLi8uLi9tb2RlbHMvamFudXMubW9kZWxzJztcbmltcG9ydCB7IEphbnVzU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2phbnVzLnNlcnZpY2UnO1xuXG4vKiogQGludGVybmFsICovXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICdqYW51cy1udmlkLWF1ZGlvLWJveCcsXG4gIHRlbXBsYXRlVXJsOiAnLi9hdWRpby1ib3guY29tcG9uZW50Lmh0bWwnLFxuICBzdHlsZVVybHM6IFsnLi9hdWRpby1ib3guY29tcG9uZW50LnNjc3MnXSxcbiAgY2hhbmdlRGV0ZWN0aW9uOiBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5PblB1c2hcbn0pXG5leHBvcnQgY2xhc3MgQXVkaW9Cb3hDb21wb25lbnQgaW1wbGVtZW50cyBPbkluaXQsIEFmdGVyVmlld0luaXQge1xuXG4gIEBJbnB1dCgpIHJlbW90ZUZlZWQ6IFJlbW90ZUZlZWQ7XG4gIEBJbnB1dCgpXG4gIGdldCBkZXZpY2VzKCk6IERldmljZXMge1xuICAgIHJldHVybiB0aGlzLmxvY2FsRGV2aWNlcztcbiAgfVxuICBzZXQgZGV2aWNlcyhkZXZpY2VzOiBEZXZpY2VzKSB7XG4gICAgdGhpcy5vbkRldmljZUNoYW5nZShkZXZpY2VzKTtcbiAgICB0aGlzLmxvY2FsRGV2aWNlcyA9IGRldmljZXM7XG4gIH1cblxuICBwcml2YXRlIGxvY2FsRGV2aWNlczogRGV2aWNlcztcbiAgcHVibGljIGF1ZGlvSWQ6IHN0cmluZztcblxuICBAVmlld0NoaWxkKCdhdWRpb0VsZW1lbnQnKSBhdWRpbzogRWxlbWVudFJlZjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGphbnVzU2VydmljZTogSmFudXNTZXJ2aWNlLFxuICApIHsgfVxuXG4gIG5nT25Jbml0KCk6IHZvaWQge1xuICAgIC8vIFNldCBteSB1bmlxdWUgaWQgZm9yIHRoZSBhdWRpb1xuICAgIGNvbnN0IGluc3RhbmNlID0gdGhpcztcbiAgICB0aGlzLmF1ZGlvSWQgPSAnYXVkaW8tJyArIHRoaXMucmVtb3RlRmVlZC5pZDtcbiAgfVxuXG4gIG5nQWZ0ZXJWaWV3SW5pdCgpOiB2b2lkIHtcbiAgICB0aGlzLmphbnVzU2VydmljZS5hdHRhY2hNZWRpYVN0cmVhbSh0aGlzLmF1ZGlvSWQsIHRoaXMucmVtb3RlRmVlZC5zdHJlYW1JZCk7XG4gIH1cblxuICBzZXRTcGVha2VyKGRldmljZXM6IERldmljZXMpOiB2b2lkIHtcbiAgICBpZiAoXG4gICAgICB0aGlzLmF1ZGlvXG4gICAgICAmJiB0aGlzLmF1ZGlvLm5hdGl2ZUVsZW1lbnRcbiAgICAgICYmIHRoaXMuYXVkaW8ubmF0aXZlRWxlbWVudC5zZXRTaW5rSWRcbiAgICAgICYmIGRldmljZXNcbiAgICAgICYmIGRldmljZXMuc3BlYWtlckRldmljZUlkXG4gICAgKSB7XG4gICAgICB0aGlzLmF1ZGlvLm5hdGl2ZUVsZW1lbnQuc2V0U2lua0lkKGRldmljZXMuc3BlYWtlckRldmljZUlkKTtcbiAgICB9XG4gIH1cblxuICBvbkRldmljZUNoYW5nZShkZXZpY2VzOiBEZXZpY2VzKTogdm9pZCB7XG4gICAgdGhpcy5zZXRTcGVha2VyKGRldmljZXMpO1xuICB9XG59XG4iXX0=