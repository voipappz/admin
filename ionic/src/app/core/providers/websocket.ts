import { Injectable } from '@angular/core';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import { Socket, Channel as PhoenixChannel } from 'phoenix';
import { AuthService } from './simple-auth.service';

declare var CONFIG: any;

/**
 * Same surface angular2-actioncable's Channel exposed (received/connected/
 * perform/unsubscribe), backed by a Phoenix channel — so no call-site changes.
 */
export class ChannelAdapter {
  private _received = new Subject<any>();
  private _connected = new ReplaySubject<any>(1);

  constructor(private chan: PhoenixChannel) {
    this.chan.on('message', (payload: any) => this._received.next(payload));
    this.chan.join()
      .receive('ok', (resp: any) => this._connected.next(resp))
      .receive('error', (err: any) => console.error('[ws] channel join failed', err));
  }

  received(): Observable<any> { return this._received.asObservable(); }
  connected(): Observable<any> { return this._connected.asObservable(); }
  perform(action: string, data?: any) { this.chan.push(action, data || {}); }
  unsubscribe() { this.chan.leave(); }
}

/**
 * Realtime via the connectix (Elixir) gateway's /agent Phoenix socket —
 * ActionCable is gone. CONFIG.WEBSOCKETS_URL is the socket base
 * (e.g. ws://localhost:4000); the session token authenticates the connect.
 *
 * ActionCable channel names map to Phoenix topics:
 *   'notifications' → notifications:<user_uuid>
 *   'DashboardUser' → dashboard:<user_uuid>
 */
@Injectable()
export class WebsocketProvider {
  private _channelMap: {[key: string]: ChannelAdapter} = {};
  private _socket: Socket | null = null;

  constructor(private auth: AuthService) {}

  public connect() {
    if (this._socket) { return; }
    console.log('[connected to phoenix /agent socket]');
    const base = (CONFIG.WEBSOCKETS_URL || '').replace(/\/$/, '');
    this._socket = new Socket(base + '/agent', {
      params: { token: this.auth.getToken() || '' }
    });
    this._socket.connect();
  }

  public getChannel(channel: string): ChannelAdapter {
    return this._channelMap[channel];
  }

  public join(channel: string, params: any = {}) {
    console.log('joined channel: ' + channel);
    if (!this._socket) { this.connect(); }
    const prefix = channel === 'DashboardUser' ? 'dashboard' : 'notifications';
    const topic = `${prefix}:${params.user_uuid || ''}`;
    this._channelMap[channel] = new ChannelAdapter(this._socket.channel(topic, params));
  }

  public close() {
    console.log('[disconnected from phoenix socket]');
    if (this._socket) { this._socket.disconnect(); this._socket = null; }
    this._channelMap = {};
  }

  public leave(channel: string) {
    console.log('left channel: ' + channel);
    if (this._channelMap && this._channelMap[channel]) {
      this._channelMap[channel].unsubscribe();
      delete this._channelMap[channel];
    }
  }
}
