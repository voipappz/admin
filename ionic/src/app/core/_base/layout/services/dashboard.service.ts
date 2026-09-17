import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { HandleRequest } from './handleRequest.service';
import { WebsocketService } from './action-cable.service';
import { UserData } from '../../../providers/user-data';
import { DashboardWidget } from '../models/dashboard-widget.model';

/**
 * Server-driven dashboard, ported from va-voipbox-portal
 * (providers/dashboard + providers/widget):
 *   1. GET /api/dashboards                         -> the user's dashboard(s)
 *   2. GET /api/dashboards/:uuid?action=widgets    -> widget DEFINITIONS
 *   3. join ActionCable 'DashboardUser' channel    -> live widget DATA
 *
 * Live data arrives on the channel and is re-emitted via widgetData$, keyed by
 * widget name (the portal's `widgetSvc.widgetData` subject).
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  // Mirrors the portal's WidgetProvider.widgetData subject.
  public widgetData$ = new Subject<any>();
  private joined = false;

  constructor(
    private handleRequest: HandleRequest,
    private ws: WebsocketService,
    private userData: UserData
  ) {}

  // The user's dashboard list/views.
  getDashboards(): Observable<any> {
    return this.handleRequest.get('/api/dashboards');
  }

  // Widget definitions for a dashboard.
  getWidgets(uuid: string): Observable<any> {
    return this.handleRequest.get(`/api/dashboards/${uuid}?action=widgets`);
  }

  // Initial data for a single widget (its server-provided data_url).
  getWidgetData(dataUrl: string): Observable<any> {
    const url = dataUrl.startsWith('http') ? dataUrl : '/api/' + dataUrl.replace(/^\//, '');
    return this.handleRequest.get(url, { force_url: dataUrl.startsWith('http') });
  }

  // Join the live channel (ported from WidgetProvider.join). On connect we
  // 'login' so the server starts pushing this user's widget data.
  joinDashboard(): void {
    if (this.joined) { return; }
    const user = this.userData.getUserData() || {};
    const data: any = { user_uuid: user.uuid };

    this.ws.connect();
    this.ws.join('DashboardUser', data);
    this.joined = true;

    const channel = this.ws.getChannel('DashboardUser');
    if (!channel) { return; }

    channel.received().subscribe(
      (payload: any) => this.widgetData$.next(payload),
      (err: any) => console.error('[Dashboard] ws received error', err)
    );
    channel.connected().subscribe(
      () => { try { channel.perform('login', data); } catch (e) { console.error(e); } },
      (err: any) => console.error('[Dashboard] ws connect error', err)
    );
  }

  leaveDashboard(): void {
    if (!this.joined) { return; }
    try { this.ws.leave('DashboardUser'); } catch {}
    this.joined = false;
  }

  // Normalize a widget definition (defensive about server field names).
  normalizeWidget(w: any): DashboardWidget {
    return {
      uuid: w?.uuid,
      name: w?.name || w?.widget_name || w?.uuid,
      title: w?.title || w?.name || '',
      template: (w?.template || w?.type || 'counter') + '',
      data_url: w?.data_url,
      refresh_rate: w?.refresh_rate,
      columns: w?.columns || [],
      header_icon: w?.header_icon,
      header_background_color: w?.header_background_color,
      header_text_color: w?.header_text_color,
      params: w?.params,
      view: w?.view,
    };
  }
}
