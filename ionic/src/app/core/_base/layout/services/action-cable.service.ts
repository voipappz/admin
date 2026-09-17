// Angular
import { Injectable } from '@angular/core';
import { Socket } from 'phoenix';
import { AuthService } from '../../../providers/simple-auth.service';
import { ChannelAdapter } from '../../../providers/websocket';

declare var CONFIG:any;

/**
 * Root-provided twin of `WebsocketProvider` for the layout services — now
 * backed by the connectix (Elixir) gateway's /agent Phoenix socket; ActionCable
 * is gone. Same public surface as before (connect/join/getChannel/leave/close),
 * channels expose received()/connected()/perform() via ChannelAdapter.
 */
@Injectable({
	providedIn: 'root'
})
export class WebsocketService {

    private _channelMap: {[key:string]: ChannelAdapter} = {};
    private _socket: Socket | null = null;

    constructor(private auth: AuthService) {}

    public connect() {
      if (this._socket) { return; }
      console.log("[Phoenix] Connecting to:", CONFIG.WEBSOCKETS_URL);
      try {
        const base = (CONFIG.WEBSOCKETS_URL || '').replace(/\/$/, '');
        this._socket = new Socket(base + '/agent', {
          params: { token: this.auth.getToken() || '' }
        });
        this._socket.connect();
      } catch (error) {
        console.error("[Phoenix] Connection error:", error);
      }
    }

    public getChannel(channel): ChannelAdapter {
      return this._channelMap[channel];
    }

    public join(channel, params: any = {}) {
      console.log("[Phoenix] Joining channel:", channel, "with params:", params);
      try {
        if (!this._socket) { this.connect(); }
        const prefix = channel === 'DashboardUser' ? 'dashboard' : 'notifications';
        const topic = `${prefix}:${params.user_uuid || ''}`;
        this._channelMap[channel] = new ChannelAdapter(this._socket.channel(topic, params));

        this._channelMap[channel].received().subscribe(
          (message) => console.log("[Phoenix] Message received on", channel, ":", message),
          (error) => console.error("[Phoenix] Channel error:", error)
        );
      } catch (error) {
        console.error("[Phoenix] Error joining channel:", channel, error);
      }
    }

    public close() {
      console.log("[Phoenix] Disconnecting...");
      if (this._socket) {
        this._socket.disconnect();
        this._socket = null;
        this._channelMap = {};
      }
    }

    public leave(channel) {
      console.log("[Phoenix] Leaving channel:", channel);
      if(this._channelMap && this._channelMap[channel]) {
        this._channelMap[channel].unsubscribe();
        delete this._channelMap[channel];
      }
    }

}
