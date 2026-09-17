import { Component } from '@angular/core';
import { SyslogService } from '../../core/_base/layout/services/syslog.service';

@Component({
  selector: 'page-syslog',
  templateUrl: 'syslog-page.html',
  styleUrls: ['./syslog-page.scss'],
  standalone: false
})
export class SyslogPage {
  logs: any[] = [];
  loading = true;
  errored = false;
  search = '';
  level = '';                 // '' = all
  levels = ['', 'error', 'warning', 'info', 'debug'];
  private page = 1;
  private readonly perPage = 50;
  private total = 0;
  expanded: { [id: string]: boolean } = {};

  constructor(private syslog: SyslogService) {}

  ionViewWillEnter() {
    if (!this.logs.length) { this.load(); }
  }

  // (Re)load from page 1. `refresher`/`searchbar` reuse this.
  load(event?: any) {
    this.page = 1;
    if (!event) { this.loading = true; }
    this.errored = false;
    this.syslog.list(this.query()).subscribe({
      next: (res: any) => {
        this.logs = this.rows(res);
        this.total = res?.total_records ?? this.logs.length;
        this.loading = false;
        event?.target?.complete();
      },
      error: () => {
        this.errored = true;
        this.loading = false;
        this.logs = [];
        event?.target?.complete();
      }
    });
  }

  // Infinite scroll: append the next page.
  loadMore(event: any) {
    if (this.logs.length >= this.total) { event.target.complete(); event.target.disabled = true; return; }
    this.page += 1;
    this.syslog.list(this.query()).subscribe({
      next: (res: any) => {
        this.logs = this.logs.concat(this.rows(res));
        event.target.complete();
      },
      error: () => { this.page -= 1; event.target.complete(); }
    });
  }

  onSearch(ev: any) {
    this.search = (ev?.detail?.value ?? '') + '';
    this.load();
  }

  setLevel(ev: any) {
    this.level = (ev?.detail?.value ?? '') + '';
    this.load();
  }

  toggle(log: any) {
    const id = this.idOf(log);
    this.expanded[id] = !this.expanded[id];
  }

  isExpanded(log: any): boolean { return !!this.expanded[this.idOf(log)]; }

  private query() {
    return { page: this.page, per_page: this.perPage, search: this.search || undefined, level: this.level || undefined };
  }
  private rows(res: any): any[] {
    return Array.isArray(res) ? res : (res?.data || []);
  }
  private idOf(log: any): string { return log?.event_id || log?.id || JSON.stringify(log).slice(0, 32); }

  // ---- display helpers (server uses { msg, level, time, actor, event_type, action }) ----
  message(log: any): string { return log?.msg || log?.action || log?.event_type || 'Event'; }
  time(log: any): any { return log?.time || log?.created_at || null; }
  actor(log: any): string { return log?.actor || ''; }
  private lvl(log: any): string { return ((log?.level || 'info') + '').toLowerCase(); }
  colorFor(log: any): string {
    switch (this.lvl(log)) {
      case 'error': case 'fatal': case 'exception': return 'danger';
      case 'warning': case 'warn': return 'warning';
      case 'debug': return 'medium';
      default: return 'primary';
    }
  }
  iconFor(log: any): string {
    switch (this.lvl(log)) {
      case 'error': case 'fatal': case 'exception': return 'alert-circle';
      case 'warning': case 'warn': return 'warning';
      case 'debug': return 'bug';
      default: return 'information-circle';
    }
  }
}
