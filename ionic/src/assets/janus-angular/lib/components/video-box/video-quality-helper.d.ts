import * as moment from 'moment';
/** @internal */
export interface VideoRunRecord {
    ended: moment.Moment;
    duration: number;
}
/** @internal */
export interface VideoStats {
    started: moment.Moment;
    runs: VideoRunRecord[];
    errors: VideoRunRecord[];
}
/** @internal */
export declare class VideoQualityHelper {
    streams: {
        [id: number]: VideoStats;
    };
    private numStreams;
    noise: number;
    upgradeTimeout: moment.Duration;
    retryTimeoutBase: moment.Duration;
    constructor(numStreams: number);
    logStreamSuccess(substream: number): void;
    testUpgrade(substream: any): number;
    ping(substream: number): number;
    _createVideoRunRecord(started: moment.Moment): VideoRunRecord;
    streamError(substream: number): void;
    streamEnd(substream: number): void;
}
