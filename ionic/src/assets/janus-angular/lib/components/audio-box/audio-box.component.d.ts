import { AfterViewInit, OnInit, ElementRef } from '@angular/core';
import { RemoteFeed, Devices } from '../../models/janus.models';
import { JanusService } from '../../services/janus.service';
/** @internal */
import * as ɵngcc0 from '@angular/core';
export declare class AudioBoxComponent implements OnInit, AfterViewInit {
    private janusService;
    remoteFeed: RemoteFeed;
    get devices(): Devices;
    set devices(devices: Devices);
    private localDevices;
    audioId: string;
    audio: ElementRef;
    constructor(janusService: JanusService);
    ngOnInit(): void;
    ngAfterViewInit(): void;
    setSpeaker(devices: Devices): void;
    onDeviceChange(devices: Devices): void;
    static ɵfac: ɵngcc0.ɵɵFactoryDeclaration<AudioBoxComponent, never>;
    static ɵcmp: ɵngcc0.ɵɵComponentDeclaration<AudioBoxComponent, "janus-nvid-audio-box", never, { "devices": "devices"; "remoteFeed": "remoteFeed"; }, {}, never, never>;
}

//# sourceMappingURL=audio-box.component.d.ts.map