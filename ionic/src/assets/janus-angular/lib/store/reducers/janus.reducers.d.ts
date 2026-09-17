import * as janusActions from '../actions/janus.actions';
import { RemoteFeed, RoomInfo } from '../../models/janus.models';
/** @internal */
export interface VideoroomState {
    roomInfo: RoomInfo;
    remoteFeeds: {
        [id: string]: RemoteFeed;
    };
}
export declare const initialState: VideoroomState;
/** @internal */
export declare function reducer(state: VideoroomState, action: janusActions.JanusAction): VideoroomState;
