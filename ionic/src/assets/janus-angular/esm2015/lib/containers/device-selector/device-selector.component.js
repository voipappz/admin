import { __awaiter } from "tslib";
import { ChangeDetectorRef, Component, EventEmitter, Output, ChangeDetectionStrategy, Input } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WebrtcService } from '../../services/janus.service';
/**
 * Device selector form. Implements a form that will show the user options for picking their camera,
 * microphone, and speaker device. The speaker option is only shown if the device supports dynamically
 * changing the speaker. This class can be subclassed if style changes are desired.
 * @example
 * <janus-device-selector
 *              [devices]=devices
 *              (deviceUpdate)='onDeviceUpdate($event)'>
 * </janus-device-selector>
 */
export class DeviceSelectorComponent {
    constructor(changeDetector, builder, webrtc) {
        this.changeDetector = changeDetector;
        this.builder = builder;
        this.webrtc = webrtc;
        /**
         * Event emitted whenever the user changes the devices in the form
         */
        this.deviceUpdate = new EventEmitter();
        this.supportsSpeakerSelection = false;
        this.destroy$ = new Subject();
    }
    ngOnInit() {
        this.devicesForm = this.builder.group({
            audioDevice: [this.devices.audioDeviceId, [Validators.required]],
            videoDevice: [this.devices.videoDeviceId, [Validators.required]],
            speakerDevice: [this.devices.speakerDeviceId, [Validators.required]],
        });
        this.getDevices();
        this.devicesForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
            const devices = {
                audioDeviceId: this.devicesForm.get('audioDevice').value,
                videoDeviceId: this.devicesForm.get('videoDevice').value,
                speakerDeviceId: this.devicesForm.get('speakerDevice').value,
            };
            this.deviceUpdate.emit(devices);
        });
    }
    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
    /** @internal */
    getDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            const allDevices = yield this.webrtc.listDevices();
            this.supportsSpeakerSelection = this.webrtc.supportsSpeakerSelection();
            this.availableAudioDevices = allDevices.filter((device) => device.kind === 'audioinput');
            this.availableVideoDevices = allDevices.filter((device) => device.kind === 'videoinput');
            this.availableSpeakerDevices = allDevices.filter((device) => device.kind === 'audiooutput');
            this.changeDetector.detectChanges();
        });
    }
}
DeviceSelectorComponent.decorators = [
    { type: Component, args: [{
                selector: 'janus-device-selector',
                template: "<form \n  *ngIf='devicesForm'\n  [formGroup]='devicesForm'>\n    <div class='form-row'>\n      <label>Microphone</label>\n      <span class='flex'></span>\n      <select formControlName='audioDevice'>\n        <option\n          *ngFor=\"let device of availableAudioDevices\"\n          [value]='device.deviceId'\n        >{{ device.label }}</option>\n      </select>\n    </div>\n\n    <div class='form-row'>\n      <label>Camera</label>\n      <span class='flex'></span>\n      <select formControlName='videoDevice'>\n        <option\n          *ngFor=\"let device of availableVideoDevices\"\n          [value]='device.deviceId'\n          >{{ device.label }}</option>\n      </select>\n    </div>\n\n    <div\n      *ngIf='supportsSpeakerSelection'\n      class='form-row'>\n      <label>Speakers</label>\n      <span class='flex'></span>\n      <select formControlName='speakerDevice'>\n        <option\n          *ngFor=\"let device of availableSpeakerDevices\"\n          [value]='device.deviceId'\n          >{{ device.label }}</option>\n      </select>\n    </div>\n</form>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                styles: ["div.form-row{display:flex;justify-content:center;padding:5px 0}div.form-row span.flex{flex-grow:1}div.form-row label{width:30%}div.form-row select{width:60%}"]
            },] }
];
DeviceSelectorComponent.ctorParameters = () => [
    { type: ChangeDetectorRef },
    { type: FormBuilder },
    { type: WebrtcService }
];
DeviceSelectorComponent.propDecorators = {
    devices: [{ type: Input }],
    deviceUpdate: [{ type: Output }]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlLXNlbGVjdG9yLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLi8uLi8uLi9wcm9qZWN0cy9qYW51cy9zcmMvIiwic291cmNlcyI6WyJsaWIvY29udGFpbmVycy9kZXZpY2Utc2VsZWN0b3IvZGV2aWNlLXNlbGVjdG9yLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxFQUFFLGlCQUFpQixFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQXFCLE1BQU0sRUFBRSx1QkFBdUIsRUFBRSxLQUFLLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFdEksT0FBTyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUV6RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQy9CLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUUzQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFJN0Q7Ozs7Ozs7OztHQVNHO0FBU0gsTUFBTSxPQUFPLHVCQUF1QjtJQXNCbEMsWUFDVSxjQUFpQyxFQUNqQyxPQUFvQixFQUNwQixNQUFxQjtRQUZyQixtQkFBYyxHQUFkLGNBQWMsQ0FBbUI7UUFDakMsWUFBTyxHQUFQLE9BQU8sQ0FBYTtRQUNwQixXQUFNLEdBQU4sTUFBTSxDQUFlO1FBakIvQjs7V0FFRztRQUVILGlCQUFZLEdBQUcsSUFBSSxZQUFZLEVBQVcsQ0FBQztRQU1wQyw2QkFBd0IsR0FBRyxLQUFLLENBQUM7UUFDaEMsYUFBUSxHQUFHLElBQUksT0FBTyxFQUFFLENBQUM7SUFPN0IsQ0FBQztJQUVMLFFBQVE7UUFFTixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO1lBQ3BDLFdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2hFLFdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2hFLGFBQWEsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ3JFLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUVsQixJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQ2hDLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQ3pCLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRTtZQUNmLE1BQU0sT0FBTyxHQUFHO2dCQUNkLGFBQWEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQyxLQUFLO2dCQUN4RCxhQUFhLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUMsS0FBSztnQkFDeEQsZUFBZSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDLEtBQUs7YUFDN0QsQ0FBQztZQUNGLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2xDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELFdBQVc7UUFDVCxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDM0IsQ0FBQztJQUVELGdCQUFnQjtJQUNWLFVBQVU7O1lBQ2QsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ25ELElBQUksQ0FBQyx3QkFBd0IsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLHdCQUF3QixFQUFFLENBQUM7WUFDdkUsSUFBSSxDQUFDLHFCQUFxQixHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssWUFBWSxDQUFDLENBQUM7WUFDekYsSUFBSSxDQUFDLHFCQUFxQixHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssWUFBWSxDQUFDLENBQUM7WUFDekYsSUFBSSxDQUFDLHVCQUF1QixHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssYUFBYSxDQUFDLENBQUM7WUFDNUYsSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUN0QyxDQUFDO0tBQUE7OztZQXRFRixTQUFTLFNBQUM7Z0JBQ1QsUUFBUSxFQUFFLHVCQUF1QjtnQkFDakMsdWtDQUErQztnQkFJL0MsZUFBZSxFQUFFLHVCQUF1QixDQUFDLE1BQU07O2FBQ2hEOzs7WUE1QlEsaUJBQWlCO1lBRWpCLFdBQVc7WUFLWCxhQUFhOzs7c0JBMkJuQixLQUFLOzJCQU1MLE1BQU0iLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDaGFuZ2VEZXRlY3RvclJlZiwgQ29tcG9uZW50LCBFdmVudEVtaXR0ZXIsIE9uRGVzdHJveSwgT25Jbml0LCBPdXRwdXQsIENoYW5nZURldGVjdGlvblN0cmF0ZWd5LCBJbnB1dCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuXG5pbXBvcnQgeyBGb3JtQnVpbGRlciwgVmFsaWRhdG9ycyB9IGZyb20gJ0Bhbmd1bGFyL2Zvcm1zJztcblxuaW1wb3J0IHsgU3ViamVjdCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgdGFrZVVudGlsIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuXG5pbXBvcnQgeyBXZWJydGNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvamFudXMuc2VydmljZSc7XG5pbXBvcnQgeyBEZXZpY2VzIH0gZnJvbSAnLi4vLi4vbW9kZWxzL2phbnVzLm1vZGVscyc7XG5cblxuLyoqXG4gKiBEZXZpY2Ugc2VsZWN0b3IgZm9ybS4gSW1wbGVtZW50cyBhIGZvcm0gdGhhdCB3aWxsIHNob3cgdGhlIHVzZXIgb3B0aW9ucyBmb3IgcGlja2luZyB0aGVpciBjYW1lcmEsXG4gKiBtaWNyb3Bob25lLCBhbmQgc3BlYWtlciBkZXZpY2UuIFRoZSBzcGVha2VyIG9wdGlvbiBpcyBvbmx5IHNob3duIGlmIHRoZSBkZXZpY2Ugc3VwcG9ydHMgZHluYW1pY2FsbHlcbiAqIGNoYW5naW5nIHRoZSBzcGVha2VyLiBUaGlzIGNsYXNzIGNhbiBiZSBzdWJjbGFzc2VkIGlmIHN0eWxlIGNoYW5nZXMgYXJlIGRlc2lyZWQuXG4gKiBAZXhhbXBsZVxuICogPGphbnVzLWRldmljZS1zZWxlY3RvclxuICogICAgICAgICAgICAgIFtkZXZpY2VzXT1kZXZpY2VzXG4gKiAgICAgICAgICAgICAgKGRldmljZVVwZGF0ZSk9J29uRGV2aWNlVXBkYXRlKCRldmVudCknPlxuICogPC9qYW51cy1kZXZpY2Utc2VsZWN0b3I+XG4gKi9cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2phbnVzLWRldmljZS1zZWxlY3RvcicsXG4gIHRlbXBsYXRlVXJsOiAnLi9kZXZpY2Utc2VsZWN0b3IuY29tcG9uZW50Lmh0bWwnLFxuICBzdHlsZVVybHM6IFtcbiAgICAnLi9kZXZpY2Utc2VsZWN0b3IuY29tcG9uZW50LnNjc3MnLFxuICBdLFxuICBjaGFuZ2VEZXRlY3Rpb246IENoYW5nZURldGVjdGlvblN0cmF0ZWd5Lk9uUHVzaFxufSlcbmV4cG9ydCBjbGFzcyBEZXZpY2VTZWxlY3RvckNvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25EZXN0cm95IHtcblxuICAvKipcbiAgICogQ3VycmVudGx5IHNlbGVjdGVkIGRldmljZXNcbiAgICovXG4gIEBJbnB1dCgpXG4gIGRldmljZXM6IERldmljZXM7XG5cbiAgLyoqXG4gICAqIEV2ZW50IGVtaXR0ZWQgd2hlbmV2ZXIgdGhlIHVzZXIgY2hhbmdlcyB0aGUgZGV2aWNlcyBpbiB0aGUgZm9ybVxuICAgKi9cbiAgQE91dHB1dCgpXG4gIGRldmljZVVwZGF0ZSA9IG5ldyBFdmVudEVtaXR0ZXI8RGV2aWNlcz4oKTtcblxuICBwdWJsaWMgZGV2aWNlc0Zvcm07XG4gIHB1YmxpYyBhdmFpbGFibGVBdWRpb0RldmljZXM7XG4gIHB1YmxpYyBhdmFpbGFibGVWaWRlb0RldmljZXM7XG4gIHB1YmxpYyBhdmFpbGFibGVTcGVha2VyRGV2aWNlcztcbiAgcHVibGljIHN1cHBvcnRzU3BlYWtlclNlbGVjdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIGRlc3Ryb3kkID0gbmV3IFN1YmplY3QoKTtcblxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgY2hhbmdlRGV0ZWN0b3I6IENoYW5nZURldGVjdG9yUmVmLFxuICAgIHByaXZhdGUgYnVpbGRlcjogRm9ybUJ1aWxkZXIsXG4gICAgcHJpdmF0ZSB3ZWJydGM6IFdlYnJ0Y1NlcnZpY2UsXG4gICkgeyB9XG5cbiAgbmdPbkluaXQoKTogdm9pZCB7XG5cbiAgICB0aGlzLmRldmljZXNGb3JtID0gdGhpcy5idWlsZGVyLmdyb3VwKHtcbiAgICAgIGF1ZGlvRGV2aWNlOiBbdGhpcy5kZXZpY2VzLmF1ZGlvRGV2aWNlSWQsIFtWYWxpZGF0b3JzLnJlcXVpcmVkXV0sXG4gICAgICB2aWRlb0RldmljZTogW3RoaXMuZGV2aWNlcy52aWRlb0RldmljZUlkLCBbVmFsaWRhdG9ycy5yZXF1aXJlZF1dLFxuICAgICAgc3BlYWtlckRldmljZTogW3RoaXMuZGV2aWNlcy5zcGVha2VyRGV2aWNlSWQsIFtWYWxpZGF0b3JzLnJlcXVpcmVkXV0sXG4gICAgfSk7XG4gICAgdGhpcy5nZXREZXZpY2VzKCk7XG5cbiAgICB0aGlzLmRldmljZXNGb3JtLnZhbHVlQ2hhbmdlcy5waXBlKFxuICAgICAgdGFrZVVudGlsKHRoaXMuZGVzdHJveSQpXG4gICAgKS5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgY29uc3QgZGV2aWNlcyA9IHtcbiAgICAgICAgYXVkaW9EZXZpY2VJZDogdGhpcy5kZXZpY2VzRm9ybS5nZXQoJ2F1ZGlvRGV2aWNlJykudmFsdWUsXG4gICAgICAgIHZpZGVvRGV2aWNlSWQ6IHRoaXMuZGV2aWNlc0Zvcm0uZ2V0KCd2aWRlb0RldmljZScpLnZhbHVlLFxuICAgICAgICBzcGVha2VyRGV2aWNlSWQ6IHRoaXMuZGV2aWNlc0Zvcm0uZ2V0KCdzcGVha2VyRGV2aWNlJykudmFsdWUsXG4gICAgICB9O1xuICAgICAgdGhpcy5kZXZpY2VVcGRhdGUuZW1pdChkZXZpY2VzKTtcbiAgICB9KTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuZGVzdHJveSQubmV4dCgpO1xuICAgIHRoaXMuZGVzdHJveSQuY29tcGxldGUoKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgYXN5bmMgZ2V0RGV2aWNlcygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBhbGxEZXZpY2VzID0gYXdhaXQgdGhpcy53ZWJydGMubGlzdERldmljZXMoKTtcbiAgICB0aGlzLnN1cHBvcnRzU3BlYWtlclNlbGVjdGlvbiA9IHRoaXMud2VicnRjLnN1cHBvcnRzU3BlYWtlclNlbGVjdGlvbigpO1xuICAgIHRoaXMuYXZhaWxhYmxlQXVkaW9EZXZpY2VzID0gYWxsRGV2aWNlcy5maWx0ZXIoKGRldmljZSkgPT4gZGV2aWNlLmtpbmQgPT09ICdhdWRpb2lucHV0Jyk7XG4gICAgdGhpcy5hdmFpbGFibGVWaWRlb0RldmljZXMgPSBhbGxEZXZpY2VzLmZpbHRlcigoZGV2aWNlKSA9PiBkZXZpY2Uua2luZCA9PT0gJ3ZpZGVvaW5wdXQnKTtcbiAgICB0aGlzLmF2YWlsYWJsZVNwZWFrZXJEZXZpY2VzID0gYWxsRGV2aWNlcy5maWx0ZXIoKGRldmljZSkgPT4gZGV2aWNlLmtpbmQgPT09ICdhdWRpb291dHB1dCcpO1xuICAgIHRoaXMuY2hhbmdlRGV0ZWN0b3IuZGV0ZWN0Q2hhbmdlcygpO1xuICB9XG59XG4iXX0=