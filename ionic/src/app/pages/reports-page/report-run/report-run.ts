import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReportService } from '../../../core/_base/layout/services/report.service';

@Component({
  selector: 'page-report-run',
  templateUrl: 'report-run.html',
  styleUrls: ['./report-run.scss'],
  standalone: false
})
export class ReportRunPage {
  uuid = '';
  name = '';
  loading = true;
  errored = false;
  errorMsg = '';

  columns: { field: string; label: string }[] = [];
  rows: any[] = [];
  footer: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportSvc: ReportService
  ) {
    // Name passed via router state from the list (instant title, no extra call).
    const nav = this.router.getCurrentNavigation();
    this.name = nav?.extras?.state?.['name'] || '';
  }

  ionViewWillEnter() {
    this.uuid = this.route.snapshot.paramMap.get('uuid') || '';
    this.run();
  }

  run(event?: any) {
    if (!this.uuid) { this.errored = true; this.loading = false; return; }
    if (!event) { this.loading = true; }
    this.errored = false;
    this.errorMsg = '';
    this.reportSvc.run(this.uuid, {}).subscribe({
      next: (res: any) => {
        // run() uses getWithParams (observe:'response'), so the payload is in res.body.
        const data = (res && res.body !== undefined) ? res.body : res;
        if (data?.error) {
          this.errored = true;
          this.errorMsg = data.error;
        } else {
          this.parse(data);
        }
        this.loading = false;
        event?.target?.complete();
      },
      error: () => {
        this.errored = true;
        this.loading = false;
        event?.target?.complete();
      }
    });
  }

  // Result shape: { data:[], footer:{}, table:{ fields:[], data:[], type } }.
  private parse(res: any) {
    const table = res?.table || {};
    const rawRows = table.data || res?.data || res?.rows || [];
    this.rows = Array.isArray(rawRows) ? rawRows : [];

    const rawFields = table.fields || res?.fields || [];
    if (Array.isArray(rawFields) && rawFields.length) {
      this.columns = rawFields.map((f: any) => ({
        field: f?.field || f?.name || f,
        label: f?.name || f?.label || f?.field || ('' + f)
      }));
    } else if (this.rows.length && typeof this.rows[0] === 'object') {
      // Derive columns from the first row's keys.
      this.columns = Object.keys(this.rows[0]).map(k => ({ field: k, label: k }));
    } else {
      this.columns = [];
    }

    this.footer = res?.footer && Object.keys(res.footer).length ? res.footer : null;
  }

  cell(row: any, field: string): any {
    const v = row?.[field];
    return (v === null || v === undefined) ? '—' : v;
  }
}
