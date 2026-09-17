import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { DashboardService } from '../../core/_base/layout/services/dashboard.service';
import { DashboardWidget } from '../../core/_base/layout/models/dashboard-widget.model';

@Component({
    selector: 'page-dashboard',
    templateUrl: 'dashboard.html',
    styleUrls: ['./dashboard.scss'],
    standalone: false
})
export class DashboardPage implements OnDestroy {
  loading = true;
  errored = false;

  dashboardUuid = '';
  widgets: DashboardWidget[] = [];
  // Live widget data keyed by widget name (portal's `widgetData`).
  data: { [name: string]: any } = {};

  private wsSub?: Subscription;

  constructor(private dashboardSvc: DashboardService) {}

  ionViewWillEnter() {
    this.load();
  }

  ionViewWillLeave() {
    this.teardownWs();
  }

  ngOnDestroy() {
    this.teardownWs();
  }

  load(event?: any) {
    if (!event) { this.loading = true; }
    this.errored = false;

    this.dashboardSvc.getDashboards().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : (res?.data || res?.dashboards || []);
        const dash = list[0];
        this.dashboardUuid = dash?.uuid || dash?.dashboard_uuid || '';
        if (!this.dashboardUuid) {
          // No server dashboard configured for this user.
          this.widgets = [];
          this.loading = false;
          event?.target?.complete();
          return;
        }
        this.loadWidgets(event);
      },
      error: () => { this.fail(event); }
    });
  }

  private loadWidgets(event?: any) {
    this.dashboardSvc.getWidgets(this.dashboardUuid).subscribe({
      next: (res: any) => {
        const raw = Array.isArray(res) ? res : (res?.data || res?.widgets || []);
        this.widgets = raw.map((w: any) => this.dashboardSvc.normalizeWidget(w));
        this.loading = false;
        event?.target?.complete();

        // Initial data per widget, then live updates over the websocket.
        this.widgets.forEach(w => {
          if (w.data_url) {
            this.dashboardSvc.getWidgetData(w.data_url).subscribe({
              next: (d: any) => { this.data[w.name] = this.unwrap(d); },
              error: () => {}
            });
          }
        });
        this.setupWs();
      },
      error: () => { this.fail(event); }
    });
  }

  private setupWs() {
    if (this.wsSub) { return; }
    this.dashboardSvc.joinDashboard();
    this.wsSub = this.dashboardSvc.widgetData$.subscribe((payload: any) => {
      if (!payload) { return; }
      // Payload may be the whole {name: data} map, or a single {name, data}.
      if (payload.name && payload.data !== undefined) {
        this.data[payload.name] = payload.data;
      } else if (typeof payload === 'object') {
        this.data = { ...this.data, ...payload };
      }
    });
  }

  private teardownWs() {
    this.wsSub?.unsubscribe();
    this.wsSub = undefined;
    this.dashboardSvc.leaveDashboard();
  }

  private fail(event?: any) {
    this.errored = true;
    this.loading = false;
    event?.target?.complete();
  }

  private unwrap(d: any): any {
    return (d && d.body !== undefined) ? d.body : d;
  }

  // ---- render helpers (defensive about the per-template data shape) --------
  widgetData(w: DashboardWidget): any { return this.data[w.name]; }

  counterValue(w: DashboardWidget): any {
    const d = this.data[w.name];
    if (d === null || d === undefined) { return '—'; }
    if (typeof d === 'number' || typeof d === 'string') { return d; }
    return d.value ?? d.count ?? d.total ?? d.data?.value ?? '—';
  }

  rows(w: DashboardWidget): any[] {
    const d = this.data[w.name];
    const r = d?.rows || d?.data || d?.table?.data || (Array.isArray(d) ? d : []);
    return Array.isArray(r) ? r : [];
  }

  columns(w: DashboardWidget): { field: string; label: string }[] {
    if (w.columns && w.columns.length) {
      return w.columns.filter(c => c.display !== false).map(c => ({ field: c.name, label: c.header_name || c.name }));
    }
    const first = this.rows(w)[0];
    return first && typeof first === 'object' ? Object.keys(first).map(k => ({ field: k, label: k })) : [];
  }

  // Chart series -> [{label, value, pct}] for the mobile CSS bar list.
  series(w: DashboardWidget): { label: string; value: number; pct: number }[] {
    const d = this.data[w.name];
    let arr: any[] = d?.series || d?.data || (Array.isArray(d) ? d : []);
    if (!Array.isArray(arr)) { arr = []; }
    const pts = arr.map((p: any) => ({
      label: (p?.name ?? p?.label ?? p?.key ?? '') + '',
      value: Number(p?.value ?? p?.count ?? p?.y ?? 0) || 0
    }));
    const max = Math.max(1, ...pts.map(p => p.value));
    return pts.map(p => ({ ...p, pct: Math.round((p.value / max) * 100) }));
  }

  isChart(w: DashboardWidget): boolean { return /chart|line|pie|bar/i.test(w.template); }
  isTable(w: DashboardWidget): boolean { return /table|grid/i.test(w.template); }
  isCounter(w: DashboardWidget): boolean { return /counter|number|metric|stat/i.test(w.template); }

  cell(row: any, field: string): any {
    const v = row?.[field];
    return (v === null || v === undefined) ? '—' : v;
  }
}
