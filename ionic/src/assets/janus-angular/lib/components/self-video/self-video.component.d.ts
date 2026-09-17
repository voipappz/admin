import { AfterViewInit, EventEmitter, OnInit } from '@angular/core';
import { RoomInfo, Devices } from '../../models/janus.models';
import { PublishOwnFeedPayload } from '../../store/actions/janus.actions';
/** @internal
 *
 * Minor dragons:
 * publishOwnFeed won't work unless we know the devices **and** the canvas element already exists.
 * Therefore, the first call to publishOwnFeed comes in ngAfterViewInit. After the first publish, we
 * can adjust the devices in onDevicesChange.
 */
import * as ɵngcc0 from '@angular/core';
export declare class SelfVideoComponent implements OnInit, AfterViewInit {
    roomInfo: RoomInfo;
    get devices(): Devices;
    set devices(devices: Devices);
    publishOwnFeed: EventEmitter<PublishOwnFeedPayload>;
    private currentDevices;
    private devicesInitialized;
    private afterViewInitRan;
    constructor();
    ngOnInit(): void;
    ngAfterViewInit(): Promise<void>;
    _publishOwnFeed(audioDeviceId: string, videoDeviceId: string): void;
    onDevicesChange(previousDevices: Devices, newDevices: Devices): void;
    static ɵfac: ɵngcc0.ɵɵFactoryDeclaration<SelfVideoComponent, never>;
    static ɵcmp: ɵngcc0.ɵɵComponentDeclaration<SelfVideoComponent, "janus-self-video", never, { "devices": "devices"; "roomInfo": "roomInfo"; }, { "publishOwnFeed": "publishOwnFeed"; }, never, never>;
}

//# sourceMappingURL=self-video.component.d.ts.map