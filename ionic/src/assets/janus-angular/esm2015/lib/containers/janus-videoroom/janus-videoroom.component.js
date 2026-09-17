import { __awaiter } from "tslib";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, } from '@angular/core';
import { startWith, shareReplay, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { JanusRole, PublishState, RemoteFeedState, RoomInfoState, } from '../../models/janus.models';
import { JanusStore } from '../../store/janus.store';
import { JanusErrors } from '../../models/janus-server.models';
import { WebrtcService } from '../../services/janus.service';
/**
 * Janus videoroom component. This is a high level component to easily embed a janus videoroom in any angular webapp.
 * There are many options that can be set through Inputs. However, you can get started with the minimal example below.
 * Refer to the {@link https://janus.conf.meetecho.com/docs/videoroom.html|Janus Videoroom Docs} for deploying your own
 * Janus media server.
 * @example
 * <janus-videoroom
 *              [roomId]='1234'
 *              [wsUrl]='wss://janus.conf.meetecho.com/ws'
 * >
 * </janus-videoroom>
 *
 */
export class JanusVideoroomComponent {
    constructor(janusStore, webrtc) {
        this.janusStore = janusStore;
        this.webrtc = webrtc;
        /**
         * Display name for the user in the videoroom
         */
        this.userName = 'janus user';
        /**
         * Role for the user in the videoroom.
         *
         * Users can either be publishers or subscribers. Publishers will publish their video and audio to the room.
         * Subscribers will see/hear all publishers, but won't broadcast anything.
         */
        this.role = JanusRole.publisher;
        /**
         * STUN/TURN servers to use for the connection. These are passed directly to `RTCPeerConnection`
         * Refer to the {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer|MDN Docs} for details on the format.
         * The component will use a public STUN server if nothing is specified here. However, it's highly recommended that the user
         * deploy and use their own STUN/TURN server(s) for better reliability.
         */
        this.iceServers = [{ urls: 'stun:stun2.l.google.com:19302' }];
        /**
         * Emits errors encountered. These errors are fatal.
         */
        this.janusError = new EventEmitter();
        /**
         * Emits list of current publishers whenever there is a change to the publisher list
         */
        this.publishers = new EventEmitter();
        this.muted = false;
        this.destroy$ = new Subject();
    }
    /**
     * When set to true, the user's audio is muted.
     */
    set isMuted(muted) {
        this.muted = muted;
        this._setMuted(muted);
    }
    /**
     * @ignore
     */
    get isMuted() { return this.muted; }
    ngOnInit() {
        return __awaiter(this, void 0, void 0, function* () {
            // Initialize variables and load the room/user
            this.janusServerUrl = this.wsUrl ? this.wsUrl : this.httpUrl;
            this.remoteFeeds$ = this.janusStore.readyRemoteFeeds$.pipe(shareReplay(1));
            this.roomInfo$ = this.janusStore.roomInfo$.pipe(shareReplay(1));
            // @ts-ignore
            if (window.Cypress) {
                // @ts-ignore
                window.janusStore = this.janusStore;
            }
            // This ensures that the user has already granted all permissions before we
            // start setting up the videoroom. Otherwise there are a lot of weird race
            // conditions to consider
            if (!this.devices) {
                this.devices = yield this.webrtc.getDefaultDevices();
            }
            const stream = yield this.webrtc.getUserMedia('', '');
            this.webrtc.clearMediaStream(stream);
            this.setupJanusRoom();
        });
    }
    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
    ngOnChanges(changes) {
        // For some changes, we refresh the entire session from scratch
        const resetKeys = [
            'roomId',
            'wsUrl',
            'httpUrl',
            'iceServers',
            'pin',
            'role',
            'userName',
            'userId',
        ];
        for (const key of resetKeys) {
            if (key in changes
                && !changes[key].firstChange) {
                this.janusServerUrl = this.wsUrl ? this.wsUrl : this.httpUrl;
                this.janusStore.reset(this.iceServers);
                break;
            }
        }
    }
    /** @internal */
    _setMuted(muted) {
        this.janusStore.setMute(muted);
    }
    /** @internal */
    emitRemoteFeeds(remoteFeeds) {
        const publishers = remoteFeeds.filter((feed) => feed.state === RemoteFeedState.ready);
        this.publishers.emit(publishers);
    }
    /** @internal */
    attachRemoteFeeds(remoteFeeds, roomInfo, pin) {
        // Attach remote feeds
        for (const feed of remoteFeeds) {
            if (feed.state === RemoteFeedState.initialized) {
                this.janusStore.attachRemoteFeed({
                    roomInfo,
                    feed,
                    pin,
                });
                // Only fire one dispatch per subscribe
                break;
            }
        }
    }
    /** @internal */
    setupJanusRoom() {
        // Setup comms with janus server
        this.janusStore.initialize(this.iceServers);
        const allRemoteFeeds$ = this.janusStore.remoteFeeds$.pipe(startWith([]));
        this.janusStore.state$.pipe(takeUntil(this.destroy$)).subscribe(({ roomInfo, remoteFeeds }) => {
            const pin = this.pin ? this.pin : null;
            const remoteFeedsArray = Object.keys(remoteFeeds).map(id => remoteFeeds[id]);
            if (roomInfo.muted !== this.muted && roomInfo.publishState === PublishState.publishing) {
                this._setMuted(this.muted);
            }
            if (roomInfo.publishState === PublishState.error) {
                const message = JanusErrors[roomInfo.errorCode].message;
                this.janusError.emit({ code: roomInfo.errorCode, message });
            }
            this.attachRemoteFeeds(remoteFeedsArray, roomInfo, pin);
            this.emitRemoteFeeds(remoteFeedsArray);
            switch (roomInfo.state) {
                case RoomInfoState.initialized: {
                    this.janusStore.attachVideoRoom(this.janusServerUrl);
                    break;
                }
                case RoomInfoState.attached: {
                    this.janusStore.register({
                        name: this.userName,
                        userId: this.userId,
                        roomId: this.roomId,
                        pin,
                    });
                    break;
                }
                case RoomInfoState.attach_failed: {
                    if (this.janusServerUrl !== this.httpUrl) {
                        this.janusServerUrl = this.httpUrl;
                        setTimeout(() => {
                            this.janusStore.attachVideoRoom(this.janusServerUrl);
                        }, 100);
                    }
                    else {
                        this.janusError.emit({ code: 9999, message: 'Unable to connect to media server' });
                    }
                    break;
                }
            }
        });
    }
    /** @internal */
    onPublishOwnFeed(payload) {
        this.janusStore.publishOwnFeed(payload);
    }
    /** @internal */
    onRequestSubstream(payload) {
        const { feed, substreamId } = payload;
        this.janusStore.requestSubstream({ feed, substreamId });
    }
}
JanusVideoroomComponent.decorators = [
    { type: Component, args: [{
                selector: 'janus-videoroom',
                template: "<janus-default-video-room\n  [roomInfo]='roomInfo$ | async'\n  [remoteFeeds$]='remoteFeeds$'\n  [role]='role'\n  [devices]='devices'\n  (publishOwnFeed)='onPublishOwnFeed($event)'\n  (requestSubstream)='onRequestSubstream($event)'\n  >\n</janus-default-video-room>\n",
                changeDetection: ChangeDetectionStrategy.OnPush,
                providers: [JanusStore],
                styles: [""]
            },] }
];
JanusVideoroomComponent.ctorParameters = () => [
    { type: JanusStore },
    { type: WebrtcService }
];
JanusVideoroomComponent.propDecorators = {
    roomId: [{ type: Input }],
    wsUrl: [{ type: Input }],
    httpUrl: [{ type: Input }],
    pin: [{ type: Input }],
    userName: [{ type: Input }],
    role: [{ type: Input }],
    userId: [{ type: Input }],
    devices: [{ type: Input }],
    iceServers: [{ type: Input }],
    isMuted: [{ type: Input }],
    janusError: [{ type: Output }],
    publishers: [{ type: Output }]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamFudXMtdmlkZW9yb29tLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLi8uLi8uLi9wcm9qZWN0cy9qYW51cy9zcmMvIiwic291cmNlcyI6WyJsaWIvY29udGFpbmVycy9qYW51cy12aWRlb3Jvb20vamFudXMtdmlkZW9yb29tLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBRUEsT0FBTyxFQUNMLHVCQUF1QixFQUN2QixTQUFTLEVBRVQsWUFBWSxFQUNaLEtBQUssRUFJTCxNQUFNLEdBQ1AsTUFBTSxlQUFlLENBQUM7QUFFdkIsT0FBTyxFQUFTLFNBQVMsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFhLE1BQU0sZ0JBQWdCLENBQUM7QUFDckYsT0FBTyxFQUFjLE9BQU8sRUFBaUIsTUFBTSxNQUFNLENBQUM7QUFFMUQsT0FBTyxFQUVMLFNBQVMsRUFDVCxZQUFZLEVBR1osZUFBZSxFQUVmLGFBQWEsR0FFZCxNQUFNLDJCQUEyQixDQUFDO0FBR25DLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDL0QsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRTdEOzs7Ozs7Ozs7Ozs7R0FZRztBQVFILE1BQU0sT0FBTyx1QkFBdUI7SUFzR2xDLFlBQ21CLFVBQXNCLEVBQy9CLE1BQXFCO1FBRFosZUFBVSxHQUFWLFVBQVUsQ0FBWTtRQUMvQixXQUFNLEdBQU4sTUFBTSxDQUFlO1FBMUUvQjs7V0FFRztRQUVILGFBQVEsR0FBRyxZQUFZLENBQUM7UUFFeEI7Ozs7O1dBS0c7UUFFSCxTQUFJLEdBQWMsU0FBUyxDQUFDLFNBQVMsQ0FBQztRQWV0Qzs7Ozs7V0FLRztRQUVILGVBQVUsR0FBZ0IsQ0FBQyxFQUFDLElBQUksRUFBRSwrQkFBK0IsRUFBQyxDQUFDLENBQUM7UUFnQnBFOztXQUVHO1FBRUgsZUFBVSxHQUFH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LEtBQUs7bUJBU0wsS0FBSztxQkFPTCxLQUFLO3NCQU1MLEtBQUs7eUJBU0wsS0FBSztzQkFNTCxLQUFLO3lCQWNMLE1BQU07eUJBTU4sTUFBTSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIG1vbWVudCBmcm9tICdtb21lbnQnO1xuXG5pbXBvcnQge1xuICBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSxcbiAgQ29tcG9uZW50LFxuICBFbGVtZW50UmVmLFxuICBFdmVudEVtaXR0ZXIsXG4gIElucHV0LFxuICBPbkNoYW5nZXMsXG4gIE9uRGVzdHJveSxcbiAgT25Jbml0LFxuICBPdXRwdXQsXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuXG5pbXBvcnQgeyBmaXJzdCwgc3RhcnRXaXRoLCBzaGFyZVJlcGxheSwgdGFrZVVudGlsLCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBTdWJqZWN0LCBjb21iaW5lTGF0ZXN0IH0gZnJvbSAncnhqcyc7XG5cbmltcG9ydCB7XG4gIERldmljZXMsXG4gIEphbnVzUm9sZSxcbiAgUHVibGlzaFN0YXRlLFxuICBQdWJsaXNoZXIsXG4gIFJlbW90ZUZlZWQsXG4gIFJlbW90ZUZlZWRTdGF0ZSxcbiAgUm9vbUluZm8sXG4gIFJvb21JbmZvU3RhdGUsXG4gIEljZVNlcnZlcixcbn0gZnJvbSAnLi4vLi4vbW9kZWxzL2phbnVzLm1vZGVscyc7XG5cbmltcG9ydCB7IFB1Ymxpc2hPd25GZWVkUGF5bG9hZCB9IGZyb20gJy4uLy4uL3N0b3JlL2FjdGlvbnMvamFudXMuYWN0aW9ucyc7XG5pbXBvcnQgeyBKYW51c1N0b3JlIH0gZnJvbSAnLi4vLi4vc3RvcmUvamFudXMuc3RvcmUnO1xuaW1wb3J0IHsgSmFudXNFcnJvcnMgfSBmcm9tICcuLi8uLi9tb2RlbHMvamFudXMtc2VydmVyLm1vZGVscyc7XG5pbXBvcnQgeyBXZWJydGNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvamFudXMuc2VydmljZSc7XG5cbi8qKlxuICogSmFudXMgdmlkZW9yb29tIGNvbXBvbmVudC4gVGhpcyBpcyBhIGhpZ2ggbGV2ZWwgY29tcG9uZW50IHRvIGVhc2lseSBlbWJlZCBhIGphbnVzIHZpZGVvcm9vbSBpbiBhbnkgYW5ndWxhciB3ZWJhcHAuXG4gKiBUaGVyZSBhcmUgbWFueSBvcHRpb25zIHRoYXQgY2FuIGJlIHNldCB0aHJvdWdoIElucHV0cy4gSG93ZXZlciwgeW91IGNhbiBnZXQgc3RhcnRlZCB3aXRoIHRoZSBtaW5pbWFsIGV4YW1wbGUgYmVsb3cuXG4gKiBSZWZlciB0byB0aGUge0BsaW5rIGh0dHBzOi8vamFudXMuY29uZi5tZWV0ZWNoby5jb20vZG9jcy92aWRlb3Jvb20uaHRtbHxKYW51cyBWaWRlb3Jvb20gRG9jc30gZm9yIGRlcGxveWluZyB5b3VyIG93blxuICogSmFudXMgbWVkaWEgc2VydmVyLlxuICogQGV4YW1wbGVcbiAqIDxqYW51cy12aWRlb3Jvb21cbiAqICAgICAgICAgICAgICBbcm9vbUlkXT0nMTIzNCdcbiAqICAgICAgICAgICAgICBbd3NVcmxdPSd3c3M6Ly9qYW51cy5jb25mLm1lZXRlY2hvLmNvbS93cydcbiAqID5cbiAqIDwvamFudXMtdmlkZW9yb29tPlxuICpcbiAqL1xuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnamFudXMtdmlkZW9yb29tJyxcbiAgdGVtcGxhdGVVcmw6ICcuL2phbnVzLXZpZGVvcm9vbS5jb21wb25lbnQuaHRtbCcsXG4gIHN0eWxlVXJsczogWycuL2phbnVzLXZpZGVvcm9vbS5jb21wb25lbnQuc2NzcyddLFxuICBjaGFuZ2VEZXRlY3Rpb246IENoYW5nZURldGVjdGlvblN0cmF0ZWd5Lk9uUHVzaCxcbiAgcHJvdmlkZXJzOiBbSmFudXNTdG9yZV0sXG59KVxuZXhwb3J0IGNsYXNzIEphbnVzVmlkZW9yb29tQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkRlc3Ryb3ksIE9uQ2hhbmdlcyB7XG5cbiAgLyoqXG4gICAqICpSZXF1aXJlZCogSmFudXMgcm9vbSBpZC4gQ2FuIGJlIGVpdGhlciBhIHN0cmluZyBvciBhIG51bWJlci4gVGhpcyBtdXN0IG1hdGNoIHNlcnZlciBjb25maWd1cmF0aW9uLlxuICAgKi9cbiAgQElucHV0KClcbiAgcm9vbUlkOiBzdHJpbmcgfCBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFVSTCBmb3IgdGhlIHdlYnNvY2tldCBpbnRlcmZhY2Ugb2YgdGhlIEphbnVzIHNlcnZlci4gQXQgbGVhc3Qgb25lIG9mIHdzVXJsIG9yIGh0dHBVcmwgbXVzdCBiZSBzcGVjaWZpZWQuXG4gICAqXG4gICAqIEV4YW1wbGU6IGB3c3M6Ly9qYW51cy5jb25mLm1lZXRlY2hvLmNvbS93c2BcbiAgICovXG4gIEBJbnB1dCgpXG4gIHdzVXJsOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFVSTCBmb3IgdGhlIGh0dHAocykgaW50ZXJmYWNlIG9mIHRoZSBKYW51cyBzZXJ2ZXIuIEF0IGxlYXN0IG9uZSBvZiB3c1VybCBvciBodHRwVXJsIG11c3QgYmUgc3BlY2lmaWVkLlxuICAgKlxuICAgKiBFeGFtcGxlOiBgaHR0cHM6Ly9qYW51cy5jb25mLm1lZXRlY2hvLmNvbS9qYW51c2BcbiAgICovXG4gIEBJbnB1dCgpXG4gIGh0dHBVcmw6IHN0cmluZztcblxuICAvKipcbiAgICogUElOIGZvciBqb2luaW5nIHJvb20uIE11c3QgYmUgc3BlY2lmaWVkIGlmIGBwaW5fcmVxdWlyZWRgIGlzIHRydWUgZm9yIHRoZSByZXF1ZXN0ZWQgcm9vbUlkLlxuICAgKi9cbiAgQElucHV0KClcbiAgcGluPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBEaXNwbGF5IG5hbWUgZm9yIHRoZSB1c2VyIGluIHRoZSB2aWRlb3Jvb21cbiAgICovXG4gIEBJbnB1dCgpXG4gIHVzZXJOYW1lID0gJ2phbnVzIHVzZXInO1xuXG4gIC8qKlxuICAgKiBSb2xlIGZvciB0aGUgdXNlciBpbiB0aGUgdmlkZW9yb29tLlxuICAgKlxuICAgKiBVc2VycyBjYW4gZWl0aGVyIGJlIHB1Ymxpc2hlcnMgb3Igc3Vic2NyaWJlcnMuIFB1Ymxpc2hlcnMgd2lsbCBwdWJsaXNoIHRoZWlyIHZpZGVvIGFuZCBhdWRpbyB0byB0aGUgcm9vbS5cbiAgICogU3Vic2NyaWJlcnMgd2lsbCBzZWUvaGVhciBhbGwgcHVibGlzaGVycywgYnV0IHdvbid0IGJyb2FkY2FzdCBhbnl0aGluZy5cbiAgICovXG4gIEBJbnB1dCgpXG4gIHJvbGU6IEphbnVzUm9sZSA9IEphbnVzUm9sZS5wdWJsaXNoZXI7XG5cbiAgLyoqXG4gICAqIE51bWVyaWMgb3Igc3RyaW5nIElkIG9mIHB1Ymxpc2hlci4gVHlwZSBtdXN0IG1hdGNoIHNlcnZlciBjb25maWd1cmF0aW9uLiBJZiBub3QgcHJvdmlkZWQsXG4gICAqIGphbnVzIHNlcnZlciB3aWxsIGF1dG9tYXRpY2FsbHkgYXNzaWduIGFuIElEIHRvIHRoZSB1c2VyLlxuICAgKi9cbiAgQElucHV0KClcbiAgdXNlcklkPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBJbnB1dC9vdXRwdXQgZGV2aWNlcyB0byB1c2UuIElmIG5vdCBwcm92aWRlZCwgd2lsbCB1c2UgdGhlIGRlZmF1bHQgc3lzdGVtIGRldmljZXNcbiAgICovXG4gIEBJbnB1dCgpXG4gIGRldmljZXM/OiBEZXZpY2VzO1xuXG4gIC8qKlxuICAgKiBTVFVOL1RVUk4gc2VydmVycyB0byB1c2UgZm9yIHRoZSBjb25uZWN0aW9uLiBUaGVzZSBhcmUgcGFzc2VkIGRpcmVjdGx5IHRvIGBSVENQZWVyQ29ubmVjdGlvbmBcbiAgICogUmVmZXIgdG8gdGhlIHtAbGluayBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvUlRDSWNlU2VydmVyfE1ETiBEb2NzfSBmb3IgZGV0YWlscyBvbiB0aGUgZm9ybWF0LlxuICAgKiBUaGUgY29tcG9uZW50IHdpbGwgdXNlIGEgcHVibGljIFNUVU4gc2VydmVyIGlmIG5vdGhpbmcgaXMgc3BlY2lmaWVkIGhlcmUuIEhvd2V2ZXIsIGl0J3MgaGlnaGx5IHJlY29tbWVuZGVkIHRoYXQgdGhlIHVzZXJcbiAgICogZGVwbG95IGFuZCB1c2UgdGhlaXIgb3duIFNUVU4vVFVSTiBzZXJ2ZXIocykgZm9yIGJldHRlciByZWxpYWJpbGl0eS5cbiAgICovXG4gIEBJbnB1dCgpXG4gIGljZVNlcnZlcnM6IEljZVNlcnZlcltdID0gW3t1cmxzOiAnc3R1bjpzdHVuMi5sLmdvb2dsZS5jb206MTkzMDInfV07XG5cbiAgLyoqXG4gICAqIFdoZW4gc2V0IHRvIHRydWUsIHRoZSB1c2VyJ3MgYXVkaW8gaXMgbXV0ZWQuXG4gICAqL1xuICBASW5wdXQoKVxuICBzZXQgaXNNdXRlZChtdXRlZDogYm9vbGVhbikge1xuICAgIHRoaXMubXV0ZWQgPSBtdXRlZDtcbiAgICB0aGlzLl9zZXRNdXRlZChtdXRlZCk7XG4gIH1cblxuICAvKipcbiAgICogQGlnbm9yZVxuICAgKi9cbiAgZ2V0IGlzTXV0ZWQoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLm11dGVkOyB9XG5cbiAgLyoqXG4gICAqIEVtaXRzIGVycm9ycyBlbmNvdW50ZXJlZC4gVGhlc2UgZXJyb3JzIGFyZSBmYXRhbC5cbiAgICovXG4gIEBPdXRwdXQoKVxuICBqYW51c0Vycm9yID0gbmV3IEV2ZW50RW1pdHRlcjx7IGNvZGU6IG51bWJlciwgbWVzc2FnZTogc3RyaW5nIH0+KCk7XG5cbiAgLyoqXG4gICAqIEVtaXRzIGxpc3Qgb2YgY3VycmVudCBwdWJsaXNoZXJzIHdoZW5ldmVyIHRoZXJlIGlzIGEgY2hhbmdlIHRvIHRoZSBwdWJsaXNoZXIgbGlzdFxuICAgKi9cbiAgQE91dHB1dCgpXG4gIHB1Ymxpc2hlcnMgPSBuZXcgRXZlbnRFbWl0dGVyPFB1Ymxpc2hlcltdPigpO1xuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcm9vbUluZm8kOiBPYnNlcnZhYmxlPFJvb21JbmZvPjtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICByZW1vdGVGZWVkcyQ6IE9ic2VydmFibGU8UmVtb3RlRmVlZFtdPjtcblxuICBwcml2YXRlIG11dGVkID0gZmFsc2U7XG4gIHByaXZhdGUgZGVzdHJveSQgPSBuZXcgU3ViamVjdCgpO1xuICBwcml2YXRlIGphbnVzU2VydmVyVXJsOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBqYW51c1N0b3JlOiBKYW51c1N0b3JlLFxuICAgIHByaXZhdGUgd2VicnRjOiBXZWJydGNTZXJ2aWNlLFxuICApIHsgfVxuXG4gIGFzeW5jIG5nT25Jbml0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIEluaXRpYWxpemUgdmFyaWFibGVzIGFuZCBsb2FkIHRoZSByb29tL3VzZXJcblxuICAgIHRoaXMuamFudXNTZXJ2ZXJVcmwgPSB0aGlzLndzVXJsID8gdGhpcy53c1VybCA6IHRoaXMuaHR0cFVybDtcblxuICAgIHRoaXMucmVtb3RlRmVlZHMkID0gdGhpcy5qYW51c1N0b3JlLnJlYWR5UmVtb3RlRmVlZHMkLnBpcGUoXG4gICAgICBzaGFyZVJlcGxheSgxKSxcbiAgICApO1xuXG4gICAgdGhpcy5yb29tSW5mbyQgPSB0aGlzLmphbnVzU3RvcmUucm9vbUluZm8kLnBpcGUoXG4gICAgICBzaGFyZVJlcGxheSgxKVxuICAgICk7XG5cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgaWYgKHdpbmRvdy5DeXByZXNzKSB7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICB3aW5kb3cuamFudXNTdG9yZSA9IHRoaXMuamFudXNTdG9yZTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGVuc3VyZXMgdGhhdCB0aGUgdXNlciBoYXMgYWxyZWFkeSBncmFudGVkIGFsbCBwZXJtaXNzaW9ucyBiZWZvcmUgd2VcbiAgICAvLyBzdGFydCBzZXR0aW5nIHVwIHRoZSB2aWRlb3Jvb20uIE90aGVyd2lzZSB0aGVyZSBhcmUgYSBsb3Qgb2Ygd2VpcmQgcmFjZVxuICAgIC8vIGNvbmRpdGlvbnMgdG8gY29uc2lkZXJcbiAgICBpZiAoIXRoaXMuZGV2aWNlcykge1xuICAgICAgdGhpcy5kZXZpY2VzID0gYXdhaXQgdGhpcy53ZWJydGMuZ2V0RGVmYXVsdERldmljZXMoKTtcbiAgICB9XG4gICAgY29uc3Qgc3RyZWFtID0gYXdhaXQgdGhpcy53ZWJydGMuZ2V0VXNlck1lZGlhKCcnLCAnJyk7XG4gICAgdGhpcy53ZWJydGMuY2xlYXJNZWRpYVN0cmVhbShzdHJlYW0pO1xuICAgIHRoaXMuc2V0dXBKYW51c1Jvb20oKTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuZGVzdHJveSQubmV4dCgpO1xuICAgIHRoaXMuZGVzdHJveSQuY29tcGxldGUoKTtcbiAgfVxuXG4gIG5nT25DaGFuZ2VzKGNoYW5nZXMpOiB2b2lkIHtcbiAgICAvLyBGb3Igc29tZSBjaGFuZ2VzLCB3ZSByZWZyZXNoIHRoZSBlbnRpcmUgc2Vzc2lvbiBmcm9tIHNjcmF0Y2hcblxuICAgIGNvbnN0IHJlc2V0S2V5cyA9IFtcbiAgICAgICdyb29tSWQnLFxuICAgICAgJ3dzVXJsJyxcbiAgICAgICdodHRwVXJsJyxcbiAgICAgICdpY2VTZXJ2ZXJzJyxcbiAgICAgICdwaW4nLFxuICAgICAgJ3JvbGUnLFxuICAgICAgJ3VzZXJOYW1lJyxcbiAgICAgICd1c2VySWQnLFxuICAgIF07XG5cbiAgICBmb3IgKGNvbnN0IGtleSBvZiByZXNldEtleXMpIHtcbiAgICAgIGlmIChcbiAgICAgICAga2V5IGluIGNoYW5nZXNcbiAgICAgICAgJiYgIWNoYW5nZXNba2V5XS5maXJzdENoYW5nZVxuICAgICAgKSB7XG4gICAgICAgIHRoaXMuamFudXNTZXJ2ZXJVcmwgPSB0aGlzLndzVXJsID8gdGhpcy53c1VybCA6IHRoaXMuaHR0cFVybDtcbiAgICAgICAgdGhpcy5qYW51c1N0b3JlLnJlc2V0KHRoaXMuaWNlU2VydmVycyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3NldE11dGVkKG11dGVkOiBib29sZWFuKTogdm9pZCB7XG4gICAgdGhpcy5qYW51c1N0b3JlLnNldE11dGUobXV0ZWQpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBlbWl0UmVtb3RlRmVlZHMocmVtb3RlRmVlZHM6IFJlbW90ZUZlZWRbXSk6IHZvaWQge1xuICAgIGNvbnN0IHB1Ymxpc2hlcnM6IFB1Ymxpc2hlcltdID0gcmVtb3RlRmVlZHMuZmlsdGVyKChmZWVkKSA9PiBmZWVkLnN0YXRlID09PSBSZW1vdGVGZWVkU3RhdGUucmVhZHkpO1xuICAgIHRoaXMucHVibGlzaGVycy5lbWl0KHB1Ymxpc2hlcnMpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBhdHRhY2hSZW1vdGVGZWVkcyhyZW1vdGVGZWVkczogUmVtb3RlRmVlZFtdLCByb29tSW5mbzogUm9vbUluZm8sIHBpbjogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gQXR0YWNoIHJlbW90ZSBmZWVkc1xuXG4gICAgZm9yIChjb25zdCBmZWVkIG9mIHJlbW90ZUZlZWRzKSB7XG4gICAgICBpZiAoZmVlZC5zdGF0ZSA9PT0gUmVtb3RlRmVlZFN0YXRlLmluaXRpYWxpemVkKSB7XG5cbiAgICAgICAgdGhpcy5qYW51c1N0b3JlLmF0dGFjaFJlbW90ZUZlZWQoe1xuICAgICAgICAgIHJvb21JbmZvLFxuICAgICAgICAgIGZlZWQsXG4gICAgICAgICAgcGluLFxuICAgICAgICB9KTtcbiAgICAgICAgLy8gT25seSBmaXJlIG9uZSBkaXNwYXRjaCBwZXIgc3Vic2NyaWJlXG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgc2V0dXBKYW51c1Jvb20oKTogdm9pZCB7XG4gICAgLy8gU2V0dXAgY29tbXMgd2l0aCBqYW51cyBzZXJ2ZXJcblxuICAgIHRoaXMuamFudXNTdG9yZS5pbml0aWFsaXplKHRoaXMuaWNlU2VydmVycyk7XG5cbiAgICBjb25zdCBhbGxSZW1vdGVGZWVkcyQ6IE9ic2VydmFibGU8UmVtb3RlRmVlZFtdPiA9IHRoaXMuamFudXNTdG9yZS5yZW1vdGVGZWVkcyQucGlwZShcbiAgICAgIHN0YXJ0V2l0aChbXSlcbiAgICApO1xuICAgIHRoaXMuamFudXNTdG9yZS5zdGF0ZSQucGlwZShcbiAgICAgIHRha2VVbnRpbCh0aGlzLmRlc3Ryb3kkKSxcbiAgICApLnN1YnNjcmliZSgoe3Jvb21JbmZvLCByZW1vdGVGZWVkc30pID0+IHtcblxuICAgICAgY29uc3QgcGluID0gdGhpcy5waW4gPyB0aGlzLnBpbiA6IG51bGw7XG4gICAgICBjb25zdCByZW1vdGVGZWVkc0FycmF5ID0gT2JqZWN0LmtleXMocmVtb3RlRmVlZHMpLm1hcChpZCA9PiByZW1vdGVGZWVkc1tpZF0pO1xuICAgICAgaWYgKHJvb21JbmZvLm11dGVkICE9PSB0aGlzLm11dGVkICYmIHJvb21JbmZvLnB1Ymxpc2hTdGF0ZSA9PT0gUHVibGlzaFN0YXRlLnB1Ymxpc2hpbmcpIHtcbiAgICAgICAgdGhpcy5fc2V0TXV0ZWQodGhpcy5tdXRlZCk7XG4gICAgICB9XG4gICAgICBpZiAocm9vbUluZm8ucHVibGlzaFN0YXRlID09PSBQdWJsaXNoU3RhdGUuZXJyb3IpIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IEphbnVzRXJyb3JzW3Jvb21JbmZvLmVycm9yQ29kZV0ubWVzc2FnZTtcbiAgICAgICAgdGhpcy5qYW51c0Vycm9yLmVtaXQoe2NvZGU6IHJvb21JbmZvLmVycm9yQ29kZSwgbWVzc2FnZX0pO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmF0dGFjaFJlbW90ZUZlZWRzKHJlbW90ZUZlZWRzQXJyYXksIHJvb21JbmZvLCBwaW4pO1xuICAgICAgdGhpcy5lbWl0UmVtb3RlRmVlZHMocmVtb3RlRmVlZHNBcnJheSk7XG5cbiAgICAgIHN3aXRjaCAocm9vbUluZm8uc3RhdGUpIHtcbiAgICAgICAgY2FzZSBSb29tSW5mb1N0YXRlLmluaXRpYWxpemVkOiB7XG4gICAgICAgICAgdGhpcy5qYW51c1N0b3JlLmF0dGFjaFZpZGVvUm9vbSh0aGlzLmphbnVzU2VydmVyVXJsKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIFJvb21JbmZvU3RhdGUuYXR0YWNoZWQ6IHtcbiAgICAgICAgICB0aGlzLmphbnVzU3RvcmUucmVnaXN0ZXIoe1xuICAgICAgICAgICAgbmFtZTogdGhpcy51c2VyTmFtZSxcbiAgICAgICAgICAgIHVzZXJJZDogdGhpcy51c2VySWQsXG4gICAgICAgICAgICByb29tSWQ6IHRoaXMucm9vbUlkLFxuICAgICAgICAgICAgcGluLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgUm9vbUluZm9TdGF0ZS5hdHRhY2hfZmFpbGVkOiB7XG4gICAgICAgICAgaWYgKHRoaXMuamFudXNTZXJ2ZXJVcmwgIT09IHRoaXMuaHR0cFVybCkge1xuICAgICAgICAgICAgdGhpcy5qYW51c1NlcnZlclVybCA9IHRoaXMuaHR0cFVybDtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLmphbnVzU3RvcmUuYXR0YWNoVmlkZW9Sb29tKHRoaXMuamFudXNTZXJ2ZXJVcmwpO1xuICAgICAgICAgICAgfSwgMTAwKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5qYW51c0Vycm9yLmVtaXQoe2NvZGU6IDk5OTksIG1lc3NhZ2U6ICdVbmFibGUgdG8gY29ubmVjdCB0byBtZWRpYSBzZXJ2ZXInfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIG9uUHVibGlzaE93bkZlZWQocGF5bG9hZDogUHVibGlzaE93bkZlZWRQYXlsb2FkKTogdm9pZCB7XG4gICAgdGhpcy5qYW51c1N0b3JlLnB1Ymxpc2hPd25GZWVkKHBheWxvYWQpO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBvblJlcXVlc3RTdWJzdHJlYW0ocGF5bG9hZDoge2ZlZWQ6IFJlbW90ZUZlZWQsIHN1YnN0cmVhbUlkOiBudW1iZXJ9KTogdm9pZCB7XG4gICAgY29uc3Qge2ZlZWQsIHN1YnN0cmVhbUlkfSA9IHBheWxvYWQ7XG4gICAgdGhpcy5qYW51c1N0b3JlLnJlcXVlc3RTdWJzdHJlYW0oe2ZlZWQsIHN1YnN0cmVhbUlkfSk7XG4gIH1cbn1cbiJdfQ==