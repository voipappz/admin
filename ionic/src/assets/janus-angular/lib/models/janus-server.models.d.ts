export declare const ATTACH_SUCCESS = "attach success";
export declare const CONSENT_DIALOG = "consent dialog";
export declare const MEDIA_STATE = "media state";
export declare const WEBRTC_STATE = "webrtc state";
export declare const SLOW_LINK = "slow link";
export declare const ON_MESSAGE = "message";
export declare const ON_LOCAL_STREAM = "local stream";
export declare const ON_REMOTE_STREAM = "remote stream";
export declare const ON_DATA_OPEN = "data open";
export declare const ON_DATA = "data";
export declare const ON_CLEANUP = "cleanup";
export declare const DETACHED = "detached";
export declare const ON_REMOTE_FEED_MESSAGE = "[remote] message";
export declare const REMOTE_FEED_WEBRTC_STATE = "[remote] webrtc state";
export declare const REMOTE_FEED_SLOW_LINK = "[remote] slow link";
export declare const ON_REMOTE_LOCAL_STREAM = "[remote] local stream";
export declare const ON_REMOTE_REMOTE_STREAM = "[remote] remote stream";
export declare const ON_REMOTE_CLEANUP = "[remote] cleanup";
/** @internal */
export interface JanusAttachCallbackData {
    message: string;
    payload?: any;
}
/** @internal */
export interface Pub {
    id: string;
    display: string;
    audio_codec: string;
    video_codec: string;
    talking?: boolean;
}
/** @internal */
export interface JanusMessage {
    videoroom: string;
    room: string;
    description?: string;
    id?: number;
    private_id?: number;
    publishers?: Pub[];
    unpublished?: string;
    configured?: string;
    error_code?: number;
    error?: string;
    leaving?: string;
    reason?: string;
}
/** @internal */
export declare enum CustomErrors {
    kicked = 9991,
    server_down = 9992
}
/** @internal */
export declare const JanusErrors: {
    499: {
        janusCode: string;
        message: string;
    };
    421: {
        janusCode: string;
        message: string;
    };
    422: {
        janusCode: string;
        message: string;
    };
    423: {
        janusCode: string;
        message: string;
    };
    424: {
        janusCode: string;
        message: string;
    };
    425: {
        janusCode: string;
        message: string;
    };
    426: {
        janusCode: string;
        message: string;
    };
    427: {
        janusCode: string;
        message: string;
    };
    428: {
        janusCode: string;
        message: string;
    };
    429: {
        janusCode: string;
        messag: string;
    };
    430: {
        janusCode: string;
        message: string;
    };
    431: {
        janusCode: string;
        message: string;
    };
    432: {
        janusCode: string;
        message: string;
    };
    433: {
        janusCode: string;
        message: string;
    };
    434: {
        janusCode: string;
        message: string;
    };
    435: {
        janusCode: string;
        message: string;
    };
    436: {
        janusCode: string;
        message: string;
    };
    437: {
        janusCode: string;
        message: string;
    };
    9991: {
        janusCode: string;
        message: string;
    };
    9992: {
        janusCode: string;
        message: string;
    };
};
