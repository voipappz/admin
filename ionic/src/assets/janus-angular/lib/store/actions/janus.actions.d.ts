import { JanusAttachCallbackData } from '../../models/janus-server.models';
import { RemoteFeed, RoomInfo, IceServer } from '../../models/janus.models';
/** @internal */
interface Action {
    type: string;
    payload?: any;
}
/** @internal */
export interface PublishOwnFeedPayload {
    audioDeviceId: string;
    videoDeviceId: string;
    canvasId: string;
}
/** @internal */
export interface AttachRemoteFeedPayload {
    feed: RemoteFeed;
    roomInfo: RoomInfo;
    pin: string;
}
/** @internal */
export interface RegisterPayload {
    name: string;
    userId: string;
    roomId: string | number;
    pin: string;
}
/** @internal */
export interface RequestSubstreamPayload {
    feed: RemoteFeed;
    substreamId: number;
}
/** @internal */
export declare const INITIALIZE_JANUS = "[Janus] Initialize Janus";
/** @internal */
export declare const INITIALIZE_JANUS_SUCCESS = "[Janus] Initialize Janus Success";
/** @internal */
export declare const INITIALIZE_JANUS_FAIL = "[Janus] Initialize Janus Fail";
/** @internal */
export declare class InitializeJanus implements Action {
    payload: IceServer[];
    readonly type = "[Janus] Initialize Janus";
    constructor(payload: IceServer[]);
}
/** @internal */
export declare class InitializeJanusSuccess implements Action {
    readonly type = "[Janus] Initialize Janus Success";
}
/** @internal */
export declare class InitializeJanusFail implements Action {
    readonly type = "[Janus] Initialize Janus Fail";
}
/** @internal */
export declare const ATTACH_VIDEO_ROOM = "[Janus] Attach VideoRoom";
/** @internal */
export declare const ATTACH_VIDEO_ROOM_FAIL = "[Janus] Attach VideoRoom Fail";
/** @internal */
export declare const ATTACH_CALLBACK = "[Janus] Attach Callback";
/** @internal */
export declare const REGISTER = "[Janus] Janus register";
/** @internal */
export declare const ATTACH_MEDIA_STREAM = "[Janus] Attach Media Stream";
/** @internal */
export declare class AttachVideoRoom implements Action {
    payload: string;
    readonly type = "[Janus] Attach VideoRoom";
    constructor(payload: string);
}
/** @internal */
export declare class AttachVideoRoomFail implements Action {
    payload: any;
    readonly type = "[Janus] Attach VideoRoom Fail";
    constructor(payload: any);
}
/** @internal */
export declare class AttachCallback implements Action {
    payload: JanusAttachCallbackData;
    readonly type = "[Janus] Attach Callback";
    constructor(payload: JanusAttachCallbackData);
}
/** @internal */
export declare class Register implements Action {
    payload: RegisterPayload;
    readonly type = "[Janus] Janus register";
    constructor(payload: RegisterPayload);
}
/** @internal */
export declare class AttachMediaStream implements Action {
    payload: {
        elemId: string;
        streamId: string;
    };
    readonly type = "[Janus] Attach Media Stream";
    constructor(payload: {
        elemId: string;
        streamId: string;
    });
}
/** @internal */
export declare const ATTACH_REMOTE_FEED = "[Janus] Attach Remote Feed";
/** @internal */
export declare const ATTACH_REMOTE_FEED_FAIL = "[Janus] Attach Remote Feed Fail";
/** @internal */
export declare const PUBLISH_OWN_FEED = "[Janus] Publish Own Feed";
/** @internal */
export declare const PUBLISH_OWN_FEED_SUCCESS = "[Janus] Publish Own Feed Success";
/** @internal */
export declare const PUBLISH_OWN_FEED_FAIL = "[Janus] Publish Own Feed Fail";
/** @internal */
export declare class AttachRemoteFeed implements Action {
    payload: AttachRemoteFeedPayload;
    readonly type = "[Janus] Attach Remote Feed";
    constructor(payload: AttachRemoteFeedPayload);
}
/** @internal */
export declare class AttachRemoteFeedFail implements Action {
    payload: {
        feed: RemoteFeed;
        error: any;
    };
    readonly type = "[Janus] Attach Remote Feed Fail";
    constructor(payload: {
        feed: RemoteFeed;
        error: any;
    });
}
/** @internal */
export declare class PublishOwnFeed implements Action {
    payload: PublishOwnFeedPayload;
    readonly type = "[Janus] Publish Own Feed";
    constructor(payload: PublishOwnFeedPayload);
}
/** @internal */
export declare class PublishOwnFeedSuccess implements Action {
    readonly type = "[Janus] Publish Own Feed Success";
}
/** @internal */
export declare class PublishOwnFeedFail implements Action {
    payload: any;
    readonly type = "[Janus] Publish Own Feed Fail";
    constructor(payload: any);
}
export declare const REQUEST_SUBSTREAM = "[Janus] Request Substream";
/** @internal */
export declare class RequestSubstream implements Action {
    payload: RequestSubstreamPayload;
    readonly type = "[Janus] Request Substream";
    constructor(payload: RequestSubstreamPayload);
}
export declare const TOGGLE_MUTE_SUCCESS = "[Janus] Toggle Mute Success";
/** @internal */
export declare class ToggleMuteSuccess implements Action {
    payload: boolean;
    readonly type = "[Janus] Toggle Mute Success";
    constructor(payload: boolean);
}
/** @internal */
export declare const ANSWER_REMOTE_FEED_JSEP_SUCCESS = "[Janus] Answer remote feed jsep success";
/** @internal */
export declare const ANSWER_REMOTE_FEED_JSEP_FAIL = "[Janus] Answer remote feed jsep fail";
/** @internal */
export declare class AnswerRemoteFeedJsepSuccess implements Action {
    readonly type = "[Janus] Answer remote feed jsep success";
}
/** @internal */
export declare class AnswerRemoteFeedJsepFail implements Action {
    payload: any;
    readonly type = "[Janus] Answer remote feed jsep fail";
    constructor(payload: any);
}
/** @internal */
export declare type JanusAction = AttachRemoteFeed | AttachRemoteFeedFail | AnswerRemoteFeedJsepFail | AnswerRemoteFeedJsepSuccess | PublishOwnFeed | PublishOwnFeedSuccess | PublishOwnFeedFail | RequestSubstream | ToggleMuteSuccess | AttachVideoRoom | AttachVideoRoomFail | AttachCallback | InitializeJanus | InitializeJanusSuccess | InitializeJanusFail | Register;
export {};
