import { AfterViewInit, ElementRef, EventEmitter, OnDestroy, OnInit, OnChanges } from '@angular/core';
import { RemoteFeed, Devices } from '../../models/janus.models';
import { JanusService } from '../../services/janus.service';
import { VideoQualityHelper } from './video-quality-helper';
/** @internal */
import * as ɵngcc0 from '@angular/core';
export declare class VideoBoxComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
    private janusService;
    remoteFeed: RemoteFeed;
    mode: 'speaker' | 'grid';
    get devices(): Devices;
    set devices(devices: Devices);
    maximize: EventEmitter<RemoteFeed>;
    requestSubstream: EventEmitter<{
        feed: RemoteFeed;
        substreamId: number;
    }>;
    videoId: string;
    optionsOpen: boolean;
    videoAvailable: boolean;
    videoQualityHelper: VideoQualityHelper;
    private localDevices;
    private destroy$;
    video: ElementRef;
    constructor(janusService: JanusService);
    ngOnInit(): void;
    ngAfterViewInit(): void;
    ngOnChanges(changes: any): void;
    ngOnDestroy(): void;
    setupSubscriptions(): void;
    _attachMediaStream(): void;
    private setSpeaker;
    onPlay(): void;
    monitorVideoQuality(slowLink: boolean): void;
    switchSubstream(substreamId: number): void;
    onMaximize(): void;
    onDeviceChange(devices: Devices): void;
    static ɵfac: ɵngcc0.ɵɵFactoryDeclaration<VideoBoxComponent, never>;
    static ɵcmp: ɵngcc0.ɵɵComponentDeclaration<VideoBoxComponent, "janus-video-box", never, { "devices": "devices"; "remoteFeed": "remoteFeed"; "mode": "mode"; }, { "maximize": "maximize"; "requestSubstream": "requestSubstream"; }, never, never>;
}

//# sourceMappingURL=video-box.component.d.ts.map