import { EventEmitter, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Devices, JanusRole, Publisher, RemoteFeed, RoomInfo, IceServer } from '../../models/janus.models';
import { PublishOwnFeedPayload } from '../../store/actions/janus.actions';
import { JanusStore } from '../../store/janus.store';
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
import * as ɵngcc0 from '@angular/core';
export declare class JanusVideoroomComponent implements OnInit, OnDestroy, OnChanges {
    private readonly janusStore;
    private webrtc;
    /**
     * *Required* Janus room id. Can be either a string or a number. This must match server configuration.
     */
    roomId: string | number;
    /**
     * URL for the websocket interface of the Janus server. At least one of wsUrl or httpUrl must be specified.
     *
     * Example: `wss://janus.conf.meetecho.com/ws`
     */
    wsUrl: string;
    /**
     * URL for the http(s) interface of the Janus server. At least one of wsUrl or httpUrl must be specified.
     *
     * Example: `https://janus.conf.meetecho.com/janus`
     */
    httpUrl: string;
    /**
     * PIN for joining room. Must be specified if `pin_required` is true for the requested roomId.
     */
    pin?: string;
    /**
     * Display name for the user in the videoroom
     */
    userName: string;
    /**
     * Role for the user in the videoroom.
     *
     * Users can either be publishers or subscribers. Publishers will publish their video and audio to the room.
     * Subscribers will see/hear all publishers, but won't broadcast anything.
     */
    role: JanusRole;
    /**
     * Numeric or string Id of publisher. Type must match server configuration. If not provided,
     * janus server will automatically assign an ID to the user.
     */
    userId?: string;
    /**
     * Input/output devices to use. If not provided, will use the default system devices
     */
    devices?: Devices;
    /**
     * STUN/TURN servers to use for the connection. These are passed directly to `RTCPeerConnection`
     * Refer to the {@link https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer|MDN Docs} for details on the format.
     * The component will use a public STUN server if nothing is specified here. However, it's highly recommended that the user
     * deploy and use their own STUN/TURN server(s) for better reliability.
     */
    iceServers: IceServer[];
    /**
     * When set to true, the user's audio is muted.
     */
    set isMuted(muted: boolean);
    /**
     * @ignore
     */
    get isMuted(): boolean;
    /**
     * Emits errors encountered. These errors are fatal.
     */
    janusError: EventEmitter<{
        code: number;
        message: string;
    }>;
    /**
     * Emits list of current publishers whenever there is a change to the publisher list
     */
    publishers: EventEmitter<Publisher[]>;
    /** @internal */
    roomInfo$: Observable<RoomInfo>;
    /** @internal */
    remoteFeeds$: Observable<RemoteFeed[]>;
    private muted;
    private destroy$;
    private janusServerUrl;
    constructor(janusStore: JanusStore, webrtc: WebrtcService);
    ngOnInit(): Promise<void>;
    ngOnDestroy(): void;
    ngOnChanges(changes: any): void;
    /** @internal */
    _setMuted(muted: boolean): void;
    /** @internal */
    emitRemoteFeeds(remoteFeeds: RemoteFeed[]): void;
    /** @internal */
    attachRemoteFeeds(remoteFeeds: RemoteFeed[], roomInfo: RoomInfo, pin: string): void;
    /** @internal */
    setupJanusRoom(): void;
    /** @internal */
    onPublishOwnFeed(payload: PublishOwnFeedPayload): void;
    /** @internal */
    onRequestSubstream(payload: {
        feed: RemoteFeed;
        substreamId: number;
    }): void;
    static ɵfac: ɵngcc0.ɵɵFactoryDeclaration<JanusVideoroomComponent, never>;
    static ɵcmp: ɵngcc0.ɵɵComponentDeclaration<JanusVideoroomComponent, "janus-videoroom", never, { "userName": "userName"; "role": "role"; "iceServers": "iceServers"; "isMuted": "isMuted"; "roomId": "roomId"; "wsUrl": "wsUrl"; "httpUrl": "httpUrl"; "pin": "pin"; "userId": "userId"; "devices": "devices"; }, { "janusError": "janusError"; "publishers": "publishers"; }, never, never>;
}

//# sourceMappingURL=janus-videoroom.component.d.ts.map